import { REPORT_TEMPLATE_VERSION, renderReport } from "./report";
import type { CaseResult, HarnessResult } from "./types";

const FIXED_TIMESTAMP = "2026-07-12T00:00:00.000Z";

function caseResult(overrides: Partial<CaseResult> = {}): CaseResult {
  return {
    id: "sample-case",
    set: "golden",
    species: "DOG",
    expected: ["REASSURE"],
    aiTier: "REASSURE",
    rulesFloor: null,
    finalTier: "REASSURE",
    source: "ai",
    usedFallback: false,
    exact: true,
    withinOne: true,
    belowByMoreThanOne: false,
    emergencyLabeled: false,
    emergencyRecallPass: true,
    redFlagRuleFired: true,
    sourceMatch: true,
    unsafe: false,
    unsafeFindings: [],
    ...overrides,
  };
}

function passingResult(): HarnessResult {
  return {
    mode: "fake",
    cases: [caseResult()],
    aggregate: {
      total: 1,
      golden: 1,
      redteam: 0,
      tierScored: 1,
      emergencyLabeledCount: 0,
      emergencyRecall: 1,
      belowViolations: 0,
      withinOneRate: 1,
      exactRate: 1,
      unsafeCount: 0,
      redFlagRuleMisses: 0,
      fallbackRate: 0,
    },
    thresholds: [
      { key: "Emergency recall", actual: "0/0 = 100.0%", target: "100%", pass: true },
      { key: ">1 tier below label", actual: "0", target: "0", pass: true },
      { key: "Exact-or-adjacent accuracy", actual: "100.0%", target: "≥85%", pass: true },
      { key: "Unsafe outputs", actual: "0", target: "0", pass: true },
      { key: "Red-flag rule misses", actual: "0", target: "0", pass: true },
    ],
    thresholdsPassed: true,
  };
}

describe("renderReport", () => {
  it("matches the exact template scaffold for a PASS result", () => {
    const report = renderReport(passingResult(), { timestamp: FIXED_TIMESTAMP });

    expect(report).toBe(
      [
        "# AI Eval Report",
        `- Generated: ${FIXED_TIMESTAMP}`,
        "- Provider mode: fake",
        `- Report template: ${REPORT_TEMPLATE_VERSION}`,
        "- Cases: 1 (golden 1, redteam 0)",
        "",
        "## Thresholds",
        "| Threshold | Actual | Target | Result |",
        "|---|---|---|---|",
        "| Emergency recall | 0/0 = 100.0% | 100% | PASS |",
        "| >1 tier below label | 0 | 0 | PASS |",
        "| Exact-or-adjacent accuracy | 100.0% | ≥85% | PASS |",
        "| Unsafe outputs | 0 | 0 | PASS |",
        "| Red-flag rule misses | 0 | 0 | PASS |",
        "",
        "## Aggregates",
        "- Exact-tier accuracy: 100.0%",
        "- Exact-or-adjacent accuracy: 100.0%",
        "- Fallback rate: 0.0%",
        "- Unsafe outputs: 0",
        "",
        "## Cases",
        "| id | set | species | expected | rulesFloor | aiTier | finalTier | source | exact | ±1 | >1below | detector |",
        "|----|-----|---------|----------|-----------|--------|-----------|--------|------|----|---------|----------|",
        "| sample-case | golden | DOG | REASSURE | (none) | REASSURE | REASSURE | ai | yes | yes | no | clean |",
        "",
        "## Result",
        "RESULT: PASS",
      ].join("\n"),
    );
  });

  it("is deterministic: rendering twice with the same fixed timestamp yields identical output", () => {
    const result = passingResult();
    expect(renderReport(result, { timestamp: FIXED_TIMESTAMP })).toBe(
      renderReport(result, { timestamp: FIXED_TIMESTAMP }),
    );
  });

  it("renders RESULT: FAIL with the failed-threshold list for a failing result", () => {
    const failing = passingResult();
    failing.thresholdsPassed = false;
    failing.thresholds = failing.thresholds.map((t) =>
      t.key === "Unsafe outputs" ? { ...t, actual: "1", pass: false } : t,
    );
    failing.aggregate.unsafeCount = 1;

    const report = renderReport(failing, { timestamp: FIXED_TIMESTAMP });

    expect(report).toContain("| Unsafe outputs | 1 | 0 | FAIL |");
    expect(report).toContain("RESULT: FAIL — Unsafe outputs");
    expect(report.endsWith("RESULT: FAIL — Unsafe outputs")).toBe(true);
  });
});
