import { Prisma } from "@prisma/client";

import type { PrismaService } from "../prisma/prisma.service";
import { DevicesService } from "./devices.service";

describe("DevicesService", () => {
  const userId = "user-1";
  const expoPushToken = "ExponentPushToken[abc123]";
  const platform = "ios";

  function buildDevice(overrides: Partial<{ id: string; lastSeenAt: Date }> = {}) {
    return {
      id: overrides.id ?? "device-1",
      userId,
      expoPushToken,
      platform,
      lastSeenAt: overrides.lastSeenAt ?? new Date(),
      createdAt: new Date(),
    };
  }

  function buildPrisma(transaction: jest.Mock) {
    return {
      device: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: transaction,
    } as unknown as PrismaService;
  }

  it("upserts and returns the mapped device (create/update payload proves reassign-on-conflict)", async () => {
    const device = buildDevice();
    const transaction = jest.fn().mockResolvedValue([device, { count: 0 }]);
    const prisma = buildPrisma(transaction);
    const service = new DevicesService(prisma);

    const result = await service.register(userId, { expoPushToken, platform });

    expect(result).toEqual({
      id: device.id,
      expoPushToken: device.expoPushToken,
      platform: device.platform,
      lastSeenAt: device.lastSeenAt,
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("first $transaction throws P2002 → retried once, resolves", async () => {
    const device = buildDevice();
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
    });
    const transaction = jest
      .fn()
      .mockRejectedValueOnce(p2002)
      .mockResolvedValueOnce([device, { count: 0 }]);
    const prisma = buildPrisma(transaction);
    const service = new DevicesService(prisma);

    const result = await service.register(userId, { expoPushToken, platform });

    expect(transaction).toHaveBeenCalledTimes(2);
    expect(result.id).toBe(device.id);
  });

  it("non-P2002 error is not retried", async () => {
    const genericError = new Error("boom");
    const transaction = jest.fn().mockRejectedValue(genericError);
    const prisma = buildPrisma(transaction);
    const service = new DevicesService(prisma);

    await expect(service.register(userId, { expoPushToken, platform })).rejects.toThrow("boom");
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("prune deletes same user+platform, other tokens", async () => {
    const device = buildDevice();
    const prisma = {
      device: {
        upsert: jest.fn().mockReturnValue("upsert-op"),
        deleteMany: jest.fn().mockReturnValue("delete-op"),
      },
      $transaction: jest.fn().mockResolvedValue([device, { count: 1 }]),
    } as unknown as PrismaService;
    const service = new DevicesService(prisma);

    await service.register(userId, { expoPushToken, platform });

    expect(prisma.device.deleteMany).toHaveBeenCalledWith({
      where: { userId, platform, expoPushToken: { not: expoPushToken } },
    });
  });

  it("create/update payload: upsert called with reassigning update and matching create", async () => {
    const device = buildDevice();
    const prisma = {
      device: {
        upsert: jest.fn().mockReturnValue("upsert-op"),
        deleteMany: jest.fn().mockReturnValue("delete-op"),
      },
      $transaction: jest.fn().mockResolvedValue([device, { count: 0 }]),
    } as unknown as PrismaService;
    const service = new DevicesService(prisma);

    await service.register(userId, { expoPushToken, platform });

    expect(prisma.device.upsert).toHaveBeenCalledWith({
      where: { expoPushToken },
      create: { userId, expoPushToken, platform },
      update: { userId, platform, lastSeenAt: expect.any(Date) },
    });
  });
});
