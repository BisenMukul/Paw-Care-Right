/**
 * Quota + cost-logging types (T039). Availability/cost controls only — NOT a
 * PRODUCT_SPEC §5 safety surface. See `quota.service.ts` / `cost-log.service.ts`
 * for the semantics these types back.
 */

export type EntitlementTier = "FREE" | "PREMIUM";

export type QuotaMetric = "checks" | "foodLookups";

export type QuotaWindow = "day" | "month" | "total";

export interface QuotaLimit {
  window: QuotaWindow;
  /** null = unlimited. */
  limit: number | null;
}

export interface Entitlement {
  tier: EntitlementTier;
  bypassQuota: boolean;
}

export interface QuotaConsumeResult {
  allowed: boolean;
  metric: QuotaMetric;
  window: QuotaWindow;
  /** null = unlimited. */
  limit: number | null;
  /** Count AFTER this consume; 0 when unlimited/bypass. */
  used: number;
  /** null = unlimited. */
  remaining: number | null;
  unlimited: boolean;
}

export interface CostLogEntry {
  costMicroUsd: number;
  latencyMs?: number;
  model?: string;
  /** e.g. "OK" | "REPAIRED" | "SAFE_FALLBACK" */
  status?: string;
  userId?: string;
  checkId?: string;
}
