import type { HarnessResult } from "./types";

/**
 * Markdown report template (plan "Report template" — a code constant so
 * `report.spec.ts` can assert the exact scaffold). Deterministic given a
 * fixed `timestamp`; the only non-deterministic input across real runs is
 * the timestamp itself.
 */
export const REPORT_TEMPLATE_VERSION = "1";

export interface RenderReportOptions {
  timestamp: string;
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function threshRow(result: HarnessResult, key: string): string {
  const threshold = result.thresholds.find((t) => t.key === key);
  const actual = threshold?.actual ?? "";
  const target = threshold?.target ?? "";
  const status = threshold?.pass ? "PASS" : "FAIL";
  return `| ${key} | ${actual} | ${target} | ${status} |`;
}

function caseRow(c: HarnessResult["cases"][number]): string {
  const expected = c.expected.length > 0 ? c.expected.join(", ") : "(none)";
  const rulesFloor = c.rulesFloor ?? "(none)";
  return `| ${c.id} | ${c.set} | ${c.species} | ${expected} | ${rulesFloor} | ${c.aiTier} | ${c.finalTier} | ${c.source} | ${c.exact ? "yes" : "no"} | ${c.withinOne ? "yes" : "no"} | ${c.belowByMoreThanOne ? "yes" : "no"} | ${c.unsafe ? "UNSAFE" : "clean"} |`;
}

function resultLine(result: HarnessResult): string {
  if (result.thresholdsPassed) {
    return "RESULT: PASS";
  }
  const failed = result.thresholds.filter((t) => !t.pass).map((t) => t.key);
  return `RESULT: FAIL — ${failed.join(", ")}`;
}

/** Renders the full markdown report for `result`, deterministic given a fixed `timestamp`. */
export function renderReport(result: HarnessResult, options: RenderReportOptions): string {
  const lines: string[] = [
    "# AI Eval Report",
    `- Generated: ${options.timestamp}`,
    `- Provider mode: ${result.mode}`,
    `- Report template: ${REPORT_TEMPLATE_VERSION}`,
    `- Cases: ${result.aggregate.total} (golden ${result.aggregate.golden}, redteam ${result.aggregate.redteam})`,
    "",
    "## Thresholds",
    "| Threshold | Actual | Target | Result |",
    "|---|---|---|---|",
    threshRow(result, "Emergency recall"),
    threshRow(result, ">1 tier below label"),
    threshRow(result, "Exact-or-adjacent accuracy"),
    threshRow(result, "Unsafe outputs"),
    threshRow(result, "Red-flag rule misses"),
    "",
    "## Aggregates",
    `- Exact-tier accuracy: ${pct(result.aggregate.exactRate)}`,
    `- Exact-or-adjacent accuracy: ${pct(result.aggregate.withinOneRate)}`,
    `- Fallback rate: ${pct(result.aggregate.fallbackRate)}`,
    `- Unsafe outputs: ${result.aggregate.unsafeCount}`,
    "",
    "## Cases",
    "| id | set | species | expected | rulesFloor | aiTier | finalTier | source | exact | ±1 | >1below | detector |",
    "|----|-----|---------|----------|-----------|--------|-----------|--------|------|----|---------|----------|",
    ...result.cases.map(caseRow),
    "",
    "## Result",
    resultLine(result),
  ];

  return lines.join("\n");
}
