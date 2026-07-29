import * as fs from "node:fs";
import * as path from "node:path";

import {
  ACTIVATION_INSIGHT_NAME,
  DASHBOARD_NAME,
  FUNNEL_STEP_EVENTS,
  PAYWALL_INSIGHT_NAME,
  RETENTION_INSIGHT_NAME,
  UNTRACKED_FUNNEL_GAPS,
  buildActivationInsight,
  buildDashboardPayload,
  buildPaywallFunnelInsight,
  buildRetentionInsight,
} from "./posthog-insights";

const eventsPath = path.resolve(__dirname, "../events.ts");

/**
 * Source side of the drift guard: the `AnalyticsEventMap` interface body in
 * `events.ts` (store-privacy-doc.spec.ts idiom). A top-level event is a
 * `  name: {` line (2-space indent).
 */
function parseEventNames(source: string): Set<string> {
  const lines = source.split("\n");
  const startIndex = lines.findIndex((line) => line === "export interface AnalyticsEventMap {");
  if (startIndex === -1) {
    throw new Error("posthog-insights.spec: could not find 'export interface AnalyticsEventMap {' in events.ts");
  }
  const endIndex = lines.findIndex((line, index) => index > startIndex && line === "}");
  if (endIndex === -1) {
    throw new Error("posthog-insights.spec: could not find the closing '}' of AnalyticsEventMap in events.ts");
  }

  const names = new Set<string>();
  for (let i = startIndex + 1; i < endIndex; i += 1) {
    const match = /^ {2}(\w+): \{$/.exec(lines[i] as string);
    if (match) {
      names.add(match[1] as string);
    }
  }
  return names;
}

describe("posthog-insights (T103)", () => {
  it("names each insight and the dashboard with the committed upsert keys", () => {
    const names = [ACTIVATION_INSIGHT_NAME, PAYWALL_INSIGHT_NAME, RETENTION_INSIGHT_NAME, DASHBOARD_NAME];
    for (const name of names) {
      expect(name.length).toBeGreaterThan(0);
    }
    expect(new Set(names).size).toBe(names.length);

    expect(buildActivationInsight().name).toBe(ACTIVATION_INSIGHT_NAME);
    expect(buildPaywallFunnelInsight().name).toBe(PAYWALL_INSIGHT_NAME);
    expect(buildRetentionInsight().name).toBe(RETENTION_INSIGHT_NAME);
    expect(buildDashboardPayload().name).toBe(DASHBOARD_NAME);
  });

  it("builds the paywall funnel from paywall_view -> trial_start in that order", () => {
    const insight = buildPaywallFunnelInsight();
    if (insight.query.kind !== "FunnelsQuery") {
      throw new Error("expected a FunnelsQuery");
    }
    const steps = insight.query.series;
    expect(steps.map((step) => step.event)).toEqual(["paywall_view", "trial_start"]);
    expect(steps.map((step) => step.order)).toEqual([0, 1]);
  });

  it("builds the activation trends insight over first_check_completed broken down by status", () => {
    const insight = buildActivationInsight();
    if (insight.query.kind !== "TrendsQuery") {
      throw new Error("expected a TrendsQuery");
    }
    expect(insight.query.series[0].event).toBe("first_check_completed");
    expect(insight.query.series[0].math).toBe("dau");
    expect(insight.query.breakdownFilter.breakdown).toBe("status");
  });

  it("builds the retention insight with first_check_completed as target and returning entity", () => {
    const insight = buildRetentionInsight();
    if (insight.query.kind !== "RetentionQuery") {
      throw new Error("expected a RetentionQuery");
    }
    expect(insight.query.retentionFilter.targetEntity.event).toBe("first_check_completed");
    expect(insight.query.retentionFilter.returningEntity.event).toBe("first_check_completed");
    expect(insight.query.retentionFilter.period).toBe("Week");
    expect(insight.query.retentionFilter.totalIntervals).toBe(8);
  });

  it("references only event names declared in AnalyticsEventMap", () => {
    const source = fs.readFileSync(eventsPath, "utf8");
    const declaredNames = parseEventNames(source);

    // Non-vacuity floor: events.ts always declares at least the 3 real events.
    expect(declaredNames.size).toBeGreaterThanOrEqual(3);

    for (const event of FUNNEL_STEP_EVENTS) {
      expect(declaredNames.has(event)).toBe(true);
    }

    const insights = [buildActivationInsight(), buildPaywallFunnelInsight(), buildRetentionInsight()];
    const referencedEvents = insights.flatMap((insight) =>
      [...JSON.stringify(insight).matchAll(/"event":"([^"]+)"/g)].map((match) => match[1] as string),
    );

    // Non-vacuity: every insight above references at least one event.
    expect(referencedEvents.length).toBeGreaterThan(0);

    for (const event of referencedEvents) {
      expect(declaredNames.has(event)).toBe(true);
    }
  });

  it("does not reference any untracked gap event", () => {
    const insights = [buildActivationInsight(), buildPaywallFunnelInsight(), buildRetentionInsight()];
    const serialisedAll = insights.map((insight) => JSON.stringify(insight)).join("\n");

    for (const gap of UNTRACKED_FUNNEL_GAPS) {
      expect(serialisedAll.includes(gap.missingEvent)).toBe(false);
    }
  });

  it("documents gaps G1, G2 and G3", () => {
    expect(UNTRACKED_FUNNEL_GAPS.map((gap) => gap.id)).toEqual(["G1", "G2", "G3"]);
    for (const gap of UNTRACKED_FUNNEL_GAPS) {
      expect(gap.missingEvent.length).toBeGreaterThan(0);
      expect(gap.impact.length).toBeGreaterThan(0);
    }
  });
});
