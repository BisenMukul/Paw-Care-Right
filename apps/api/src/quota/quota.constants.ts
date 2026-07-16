import type { EntitlementTier, QuotaLimit, QuotaMetric, QuotaWindow } from "./quota.types";

export const QUOTA_KEY_PREFIX = "pawcareright:quota:";

export const COST_DAILY_KEY_PREFIX = "pawcareright:cost:daily:";

/** Seconds; null = persistent (no expire call). */
export const QUOTA_TTL_SECONDS: Record<QuotaWindow, number | null> = {
  day: 172_800, // 48h — margin past the UTC midnight rollover + auto-cleanup
  month: 3_456_000, // 40d — longest month + margin
  total: null, // persistent; SPEC §7 "counters survive reinstall"
};

/** 35d, so a monthly metrics job/admin can read the daily cost aggregate. */
export const COST_AGGREGATE_TTL_SECONDS = 3_024_000;

/**
 * SPEC §7/F8 numbers verbatim:
 * "Free tier: 1 pet · 1 symptom check total · 5 food lookups/day"
 * "Premium: unlimited pets · unlimited checks (fair-use 30/mo) · unlimited lookups"
 */
export const QUOTA_LIMITS: Record<EntitlementTier, Record<QuotaMetric, QuotaLimit>> = {
  FREE: {
    checks: { window: "total", limit: 1 },
    foodLookups: { window: "day", limit: 5 },
  },
  PREMIUM: {
    checks: { window: "month", limit: 30 },
    foodLookups: { window: "day", limit: null },
  },
};

/** SPEC §7/F8 verbatim: "Free tier: 1 pet". Household-scoped (T075). */
export const FREE_MAX_PETS = 1;
