import { Injectable, Logger } from "@nestjs/common";
import { normalize, searchBreeds, type Breed, type BreedSpecies } from "@pawcareright/data";

import { RedisService } from "../redis/redis.service";

const CACHE_TTL_SECONDS = 3600;
const L1_MAX_ENTRIES = 1000;

/**
 * Two-layer cache in front of the pure, in-memory `searchBreeds` matcher:
 *   L1 — a per-instance `Map`, bounded to `L1_MAX_ENTRIES` (oldest evicted).
 *   L2 — Redis, TTL `CACHE_TTL_SECONDS`, best-effort: any Redis failure is
 *        logged and swallowed so an outage degrades gracefully rather than
 *        breaking the request (ARCHITECTURE §8).
 */
@Injectable()
export class BreedsService {
  private readonly logger = new Logger(BreedsService.name);
  private readonly l1 = new Map<string, Breed[]>();

  constructor(private readonly redis: RedisService) {}

  async search(species: BreedSpecies, q: string | undefined): Promise<Breed[]> {
    const nq = normalize(q ?? "");
    const memKey = `${species}:${nq}`;

    const l1Hit = this.l1.get(memKey);
    if (l1Hit) {
      return l1Hit;
    }

    const redisKey = `pawcareright:breeds:${species}:${nq === "" ? "_all" : nq.replace(/\s+/g, "_")}`;

    try {
      const cached = await this.redis.get(redisKey);
      if (cached) {
        const parsed = JSON.parse(cached) as Breed[];
        this.setL1(memKey, parsed);
        return parsed;
      }
    } catch (error) {
      this.logger.warn(`Redis GET failed for ${redisKey}: ${String(error)}`);
    }

    const results = searchBreeds(species, q ?? "");

    try {
      await this.redis.set(redisKey, JSON.stringify(results), CACHE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(`Redis SET failed for ${redisKey}: ${String(error)}`);
    }

    this.setL1(memKey, results);
    return results;
  }

  private setL1(key: string, value: Breed[]): void {
    if (this.l1.size > L1_MAX_ENTRIES) {
      const oldestKey = this.l1.keys().next().value;
      if (oldestKey !== undefined) {
        this.l1.delete(oldestKey);
      }
    }
    this.l1.set(key, value);
  }
}
