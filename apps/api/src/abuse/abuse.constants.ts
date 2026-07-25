/**
 * Checks/user/hour anomaly-counter constants (T090 plan §2.2). This is an
 * ALERT line, not a BLOCK line (PRODUCT_SPEC §5 — see `AnomalyService`):
 * the symptom-check routes are deliberately `@SkipThrottle()`d
 * (`common/throttle.config.ts`), so this counter is the only per-user abuse
 * signal on that surface, and it only ever logs/alerts.
 */

/** Redis key prefix for every key this module writes. */
export const ABUSE_KEY_PREFIX = "pawcareright:abuse:";

/**
 * 20 checks/hour by one user is roughly 10x the plausible human rate for a
 * symptom-check flow that requires filling out a per-check intake form — an
 * *alert* line, not a *block* line.
 */
export const CHECKS_PER_HOUR_ALERT_THRESHOLD = 20;

/** 2h — covers the hour bucket plus rollover margin. */
export const ABUSE_WINDOW_TTL_SECONDS = 7200;
