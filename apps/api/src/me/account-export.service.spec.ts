import { Logger } from "@nestjs/common";

import type { AppConfigService } from "../config/app-config.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { StorageService } from "../storage/storage.service";
import { AccountExportService } from "./account-export.service";

const NOW = new Date("2026-07-25T00:00:00.000Z");

function buildValidUser() {
  return {
    id: "user-1",
    email: "owner@bombaypetcompany.local",
    locale: "en-US",
    region: "US",
    createdAt: NOW,
  };
}

function buildPrisma(overrides: Record<string, unknown> = {}): PrismaService {
  const base = {
    user: { findUnique: jest.fn().mockResolvedValue(buildValidUser()) },
    membership: {
      findFirst: jest.fn().mockResolvedValue({ userId: "user-1", householdId: "household-1", role: "OWNER" }),
    },
    household: { findUnique: jest.fn().mockResolvedValue({ id: "household-1", name: "My Household" }) },
    pet: { findMany: jest.fn().mockResolvedValue([]) },
    symptomCheck: { findMany: jest.fn().mockResolvedValue([]) },
    healthLog: { findMany: jest.fn().mockResolvedValue([]) },
    reminder: { findMany: jest.fn().mockResolvedValue([]) },
    chatThread: { findMany: jest.fn().mockResolvedValue([]) },
    userNotificationPrefs: { findUnique: jest.fn().mockResolvedValue(null) },
    subscription: { findUnique: jest.fn().mockResolvedValue(null) },
    device: { findMany: jest.fn().mockResolvedValue([]) },
    accountExport: { update: jest.fn().mockResolvedValue({}) },
    ...overrides,
  };
  return base as unknown as PrismaService;
}

function buildStorage(overrides: Record<string, unknown> = {}): StorageService {
  return {
    putObject: jest.fn().mockResolvedValue(undefined),
    getPresignedGetUrl: jest.fn().mockResolvedValue("https://minio.example/signed"),
    ...overrides,
  } as unknown as StorageService;
}

function buildConfig(nodeEnv: "development" | "test" | "production" = "test"): AppConfigService {
  return { nodeEnv } as unknown as AppConfigService;
}

describe("AccountExportService.build", () => {
  it("a valid bundle is validated, written to storage, and marks the export DONE", async () => {
    const prisma = buildPrisma();
    const storage = buildStorage();
    const service = new AccountExportService(prisma, storage, buildConfig());

    await service.build("export-1", "user-1");

    expect(storage.putObject).toHaveBeenCalledTimes(1);
    const [key, body, contentType] = (storage.putObject as jest.Mock).mock.calls[0];
    expect(key).toBe("exports/user-1/export-1.json");
    expect(contentType).toBe("application/json");
    const parsed = JSON.parse((body as Buffer).toString());
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.user.id).toBe("user-1");

    expect(prisma.accountExport.update).toHaveBeenCalledWith({
      where: { id: "export-1" },
      data: { status: "DONE", objectKey: "exports/user-1/export-1.json", completedAt: expect.any(Date) },
    });
  });

  it("a bundle that fails schema validation is never written to storage (AC2)", async () => {
    // Missing `email` -- `exportUserSchema` requires a string -- makes the
    // assembled bundle fail `accountExportSchema.parse(...)`.
    const invalidUser = { ...buildValidUser(), email: undefined };
    const prisma = buildPrisma({ user: { findUnique: jest.fn().mockResolvedValue(invalidUser) } });
    const storage = buildStorage();
    const service = new AccountExportService(prisma, storage, buildConfig());

    await expect(service.build("export-1", "user-1")).rejects.toThrow();

    expect(storage.putObject).not.toHaveBeenCalled();
    expect(prisma.accountExport.update).toHaveBeenCalledWith({
      where: { id: "export-1" },
      data: { status: "FAILED", failureReason: expect.any(String) },
    });
  });

  it("marks FAILED and rethrows when the user row cannot be found", async () => {
    const prisma = buildPrisma({ user: { findUnique: jest.fn().mockResolvedValue(null) } });
    const storage = buildStorage();
    const service = new AccountExportService(prisma, storage, buildConfig());

    await expect(service.build("export-1", "missing-user")).rejects.toThrow(/user not found/);

    expect(storage.putObject).not.toHaveBeenCalled();
    expect(prisma.accountExport.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
    );
  });

  it("logs the full presigned url in non-production, but ids-only in production (delivery stub)", async () => {
    const logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    try {
      const prisma = buildPrisma();
      const storage = buildStorage();

      const devService = new AccountExportService(prisma, storage, buildConfig("development"));
      await devService.build("export-1", "user-1");
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({ event: "account_export_ready", url: expect.any(String) }),
      );

      logSpy.mockClear();

      const prodService = new AccountExportService(prisma, storage, buildConfig("production"));
      await prodService.build("export-2", "user-1");
      const prodCall = logSpy.mock.calls.find(
        (call) => (call[0] as { event?: string }).event === "account_export_ready",
      );
      expect(prodCall?.[0]).not.toHaveProperty("url");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("never includes expoPushToken or rawEventJson in the assembled bundle", async () => {
    const prisma = buildPrisma({
      device: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { platform: "ios", lastSeenAt: NOW, createdAt: NOW, expoPushToken: "ExponentPushToken[xxx]" },
          ]),
      },
      subscription: {
        findUnique: jest.fn().mockResolvedValue({
          entitlement: "PREMIUM",
          plan: "monthly",
          status: "active",
          expiresAt: null,
          rawEventJson: { secret: "should never leak" },
        }),
      },
    });
    const storage = buildStorage();
    const service = new AccountExportService(prisma, storage, buildConfig());

    await service.build("export-1", "user-1");

    const body = (storage.putObject as jest.Mock).mock.calls[0][1] as Buffer;
    const serialized = body.toString();
    expect(serialized).not.toContain("expoPushToken");
    expect(serialized).not.toContain("rawEventJson");
    expect(serialized).not.toContain("should never leak");
  });
});
