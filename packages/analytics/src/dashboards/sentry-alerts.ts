/**
 * T103 -- pure Sentry alert-rule payload builder (plan D1/D9). No I/O:
 * `apps/api/scripts/provision-sentry-alerts.ts` owns env reading, the HTTP
 * upsert flow and exit codes.
 *
 * Builds a metric alert rule ("crash-free session rate < 99% (warn)") for
 * `POST/PUT /api/0/organizations/{org}/alert-rules/`. Never carries a
 * credential -- the caller attaches the `Authorization` header itself.
 * `triggers[0].actions` is intentionally an empty array: the founder attaches
 * a notification target (email/Slack) in the Sentry UI as a one-time manual
 * step (`[FOUNDER-4]`, `docs/observability-dashboards.md` §6).
 */

export const CRASH_FREE_ALERT_NAME = "Crash-free session rate < 99% (warn)";

export interface CrashFreeAlertTrigger {
  label: "warning";
  alertThreshold: number;
  resolveThreshold: number;
  actions: readonly never[];
}

export interface CrashFreeAlertRulePayload {
  name: string;
  dataset: "metrics";
  aggregate: string;
  thresholdType: 1;
  timeWindow: 60;
  environment: string;
  projects: readonly string[];
  triggers: readonly CrashFreeAlertTrigger[];
}

export function buildCrashFreeAlertRule(input: { projectSlug: string; environment: string }): CrashFreeAlertRulePayload {
  return {
    name: CRASH_FREE_ALERT_NAME,
    dataset: "metrics",
    aggregate: "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
    thresholdType: 1,
    timeWindow: 60,
    environment: input.environment,
    projects: [input.projectSlug],
    triggers: [{ label: "warning", alertThreshold: 99, resolveThreshold: 99.5, actions: [] }],
  };
}
