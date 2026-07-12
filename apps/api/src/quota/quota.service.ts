import { Injectable } from "@nestjs/common";

import { RedisService } from "../redis/redis.service";
import { QUOTA_TTL_SECONDS } from "./quota.constants";
import { quotaKey, resolveLimit } from "./quota.util";
import type { Entitlement, QuotaConsumeResult, QuotaMetric } from "./quota.types";

/**
 * Redis-backed per-user quota control (T039). Availability/cost control only
 * — NOT a PRODUCT_SPEC §5 safety surface. Never throws: HTTP/402 mapping and
 * emergency-before-quota ordering are T042's job (see plan risk notes).
 */
@Injectable()
export class QuotaService {
  constructor(private readonly redis: RedisService) {}

  async consume(
    userId: string,
    metric: QuotaMetric,
    entitlement: Entitlement,
    now: Date = new Date(),
  ): Promise<QuotaConsumeResult> {
    const { window, limit } = resolveLimit(entitlement.tier, metric);

    if (entitlement.bypassQuota || limit === null) {
      return { allowed: true, metric, window, limit, used: 0, remaining: null, unlimited: true };
    }

    const key = quotaKey(metric, window, userId, now);
    const used = await this.redis.incr(key);

    if (used === 1) {
      const ttl = QUOTA_TTL_SECONDS[window];
      if (ttl !== null) {
        await this.redis.expire(key, ttl);
      }
    }

    return {
      allowed: used <= limit,
      metric,
      window,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      unlimited: false,
    };
  }
}
