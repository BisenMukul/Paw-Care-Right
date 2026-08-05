import { ConflictException } from "@nestjs/common";

import type { PrismaService } from "../prisma/prisma.service";
import { PrivacyService } from "./privacy.service";

interface TxMock {
  user: { update: jest.Mock };
  refreshToken: { updateMany: jest.Mock };
  device: { deleteMany: jest.Mock };
}

function buildTx(): TxMock {
  return {
    user: { update: jest.fn().mockResolvedValue({}) },
    refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    device: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
}

function buildPrisma(overrides: Record<string, unknown> = {}): { prisma: PrismaService; tx: TxMock } {
  const tx = buildTx();
  const base = {
    user: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ analyticsOptOut: false, deletionScheduledAt: null }),
      update: jest.fn().mockResolvedValue({ analyticsOptOut: true, deletionScheduledAt: null }),
    },
    membership: {
      findMany: jest.fn().mockResolvedValue([{ userId: "user-1", householdId: "household-1", role: "MEMBER" }]),
      count: jest.fn().mockResolvedValue(0),
    },
    accountExport: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "export-1", status: "PENDING", requestedAt: new Date("2026-07-25T00:00:00.000Z") }),
    },
    $transaction: jest.fn(async (fn: (tx: TxMock) => Promise<unknown>) => fn(tx)),
    ...overrides,
  };
  return { prisma: base as unknown as PrismaService, tx };
}

function buildQueue(): { add: jest.Mock } {
  return { add: jest.fn().mockResolvedValue({}) };
}

describe("PrivacyService", () => {
  describe("getSettings / updateSettings", () => {
    it("getSettings returns the caller's current settings", async () => {
      const { prisma } = buildPrisma({
        user: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({ analyticsOptOut: true, deletionScheduledAt: null }),
        },
      });
      const service = new PrivacyService(prisma, buildQueue() as never);

      await expect(service.getSettings("user-1")).resolves.toEqual({
        analyticsOptOut: true,
        deletionScheduledAt: null,
      });
    });

    it("updateSettings persists and returns the new analyticsOptOut value", async () => {
      const update = jest.fn().mockResolvedValue({ analyticsOptOut: true, deletionScheduledAt: null });
      const { prisma } = buildPrisma({ user: { update, findUniqueOrThrow: jest.fn() } });
      const service = new PrivacyService(prisma, buildQueue() as never);

      const result = await service.updateSettings("user-1", true);

      expect(update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { analyticsOptOut: true },
        select: { analyticsOptOut: true, deletionScheduledAt: true },
      });
      expect(result).toEqual({ analyticsOptOut: true, deletionScheduledAt: null });
    });
  });

  describe("requestExport (idempotent-while-PENDING)", () => {
    it("returns the existing PENDING export unchanged and does not enqueue a new job", async () => {
      const pendingRow = { id: "export-existing", status: "PENDING", requestedAt: new Date("2026-07-20T00:00:00.000Z") };
      const { prisma } = buildPrisma({
        accountExport: { findFirst: jest.fn().mockResolvedValue(pendingRow), create: jest.fn() },
      });
      const queue = buildQueue();
      const service = new PrivacyService(prisma, queue as never);

      const result = await service.requestExport("user-1");

      expect(result.exportId).toBe("export-existing");
      expect(queue.add).not.toHaveBeenCalled();
    });

    it("creates a new export row and enqueues a job when none is PENDING", async () => {
      const created = { id: "export-new", status: "PENDING", requestedAt: new Date("2026-07-25T00:00:00.000Z") };
      const { prisma } = buildPrisma({
        accountExport: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(created) },
      });
      const queue = buildQueue();
      const service = new PrivacyService(prisma, queue as never);

      const result = await service.requestExport("user-1");

      expect(result.exportId).toBe("export-new");
      expect(queue.add).toHaveBeenCalledWith(
        "account-export-build",
        { exportId: "export-new", userId: "user-1" },
        expect.objectContaining({ jobId: "export-new", attempts: 3, removeOnFail: false }),
      );
    });
  });

  describe("requestDeletion (D1 case analysis)", () => {
    it("(a) MEMBER of someone else's household -> allowed, schedules deletion", async () => {
      const { prisma, tx } = buildPrisma({
        membership: {
          findMany: jest.fn().mockResolvedValue([{ userId: "user-1", householdId: "household-1", role: "MEMBER" }]),
          count: jest.fn(),
        },
      });
      const service = new PrivacyService(prisma, buildQueue() as never);

      const result = await service.requestDeletion("user-1");

      expect(typeof result.deletionScheduledAt).toBe("string");
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { deletionScheduledAt: expect.any(Date), analyticsOptOut: true },
      });
      expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(tx.device.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
      // D1a never checks sibling count -- membership.count must not run for a MEMBER.
      expect(prisma.membership.count).not.toHaveBeenCalled();
    });

    it("(b) OWNER and the household's ONLY membership -> allowed, schedules deletion", async () => {
      const { prisma, tx } = buildPrisma({
        membership: {
          findMany: jest.fn().mockResolvedValue([{ userId: "user-1", householdId: "household-1", role: "OWNER" }]),
          count: jest.fn().mockResolvedValue(0),
        },
      });
      const service = new PrivacyService(prisma, buildQueue() as never);

      const result = await service.requestDeletion("user-1");

      expect(typeof result.deletionScheduledAt).toBe("string");
      expect(tx.user.update).toHaveBeenCalledTimes(1);
    });

    it("(c) OWNER with >=1 other membership -> ConflictException, no writes", async () => {
      const { prisma, tx } = buildPrisma({
        membership: {
          findMany: jest.fn().mockResolvedValue([{ userId: "user-1", householdId: "household-1", role: "OWNER" }]),
          count: jest.fn().mockResolvedValue(1),
        },
      });
      const service = new PrivacyService(prisma, buildQueue() as never);

      await expect(service.requestDeletion("user-1")).rejects.toBeInstanceOf(ConflictException);
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(tx.device.deleteMany).not.toHaveBeenCalled();
    });

    it("an unsupported multi/zero-membership state -> ConflictException", async () => {
      const { prisma } = buildPrisma({
        membership: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn() },
      });
      const service = new PrivacyService(prisma, buildQueue() as never);

      await expect(service.requestDeletion("user-1")).rejects.toBeInstanceOf(ConflictException);
    });

    it("is idempotent: a second call while deletionScheduledAt is already set returns it unchanged, no transaction", async () => {
      const existingIso = "2026-08-24T00:00:00.000Z";
      const { prisma } = buildPrisma({
        membership: {
          findMany: jest.fn().mockResolvedValue([{ userId: "user-1", householdId: "household-1", role: "MEMBER" }]),
          count: jest.fn(),
        },
        user: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({ deletionScheduledAt: new Date(existingIso) }),
        },
      });
      const transactionSpy = prisma.$transaction as jest.Mock;
      const service = new PrivacyService(prisma, buildQueue() as never);

      const result = await service.requestDeletion("user-1");

      expect(result).toEqual({ deletionScheduledAt: existingIso });
      expect(transactionSpy).not.toHaveBeenCalled();
    });
  });
});
