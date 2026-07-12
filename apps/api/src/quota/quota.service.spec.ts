import type { RedisService } from "../redis/redis.service";
import { StaticEntitlementResolver } from "./entitlement";
import { QuotaService } from "./quota.service";
import type { Entitlement } from "./quota.types";

const FREE: Entitlement = { tier: "FREE", bypassQuota: false };
const PREMIUM: Entitlement = { tier: "PREMIUM", bypassQuota: false };
const PREMIUM_BYPASS: Entitlement = { tier: "PREMIUM", bypassQuota: true };

function buildService() {
  const store = new Map<string, number>();
  const redis = {
    incr: jest.fn(async (key: string) => {
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    }),
    expire: jest.fn(async () => undefined),
  } as unknown as RedisService;

  return { service: new QuotaService(redis), redis, store };
}

describe("QuotaService.consume", () => {
  it("allows under-limit consumes with decreasing remaining (FREE foodLookups)", async () => {
    const { service } = buildService();

    for (let i = 1; i <= 4; i += 1) {
      const result = await service.consume("u1", "foodLookups", FREE);
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(i);
      expect(result.remaining).toBe(5 - i);
    }
  });

  it("allows the exact boundary call and rejects the next one (FREE foodLookups, limit 5)", async () => {
    const { service } = buildService();

    for (let i = 1; i <= 4; i += 1) {
      await service.consume("u1", "foodLookups", FREE);
    }

    const fifth = await service.consume("u1", "foodLookups", FREE);
    expect(fifth).toMatchObject({ allowed: true, used: 5, remaining: 0 });

    const sixth = await service.consume("u1", "foodLookups", FREE);
    expect(sixth).toMatchObject({ allowed: false, used: 6 });
  });

  it("enforces the FREE checks total limit of 1", async () => {
    const { service } = buildService();

    const first = await service.consume("u1", "checks", FREE);
    expect(first).toMatchObject({ allowed: true, used: 1, window: "total", limit: 1 });

    const second = await service.consume("u1", "checks", FREE);
    expect(second).toMatchObject({ allowed: false, used: 2 });
  });

  it("keeps daily and monthly windows independent (distinct keys, distinct counts)", async () => {
    const { service, redis } = buildService();
    const now = new Date("2026-07-12T10:00:00Z");

    await service.consume("u1", "foodLookups", FREE, now);
    await service.consume("u1", "checks", PREMIUM, now);

    const keys = (redis.incr as jest.Mock).mock.calls.map(([key]: [string]) => key);
    expect(keys).toEqual([
      "pawcareright:quota:foodLookups:day:u1:2026-07-12",
      "pawcareright:quota:checks:month:u1:2026-07",
    ]);
  });

  it("rolls over the daily window at UTC midnight (FREE foodLookups)", async () => {
    const { service } = buildService();
    const day1 = new Date("2026-07-12T23:00:00Z");
    const day2 = new Date("2026-07-13T00:00:00Z");

    for (let i = 0; i < 5; i += 1) {
      await service.consume("u1", "foodLookups", FREE, day1);
    }
    const sixth = await service.consume("u1", "foodLookups", FREE, day1);
    expect(sixth.allowed).toBe(false);

    const nextDay = await service.consume("u1", "foodLookups", FREE, day2);
    expect(nextDay).toMatchObject({ allowed: true, used: 1 });
  });

  it("rolls over the monthly window (PREMIUM checks)", async () => {
    const { service } = buildService();
    const july = new Date("2026-07-15T00:00:00Z");
    const august = new Date("2026-08-01T00:00:00Z");

    for (let i = 0; i < 30; i += 1) {
      await service.consume("u1", "checks", PREMIUM, july);
    }
    const exceeded = await service.consume("u1", "checks", PREMIUM, july);
    expect(exceeded.allowed).toBe(false);

    const nextMonth = await service.consume("u1", "checks", PREMIUM, august);
    expect(nextMonth).toMatchObject({ allowed: true, used: 1 });
  });

  it("bypasses quota entirely when bypassQuota is true, without calling redis.incr", async () => {
    const { service, redis } = buildService();

    const result = await service.consume("u1", "checks", PREMIUM_BYPASS);

    expect(result).toEqual({
      allowed: true,
      metric: "checks",
      window: "month",
      limit: 30,
      used: 0,
      remaining: null,
      unlimited: true,
    });
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it("bypasses quota for an unlimited metric (PREMIUM foodLookups), without calling redis.incr", async () => {
    const { service, redis } = buildService();

    const result = await service.consume("u1", "foodLookups", PREMIUM);

    expect(result).toEqual({
      allowed: true,
      metric: "foodLookups",
      window: "day",
      limit: null,
      used: 0,
      remaining: null,
      unlimited: true,
    });
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it("keeps metrics independent for the same user", async () => {
    const { service } = buildService();

    await service.consume("u1", "checks", FREE);
    const foodLookups = await service.consume("u1", "foodLookups", FREE);

    expect(foodLookups).toMatchObject({ used: 1 });
  });

  it("keeps users isolated from each other", async () => {
    const { service } = buildService();

    await service.consume("userA", "checks", FREE);
    const rejectedForA = await service.consume("userA", "checks", FREE);
    const allowedForB = await service.consume("userB", "checks", FREE);

    expect(rejectedForA.allowed).toBe(false);
    expect(allowedForB).toMatchObject({ allowed: true, used: 1 });
  });

  it("sets the TTL once, only on the first write of a day-windowed metric", async () => {
    const { service, redis } = buildService();

    await service.consume("u1", "foodLookups", FREE);
    expect(redis.expire).toHaveBeenCalledTimes(1);
    expect(redis.expire).toHaveBeenCalledWith(expect.any(String), 172_800);

    await service.consume("u1", "foodLookups", FREE);
    expect(redis.expire).toHaveBeenCalledTimes(1);
  });

  it("never sets a TTL for a total-windowed metric (FREE checks)", async () => {
    const { service, redis } = buildService();

    await service.consume("u1", "checks", FREE);
    await service.consume("u1", "checks", FREE);

    expect(redis.expire).not.toHaveBeenCalled();
  });
});

describe("StaticEntitlementResolver", () => {
  it("resolves everyone to FREE with no bypass", async () => {
    const resolver = new StaticEntitlementResolver();

    await expect(resolver.resolve("u1")).resolves.toEqual({ tier: "FREE", bypassQuota: false });
  });
});
