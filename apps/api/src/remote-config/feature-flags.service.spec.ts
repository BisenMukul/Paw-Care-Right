import type { AppConfigService } from "../config/app-config.service";
import type { RedisService } from "../redis/redis.service";
import { FeatureFlagsService, FLAG_CACHE_TTL_MS } from "./feature-flags.service";

/**
 * Direct-construct unit tests (mirrors `redis.service.spec.ts` / T106 plan
 * Step 4): a fake `RedisService` (plain object with a `jest.fn()` `get`)
 * and a fake `AppConfigService`. Covers D2 (resolution order), D4 (5s
 * in-process cache + sticky-last-known on a Redis error).
 */
describe("FeatureFlagsService", () => {
  function buildService(getImpl: jest.Mock, envDefaults: { checks: boolean; chat: boolean; paywall: boolean }) {
    const redis = { get: getImpl } as unknown as RedisService;
    const appConfig = {
      featureChecksDefault: envDefaults.checks,
      featureChatDefault: envDefaults.chat,
      featurePaywallDefault: envDefaults.paywall,
    } as unknown as AppConfigService;

    return new FeatureFlagsService(redis, appConfig);
  }

  const ALL_ON = { checks: true, chat: true, paywall: true };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-29T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("env default on + no Redis key ⇒ enabled", async () => {
    const get = jest.fn().mockResolvedValue(null);
    const service = buildService(get, ALL_ON);

    await expect(service.isEnabled("checks")).resolves.toBe(true);
  });

  it("Redis \"off\" ⇒ disabled, even with an env default of on", async () => {
    const get = jest.fn().mockResolvedValue("off");
    const service = buildService(get, ALL_ON);

    await expect(service.isEnabled("checks")).resolves.toBe(false);
  });

  it("Redis \"on\" overrides an env default of off ⇒ enabled", async () => {
    const get = jest.fn().mockResolvedValue("on");
    const service = buildService(get, { ...ALL_ON, checks: false });

    await expect(service.isEnabled("checks")).resolves.toBe(true);
  });

  it("an unknown Redis value ⇒ falls back to the env default", async () => {
    const get = jest.fn().mockResolvedValue("banana");
    const service = buildService(get, { ...ALL_ON, checks: false });

    await expect(service.isEnabled("checks")).resolves.toBe(false);
  });

  it("a second call within the cache TTL does not re-hit Redis", async () => {
    const get = jest.fn().mockResolvedValue("off");
    const service = buildService(get, ALL_ON);

    await service.isEnabled("checks");
    await service.isEnabled("checks");

    expect(get).toHaveBeenCalledTimes(1);
  });

  it("a call after the TTL elapses re-hits Redis", async () => {
    const get = jest.fn().mockResolvedValue("off");
    const service = buildService(get, ALL_ON);

    await service.isEnabled("checks");
    jest.setSystemTime(new Date(Date.now() + FLAG_CACHE_TTL_MS + 1));
    await service.isEnabled("checks");

    expect(get).toHaveBeenCalledTimes(2);
  });

  it("a flag flipped in Redis mid-run is picked up after the TTL elapses — NO service restart / no new instance (D2/D4 runtime-toggle proof)", async () => {
    // The exact mechanism the operator relies on: `redis-cli SET
    // bombaypetcompany:flags:checks off` mid-incident, then `DEL` to
    // restore — all against this SAME, already-running `FeatureFlagsService`
    // instance (mirrors a live app process: no redeploy, no restart).
    const get = jest.fn().mockResolvedValueOnce("on").mockResolvedValueOnce("off").mockResolvedValueOnce(null);
    const service = buildService(get, ALL_ON);

    // Before the operator does anything: Redis has no override, but this
    // first read establishes the process's cache at "on" (matches env default).
    await expect(service.isEnabled("checks")).resolves.toBe(true);

    // Operator kills it (`SET ... off`, no TTL, D3) — invisible to this
    // process until its 5s cache expires.
    jest.setSystemTime(new Date(Date.now() + FLAG_CACHE_TTL_MS + 1));
    await expect(service.isEnabled("checks")).resolves.toBe(false);

    // Operator restores it (`DEL ...`, D3) — again invisible until the
    // cache expires; the SAME service instance, SAME process, picks up the
    // restored value with no restart.
    jest.setSystemTime(new Date(Date.now() + FLAG_CACHE_TTL_MS + 1));
    await expect(service.isEnabled("checks")).resolves.toBe(true);

    expect(get).toHaveBeenCalledTimes(3);
  });

  it("Redis throws after a successful \"off\" read ⇒ stays disabled (sticky last-known)", async () => {
    const get = jest.fn().mockResolvedValueOnce("off").mockRejectedValueOnce(new Error("ECONNRESET"));
    const service = buildService(get, ALL_ON);

    await service.isEnabled("checks");
    jest.setSystemTime(new Date(Date.now() + FLAG_CACHE_TTL_MS + 1));

    await expect(service.isEnabled("checks")).resolves.toBe(false);
  });

  it("Redis throws with no prior successful read ⇒ falls back to the env default", async () => {
    const get = jest.fn().mockRejectedValue(new Error("ECONNRESET"));
    const service = buildService(get, { ...ALL_ON, checks: false });

    await expect(service.isEnabled("checks")).resolves.toBe(false);
  });

  it("getAll resolves all three flags", async () => {
    const get = jest.fn().mockImplementation((key: string) => {
      if (key.endsWith(":checks")) return Promise.resolve("off");
      return Promise.resolve(null);
    });
    const service = buildService(get, ALL_ON);

    await expect(service.getAll()).resolves.toEqual({ checks: false, chat: true, paywall: true });
  });
});
