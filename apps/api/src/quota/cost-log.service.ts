import { Injectable, Logger } from "@nestjs/common";

import { RedisService } from "../redis/redis.service";
import { COST_AGGREGATE_TTL_SECONDS } from "./quota.constants";
import { costDailyKey } from "./quota.util";
import type { CostLogEntry } from "./quota.types";

/**
 * Per-run cost logging + a global daily-aggregate Redis counter (T039). This
 * IS the "metric hook" a later sink (PostHog/T078) reads — no sink
 * abstraction is built here (would be over-engineering, CLAUDE §2 rule 2).
 */
@Injectable()
export class CostLogService {
  private readonly logger = new Logger(CostLogService.name);

  constructor(private readonly redis: RedisService) {}

  async record(entry: CostLogEntry, now: Date = new Date()): Promise<void> {
    // A run is always logged, even when cost is 0 (SAFE_FALLBACK / no provider usage).
    this.logger.log({ event: "ai_cost", ...entry });

    const micro = Math.max(0, Math.round(entry.costMicroUsd));
    if (micro === 0) {
      return;
    }

    const key = costDailyKey(now);
    const total = await this.redis.incrBy(key, micro);

    if (total === micro) {
      await this.redis.expire(key, COST_AGGREGATE_TTL_SECONDS);
    }
  }

  async getDailyAggregate(now: Date = new Date()): Promise<number> {
    const raw = await this.redis.get(costDailyKey(now));
    return raw === null ? 0 : Number(raw);
  }
}
