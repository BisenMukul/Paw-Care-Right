import { Logger } from "@nestjs/common";

import type { RedisService } from "../redis/redis.service";
import { COST_AGGREGATE_TTL_SECONDS } from "./quota.constants";
import { CostLogService } from "./cost-log.service";

function buildService() {
  const counts = new Map<string, number>();
  const redis = {
    incrBy: jest.fn(async (key: string, amount: number) => {
      const next = (counts.get(key) ?? 0) + amount;
      counts.set(key, next);
      return next;
    }),
    expire: jest.fn(async () => undefined),
    get: jest.fn(async (key: string) => {
      const value = counts.get(key);
      return value === undefined ? null : String(value);
    }),
  } as unknown as RedisService;

  return { service: new CostLogService(redis), redis, counts };
}

describe("CostLogService", () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("aggregates cost across fake runs", async () => {
    const { service } = buildService();

    await service.record({ costMicroUsd: 1500, status: "OK" });
    await service.record({ costMicroUsd: 2300, status: "REPAIRED" });

    await expect(service.getDailyAggregate()).resolves.toBe(3800);
    expect(logSpy).toHaveBeenCalledTimes(2);
  });

  it("still logs a zero-cost run but leaves the aggregate unchanged", async () => {
    const { service, redis } = buildService();
    const now = new Date("2026-07-12T10:00:00Z");

    await service.record({ costMicroUsd: 1500, status: "OK" }, now);
    await service.record({ costMicroUsd: 0, status: "SAFE_FALLBACK" }, now);

    await expect(service.getDailyAggregate(now)).resolves.toBe(1500);
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(redis.incrBy).toHaveBeenCalledTimes(1);
  });

  it("sets the daily aggregate TTL only on the first write of the day", async () => {
    const { service, redis } = buildService();
    const now = new Date("2026-07-12T10:00:00Z");

    await service.record({ costMicroUsd: 1000 }, now);
    expect(redis.expire).toHaveBeenCalledTimes(1);
    expect(redis.expire).toHaveBeenCalledWith(expect.any(String), COST_AGGREGATE_TTL_SECONDS);

    await service.record({ costMicroUsd: 1000 }, now);
    expect(redis.expire).toHaveBeenCalledTimes(1);
  });

  it("returns 0 when no aggregate exists for the day", async () => {
    const { service } = buildService();

    await expect(service.getDailyAggregate()).resolves.toBe(0);
  });

  it("keeps separate days in separate aggregates", async () => {
    const { service } = buildService();
    const day1 = new Date("2026-07-12T10:00:00Z");
    const day2 = new Date("2026-07-13T10:00:00Z");

    await service.record({ costMicroUsd: 1000 }, day1);
    await service.record({ costMicroUsd: 2000 }, day2);

    await expect(service.getDailyAggregate(day1)).resolves.toBe(1000);
    await expect(service.getDailyAggregate(day2)).resolves.toBe(2000);
  });
});
