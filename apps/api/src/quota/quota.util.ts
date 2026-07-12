import { COST_DAILY_KEY_PREFIX, QUOTA_KEY_PREFIX, QUOTA_LIMITS } from "./quota.constants";
import type { EntitlementTier, QuotaLimit, QuotaMetric, QuotaWindow } from "./quota.types";

/** UTC, zero-padded. `total` has no calendar bucket — it is a single lifetime key. */
export function windowBucket(window: QuotaWindow, now: Date): string {
  if (window === "total") {
    return "all";
  }

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  if (window === "month") {
    return `${year}-${month}`;
  }

  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** `pawcareright:quota:{metric}:{window}:{userId}:{bucket}` */
export function quotaKey(metric: QuotaMetric, window: QuotaWindow, userId: string, now: Date): string {
  return `${QUOTA_KEY_PREFIX}${metric}:${window}:${userId}:${windowBucket(window, now)}`;
}

/** `pawcareright:cost:daily:{YYYY-MM-DD}` (UTC, global — not per-user). */
export function costDailyKey(now: Date): string {
  return `${COST_DAILY_KEY_PREFIX}${windowBucket("day", now)}`;
}

/** SPEC §7/F8-verbatim `{ window, limit }` for a tier x metric pair. */
export function resolveLimit(tier: EntitlementTier, metric: QuotaMetric): QuotaLimit {
  return QUOTA_LIMITS[tier][metric];
}
