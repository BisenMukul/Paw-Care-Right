import type { Breed } from "@pawcareright/data";

import type { RedisService } from "../redis/redis.service";
import { BreedsService } from "./breeds.service";

/**
 * `searchBreeds` and `normalize` are pure and already fully covered by
 * `packages/data`'s own dataset/search specs (incl. the `gsd` ranking case).
 * These tests instead cover what `BreedsService` itself owns: delegating to
 * the matcher with a normalized query, and the two-layer (L1 in-memory / L2
 * Redis) cache orchestration around it — including graceful degradation
 * when Redis fails (ARCHITECTURE §8).
 */
describe("BreedsService", () => {
  function buildRedis(overrides: { get?: jest.Mock; set?: jest.Mock } = {}): {
    redis: RedisService;
    get: jest.Mock;
    set: jest.Mock;
  } {
    const get = overrides.get ?? jest.fn().mockResolvedValue(null);
    const set = overrides.set ?? jest.fn().mockResolvedValue(undefined);
    const redis = { get, set } as unknown as RedisService;
    return { redis, get, set };
  }

  describe("matcher delegation", () => {
    it("DOG species + gsd query → first result is german-shepherd (delegates to searchBreeds)", async () => {
      const { redis } = buildRedis();
      const service = new BreedsService(redis);

      const results = await service.search("DOG", "gsd");

      expect(results[0]?.slug).toBe("german-shepherd");
    });

    it("species filter: CAT species never returns a dog-only breed", async () => {
      const { redis } = buildRedis();
      const service = new BreedsService(redis);

      const results = await service.search("CAT", undefined);

      expect(results.every((b: Breed) => b.species === "CAT")).toBe(true);
      expect(results.some((b: Breed) => b.slug === "german-shepherd")).toBe(false);
    });

    it("q normalization: mixed case + surrounding whitespace still matches (delegated through normalize)", async () => {
      const { redis } = buildRedis();
      const service = new BreedsService(redis);

      const results = await service.search("DOG", "  GsD  ");

      expect(results[0]?.slug).toBe("german-shepherd");
    });

    it("undefined q behaves like an empty query (full sorted pool)", async () => {
      const { redis } = buildRedis();
      const service = new BreedsService(redis);

      const results = await service.search("DOG", undefined);

      const names = results.map((b: Breed) => b.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
      expect(results.length).toBeGreaterThan(20);
    });
  });

  describe("cache orchestration", () => {
    it("L1+L2 miss: computes via the matcher, writes through to Redis, and returns the correct results", async () => {
      const { redis, get, set } = buildRedis();
      const service = new BreedsService(redis);

      const results = await service.search("DOG", "gsd");

      expect(results[0]?.slug).toBe("german-shepherd");
      expect(get).toHaveBeenCalledTimes(1);
      expect(set).toHaveBeenCalledTimes(1);
      const [key, value, ttl] = set.mock.calls[0] as [string, string, number];
      expect(key).toBe("pawcareright:breeds:DOG:gsd");
      expect(JSON.parse(value)).toEqual(results);
      expect(ttl).toBe(3600);
    });

    it("second identical call on the same instance is served from L1 — redis.get is not called again", async () => {
      const { redis, get } = buildRedis();
      const service = new BreedsService(redis);

      const first = await service.search("DOG", "gsd");
      expect(get).toHaveBeenCalledTimes(1);

      const second = await service.search("DOG", "gsd");

      expect(get).toHaveBeenCalledTimes(1);
      expect(second).toEqual(first);
    });

    it("L2 hit: a fresh service instance returns whatever Redis has cached, without recomputing", async () => {
      const cachedSentinel = [
        { slug: "sentinel-cached-breed", name: "Sentinel Cached Breed", species: "DOG" },
      ];
      const { redis, set } = buildRedis({
        get: jest.fn().mockResolvedValue(JSON.stringify(cachedSentinel)),
      });
      const service = new BreedsService(redis);

      const results = await service.search("DOG", "gsd");

      expect(results).toEqual(cachedSentinel);
      expect(set).not.toHaveBeenCalled();
    });

    it("redis.get throwing is swallowed — request is still served from the computed results", async () => {
      const { redis, set } = buildRedis({
        get: jest.fn().mockRejectedValue(new Error("redis down")),
      });
      const service = new BreedsService(redis);

      const results = await service.search("DOG", "gsd");

      expect(results[0]?.slug).toBe("german-shepherd");
      expect(set).toHaveBeenCalledTimes(1);
    });

    it("redis.set throwing is swallowed — the computed results are still returned (and L1 is still populated)", async () => {
      const { redis, get } = buildRedis({
        set: jest.fn().mockRejectedValue(new Error("redis down")),
      });
      const service = new BreedsService(redis);

      const results = await service.search("DOG", "gsd");

      expect(results[0]?.slug).toBe("german-shepherd");

      // L1 must have been populated despite the Redis SET failure: a second
      // call never re-hits redis.get.
      const second = await service.search("DOG", "gsd");
      expect(get).toHaveBeenCalledTimes(1);
      expect(second).toEqual(results);
    });

    it("both redis.get and redis.set throwing: still degrades gracefully to computed results", async () => {
      const { redis } = buildRedis({
        get: jest.fn().mockRejectedValue(new Error("redis down")),
        set: jest.fn().mockRejectedValue(new Error("redis down")),
      });
      const service = new BreedsService(redis);

      const results = await service.search("DOG", "gsd");

      expect(results[0]?.slug).toBe("german-shepherd");
    });
  });
});
