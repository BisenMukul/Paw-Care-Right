import { ServiceUnavailableException } from "@nestjs/common";

import type { PrismaService } from "../prisma/prisma.service";
import type { RedisService } from "../redis/redis.service";
import { HealthService } from "./health.service";

describe("HealthService", () => {
  function buildService(overrides: { queryRaw?: () => unknown; ping?: () => unknown }) {
    const prisma = {
      $queryRaw: overrides.queryRaw ?? jest.fn().mockResolvedValue([{ "?column?": 1 }]),
    } as unknown as PrismaService;

    const redis = {
      ping: overrides.ping ?? jest.fn().mockResolvedValue("PONG"),
    } as unknown as RedisService;

    return new HealthService(prisma, redis);
  }

  it("returns ok status when prisma and redis both succeed", async () => {
    const service = buildService({});

    await expect(service.check()).resolves.toEqual({ status: "ok", db: "ok", redis: "ok" });
  });

  it("throws ServiceUnavailableException when redis.ping rejects", async () => {
    const service = buildService({
      ping: jest.fn().mockRejectedValue(new Error("redis down")),
    });

    await expect(service.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("throws ServiceUnavailableException when prisma query rejects", async () => {
    const service = buildService({
      queryRaw: jest.fn().mockRejectedValue(new Error("db down")),
    });

    await expect(service.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
