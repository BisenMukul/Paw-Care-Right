import type { AnalyticsEventName } from "../events";

/**
 * T103 -- pure PostHog saved-insight + dashboard payload builders (plan D1).
 * No I/O, no `fetch`, no `process`: `apps/api/scripts/provision-posthog-dashboards.ts`
 * owns env reading, the HTTP upsert flow and exit codes; this module only
 * shapes the payloads it sends.
 *
 * NO event name may be invented here: every step below is typed against
 * `AnalyticsEventName` (plan D2), the exact, closed union declared in
 * `../events.ts` (PRODUCT_SPEC §8: "PostHog events locked at T078"). An
 * unknown event name is a `tsc` compile error, and `posthog-insights.spec.ts`
 * additionally re-parses `events.ts`'s source text to guard against the
 * union itself silently widening.
 *
 * The card's funnel wording implies steps this app does not track yet
 * (an activation-entry event, `trial_to_paid`, an `app_open` event) -- see
 * `UNTRACKED_FUNNEL_GAPS` below and `docs/observability-dashboards.md` §3.
 * Those names are NEVER referenced by any builder; they exist only as a
 * documented, tested gap.
 *
 * The `query` shape below follows PostHog's node-based insight query schema
 * (TrendsQuery/FunnelsQuery/RetentionQuery). This schema is version-sensitive
 * (plan R2) -- `--dry-run` always prints the exact payload for founder review
 * before any write, and a 400 from a live project should be diagnosed by
 * pasting the payload into PostHog's insight "edit as JSON" panel.
 */

export const DASHBOARD_NAME = "Bombay Pet Company — Activation & Retention";
export const ACTIVATION_INSIGHT_NAME = "Activation: first_check_completed (trend)";
export const PAYWALL_INSIGHT_NAME = "Paywall funnel: paywall_view -> trial_start";
export const RETENTION_INSIGHT_NAME = "Retention: first_check_completed (weekly)";

export interface TrendsSeriesNode {
  kind: "EventsNode";
  event: AnalyticsEventName;
  math: "dau";
}

export interface TrendsBreakdownFilter {
  breakdown_type: "event";
  breakdown: string;
}

export interface TrendsQuery {
  kind: "TrendsQuery";
  series: readonly [TrendsSeriesNode];
  breakdownFilter: TrendsBreakdownFilter;
  dateRange: { date_from: string };
}

export interface FunnelStepNode {
  kind: "EventsNode";
  event: AnalyticsEventName;
  order: number;
}

export interface FunnelsQuery {
  kind: "FunnelsQuery";
  series: readonly FunnelStepNode[];
}

export interface RetentionEntityNode {
  kind: "EventsNode";
  event: AnalyticsEventName;
}

export interface RetentionFilter {
  targetEntity: RetentionEntityNode;
  returningEntity: RetentionEntityNode;
  period: "Week";
  totalIntervals: number;
}

export interface RetentionQuery {
  kind: "RetentionQuery";
  retentionFilter: RetentionFilter;
}

export type InsightQuery = TrendsQuery | FunnelsQuery | RetentionQuery;

export interface InsightPayload {
  name: string;
  description: string;
  query: InsightQuery;
}

export interface DashboardPayload {
  name: string;
  description: string;
  tags: readonly string[];
}

/**
 * Gap G1 (`docs/observability-dashboards.md` §3): no install/signup/
 * pet_created event exists and there is no autocapture (no posthog SDK, see
 * `../http-transport.ts`), so this ships as a TRENDS insight over
 * `first_check_completed` (unique users, broken down by `status`) rather
 * than an entry->activation funnel.
 */
export function buildActivationInsight(): InsightPayload {
  return {
    name: ACTIVATION_INSIGHT_NAME,
    description:
      "Proxy activation trend (gap G1, see docs/observability-dashboards.md §3): unique users completing first_check_completed per day over the trailing 30 days, broken down by status. NOT an entry->activation funnel -- no activation-entry event is tracked yet.",
    query: {
      kind: "TrendsQuery",
      series: [{ kind: "EventsNode", event: "first_check_completed", math: "dau" }],
      breakdownFilter: { breakdown_type: "event", breakdown: "status" },
      dateRange: { date_from: "-30d" },
    },
  };
}

/**
 * Gap G2: `trial_to_paid` is not tracked (`rc-webhook.service.ts` emits only
 * `trial_start`), so this ships as the real 2-step funnel PRODUCT_SPEC §8
 * describes as the first half of conversion (target >=8%).
 */
export function buildPaywallFunnelInsight(): InsightPayload {
  return {
    name: PAYWALL_INSIGHT_NAME,
    description:
      "Conversion funnel (SPEC §8 target >=8%): paywall_view -> trial_start. Gap G2, see docs/observability-dashboards.md §3: the third conversion step is not tracked, so this funnel stops at 2 steps.",
    query: {
      kind: "FunnelsQuery",
      series: [
        { kind: "EventsNode", event: "paywall_view", order: 0 },
        { kind: "EventsNode", event: "trial_start", order: 1 },
      ],
    },
  };
}

/**
 * Gap G3: no `app_open` event exists, so `first_check_completed` is used as
 * BOTH the target and the returning entity -- a proxy for engagement, NOT
 * D1/D7/D30 app-open retention.
 */
export function buildRetentionInsight(): InsightPayload {
  return {
    name: RETENTION_INSIGHT_NAME,
    description:
      "Proxy retention cohort (gap G3, see docs/observability-dashboards.md §3): first_check_completed used as BOTH target and returning event, weekly, 8 periods. NOT D1/D7/D30 app-open retention -- no app-open event is tracked yet.",
    query: {
      kind: "RetentionQuery",
      retentionFilter: {
        targetEntity: { kind: "EventsNode", event: "first_check_completed" },
        returningEntity: { kind: "EventsNode", event: "first_check_completed" },
        period: "Week",
        totalIntervals: 8,
      },
    },
  };
}

export function buildDashboardPayload(): DashboardPayload {
  return {
    name: DASHBOARD_NAME,
    description:
      "Activation, paywall conversion and retention saved insights (T103). See docs/observability-dashboards.md for gaps G1-G3 and the manual verification steps.",
    tags: ["bombaypetcompany", "t103"],
  };
}

/** Every event name any insight above references, typed against `AnalyticsEventName` (plan D2). */
export const FUNNEL_STEP_EVENTS: readonly AnalyticsEventName[] = [
  "first_check_completed",
  "paywall_view",
  "trial_start",
];

export interface UntrackedFunnelGap {
  id: "G1" | "G2" | "G3";
  /** Deliberately a plain `string`, NOT `AnalyticsEventName` -- this name does not exist in `AnalyticsEventMap` and MUST NOT be referenced by any builder above. */
  missingEvent: string;
  impact: string;
}

/** §0 S6 gap analysis, made a first-class tested artefact (plan "Why the gaps are documented and not closed here"). */
export const UNTRACKED_FUNNEL_GAPS: readonly UntrackedFunnelGap[] = [
  {
    id: "G1",
    missingEvent: "signup_completed",
    impact:
      "No activation-entry event (signup_completed / pet_created / install) exists; the activation insight ships as a TRENDS insight over first_check_completed rather than an entry->activation funnel.",
  },
  {
    id: "G2",
    missingEvent: "trial_to_paid",
    impact:
      "The paywall funnel stops at trial_start (2 steps) instead of the full paywall_view -> trial_start -> trial_to_paid conversion funnel PRODUCT_SPEC §8 describes.",
  },
  {
    id: "G3",
    missingEvent: "app_open",
    impact:
      "No app-open event exists; the retention cohort uses first_check_completed as a proxy for both target and returning entity instead of D1/D7/D30 app-open retention.",
  },
];
