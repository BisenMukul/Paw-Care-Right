import { ACCOUNT_EXPORT_RETENTION_DAYS } from "@pawcareright/types";

import * as sentry from "../observability/sentry";
import type { AccountErasureService } from "../me/account-erasure.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { StorageService } from "../storage/storage.service";
import { ACCOUNT_DELETION_BATCH_SIZE } from "./account-deletion.contract";
import { AccountDeletionService } from "./account-deletion.service";

jest.mock("../observability/sentry", () => ({
  captureApiMessage: jest.fn(),
}));

const MS_PER_DAY = 86_400_000;

function buildPrisma(overrides: Record<string, unknown> = {}): PrismaService {
  const base = {
    user: { findMany: jest.fn().mockResolvedValue([]) },
    accountExport: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    ...overrides,
  };
  return base as unknown as PrismaService;
}

function buildErasure(erase?: jest.Mock): AccountErasureService {
  return {
    erase:
      erase ??
      jest.fn().mockResolvedValue({ mode: "USER_ONLY", deletedChecks: 0, deletedThreads: 0, deletedAuditLogs: 0, deletedS3Keys: 0 }),
  } as unknown as AccountErasureService;
}

function buildStorage(): StorageService {
  return { deleteObject: jest.fn().mockResolvedValue(undefined) } as unknown as StorageService;
}

describe("AccountDeletionService.sweep (T091 plan D2 grace enforcement)", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("a user whose deletionScheduledAt is in the future is never touched", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = buildPrisma({ user: { findMany } });
    const erase = jest.fn();
    const service = new AccountDeletionService(prisma, buildErasure(erase), buildStorage());

    const now = new Date("2026-07-25T04:15:00.000Z");
    const report = await service.sweep(now);

    expect(findMany).toHaveBeenCalledWith({
      where: { deletionScheduledAt: { lte: now } },
      select: { id: true },
      take: ACCOUNT_DELETION_BATCH_SIZE,
    });
    expect(erase).not.toHaveBeenCalled();
    expect(report.usersErased).toBe(0);
  });

  it("erases every user whose deletionScheduledAt has elapsed (<=now)", async () => {
    const findMany = jest.fn().mockResolvedValueOnce([{ id: "user-1" }, { id: "user-2" }]).mockResolvedValueOnce([]);
    const prisma = buildPrisma({ user: { findMany } });
    const erase = jest.fn().mockResolvedValue({ mode: "USER_ONLY", deletedChecks: 0, deletedThreads: 0, deletedAuditLogs: 0, deletedS3Keys: 0 });
    const service = new AccountDeletionService(prisma, buildErasure(erase), buildStorage());

    const report = await service.sweep(new Date("2026-07-25T04:15:00.000Z"));

    expect(erase).toHaveBeenCalledWith("user-1");
    expect(erase).toHaveBeenCalledWith("user-2");
    expect(report.usersScanned).toBe(2);
    expect(report.usersErased).toBe(2);
    expect(report.usersFailed).toBe(0);
  });

  it("one failing user's erasure is caught and does not abort the batch", async () => {
    const findMany = jest.fn().mockResolvedValueOnce([{ id: "user-1" }, { id: "user-2" }]).mockResolvedValueOnce([]);
    const prisma = buildPrisma({ user: { findMany } });
    const erase = jest
      .fn()
      .mockRejectedValueOnce(new Error("erasure boom"))
      .mockResolvedValueOnce({ mode: "USER_ONLY", deletedChecks: 0, deletedThreads: 0, deletedAuditLogs: 0, deletedS3Keys: 0 });
    const service = new AccountDeletionService(prisma, buildErasure(erase), buildStorage());

    const report = await service.sweep(new Date("2026-07-25T04:15:00.000Z"));

    expect(erase).toHaveBeenCalledTimes(2);
    expect(report.usersErased).toBe(1);
    expect(report.usersFailed).toBe(1);
  });

  it("F6 (checker review): a failing erasure reaches Sentry via captureApiMessage (fail-closed alert, ids only)", async () => {
    const findMany = jest.fn().mockResolvedValueOnce([{ id: "user-failing" }]).mockResolvedValueOnce([]);
    const prisma = buildPrisma({ user: { findMany } });
    const erase = jest.fn().mockRejectedValueOnce(new Error("erasure boom -- must never reach Sentry verbatim"));
    const service = new AccountDeletionService(prisma, buildErasure(erase), buildStorage());

    await service.sweep(new Date("2026-07-25T04:15:00.000Z"));

    expect(sentry.captureApiMessage).toHaveBeenCalledTimes(1);
    expect(sentry.captureApiMessage).toHaveBeenCalledWith("account_deletion_user_erasure_failed", {
      userId: "user-failing",
    });
  });

  it("does not call captureApiMessage when every erasure in the batch succeeds", async () => {
    const findMany = jest.fn().mockResolvedValueOnce([{ id: "user-1" }]).mockResolvedValueOnce([]);
    const prisma = buildPrisma({ user: { findMany } });
    const erase = jest
      .fn()
      .mockResolvedValueOnce({ mode: "USER_ONLY", deletedChecks: 0, deletedThreads: 0, deletedAuditLogs: 0, deletedS3Keys: 0 });
    const service = new AccountDeletionService(prisma, buildErasure(erase), buildStorage());

    await service.sweep(new Date("2026-07-25T04:15:00.000Z"));

    expect(sentry.captureApiMessage).not.toHaveBeenCalled();
  });

  it("purges AccountExport rows (+ S3 objects) older than ACCOUNT_EXPORT_RETENTION_DAYS", async () => {
    const now = new Date("2026-07-25T04:15:00.000Z");
    const cutoff = new Date(now.getTime() - ACCOUNT_EXPORT_RETENTION_DAYS * MS_PER_DAY);
    const exportFindMany = jest
      .fn()
      .mockResolvedValue([{ id: "export-1", objectKey: "exports/user-1/export-1.json" }]);
    const exportDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = buildPrisma({
      accountExport: { findMany: exportFindMany, deleteMany: exportDeleteMany },
    });
    const deleteObject = jest.fn().mockResolvedValue(undefined);
    const storage = { deleteObject } as unknown as StorageService;
    const service = new AccountDeletionService(prisma, buildErasure(), storage);

    const report = await service.sweep(now);

    expect(exportFindMany).toHaveBeenCalledWith({
      where: { requestedAt: { lt: cutoff } },
      select: { id: true, objectKey: true },
    });
    expect(deleteObject).toHaveBeenCalledWith("exports/user-1/export-1.json");
    expect(exportDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ["export-1"] } } });
    expect(report.exportsPurged).toBe(1);
  });

  it("skips S3 delete for an export row with no objectKey (never completed)", async () => {
    const exportFindMany = jest.fn().mockResolvedValue([{ id: "export-1", objectKey: null }]);
    const prisma = buildPrisma({
      accountExport: { findMany: exportFindMany, deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    });
    const deleteObject = jest.fn();
    const storage = { deleteObject } as unknown as StorageService;
    const service = new AccountDeletionService(prisma, buildErasure(), storage);

    await service.sweep(new Date("2026-07-25T04:15:00.000Z"));

    expect(deleteObject).not.toHaveBeenCalled();
  });
});
