import { Injectable, Logger } from "@nestjs/common";

import { captureApiMessage } from "../observability/sentry";
import { RedisService } from "../redis/redis.service";
import { ABUSE_WINDOW_TTL_SECONDS, CHECKS_PER_HOUR_ALERT_THRESHOLD } from "./abuse.constants";
import { checksPerHourKey, hourBucket } from "./abuse.util";

/**
 * Checks/user/hour anomaly counter (T090 plan §2.2 — PRODUCT_SPEC §5
 * compensating control for the `@SkipThrottle()`d check routes,
 * `checks.controller.ts`). ALERT-ONLY: `recordCheck` returns `Promise<void>`
 * — there is no boolean, no throw, no HTTP mapping. This method is
 * structurally incapable of blocking a request; the whole body is wrapped
 * in its own try/catch (mirrors `AnalyticsService.capture`), so a Redis
 * outage can never propagate into the caller (`ChecksService.create`).
 */
@Injectable()
export class AnomalyService {
  private readonly logger = new Logger(AnomalyService.name);

  constructor(private readonly redis: RedisService) {}

  async recordCheck(userId: string, now: Date = new Date()): Promise<void> {
    try {
      const key = checksPerHourKey(userId, now);
      const count = await this.redis.incr(key);

      if (count === 1) {
        await this.redis.expire(key, ABUSE_WINDOW_TTL_SECONDS);
      }

      // Strict equality (not `>=`) so exactly ONE alert fires per user per
      // hour bucket — no alert storm on every subsequent check that hour.
      if (count === CHECKS_PER_HOUR_ALERT_THRESHOLD) {
        const bucket = hourBucket(now);
        this.logger.warn({
          event: "abuse_anomaly",
          metric: "checks_per_hour",
          userId,
          count,
          threshold: CHECKS_PER_HOUR_ALERT_THRESHOLD,
          bucket,
        });
        captureApiMessage("abuse_anomaly: checks_per_hour threshold exceeded", {
          metric: "checks_per_hour",
          userId,
          count: String(count),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn({ event: "abuse_anomaly_failed", userId, message });
    }
  }
}
