import { ServiceUnavailableException } from "@nestjs/common";

import type { AppConfigService } from "../config/app-config.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { RedisService } from "../redis/redis.service";
import { HealthService } from "./health.service";

describe("HealthService", () => {
  function buildService(overrides: {
    queryRaw?: () => unknown;
    ping?: () => unknown;
    gitSha?: string;
  }) {
    const prisma = {
      $queryRaw: overrides.queryRaw ?? jest.fn().mockResolvedValue([{ "?column?": 1 }]),
    } as unknown as PrismaService;

    const redis = {
      ping: overrides.ping ?? jest.fn().mockResolvedValue("PONG"),
    } as unknown as RedisService;

    const appConfig = { gitSha: overrides.gitSha ?? "test-sha" } as unknown as AppConfigService;

    return new HealthService(prisma, redis, appConfig);
  }

  it("returns ok status when prisma and redis both succeed", async () => {
    const service = buildService({});

    await expect(service.check()).resolves.toEqual({
      status: "ok",
      db: "ok",
      redis: "ok",
      buildId: "test-sha",
    });
  });

  it("returns the configured GIT_SHA as buildId (OTA_UPDATES §5.3 pre-flight input)", async () => {
    const service = buildService({ gitSha: "deadbee" });

    await expect(service.check()).resolves.toEqual({
      status: "ok",
      db: "ok",
      redis: "ok",
      buildId: "deadbee",
    });
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
