import {
  COLD_START_BUDGET_MS,
  evaluateColdStart,
  parseAmStartOutput,
  summarizeColdStart,
} from "../src/perf/cold-start";

describe("parseAmStartOutput", () => {
  const REAL_AM_START_BLOCK = `Starting: Intent { cmp=com.bombaypetcompany.app/.MainActivity }
Status: ok
LaunchState: COLD
Activity: com.bombaypetcompany.app/.MainActivity
TotalTime: 1843
WaitTime: 1901
Complete`;

  it("extracts TotalTime/WaitTime from real am start -W output", () => {
    expect(parseAmStartOutput(REAL_AM_START_BLOCK)).toEqual({ totalTimeMs: 1843, waitTimeMs: 1901 });
  });

  it("throws (never returns 0) on a malformed block missing TotalTime", () => {
    expect(() => parseAmStartOutput("Status: ok\nComplete")).toThrow();
  });

  it("throws on a malformed block missing WaitTime", () => {
    expect(() => parseAmStartOutput("Status: ok\nTotalTime: 1234\nComplete")).toThrow();
  });
});

describe("summarizeColdStart", () => {
  it("computes n/median/min/max for an odd-length sample", () => {
    expect(summarizeColdStart([100, 200, 300])).toEqual({ n: 3, medianMs: 200, minMs: 100, maxMs: 300 });
  });

  it("computes the median over an even count as the average of the two middle values", () => {
    expect(summarizeColdStart([100, 200, 300, 400])).toEqual({ n: 4, medianMs: 250, minMs: 100, maxMs: 400 });
  });

  it("is order-independent (unsorted input)", () => {
    expect(summarizeColdStart([300, 100, 200])).toEqual({ n: 3, medianMs: 200, minMs: 100, maxMs: 300 });
  });

  it("throws on empty input", () => {
    expect(() => summarizeColdStart([])).toThrow();
  });
});

describe("evaluateColdStart", () => {
  it("pins the documented budget at 2500ms", () => {
    expect(COLD_START_BUDGET_MS).toBe(2500);
  });

  it("passes when the median is under budget", () => {
    const result = evaluateColdStart([2400, 2450, 2400]);
    expect(result.budgetMs).toBe(2500);
    expect(result.pass).toBe(true);
  });

  it("fails when the median is over budget", () => {
    const result = evaluateColdStart([2600, 2700, 2600]);
    expect(result.pass).toBe(false);
  });
});
