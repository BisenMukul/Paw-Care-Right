import { compareAppVersions, isVersionBelow } from "./semver";

/**
 * T115 AC1: "Semver util unit-tested (build-number edge cases)". Table-driven
 * per the plan's §5 AC1 table -- core ordering, build-number numeric
 * comparison (not lexical), fail-open malformed handling, and the
 * `isVersionBelow` boundary/fail-open cases.
 */
describe("compareAppVersions — core ordering", () => {
  it.each([
    ["1.0.0", "1.0.1", -1],
    ["1.2.3", "1.2.3", 0],
    ["2.0.0", "1.9.9", 1],
    ["1.2.10", "1.2.9", 1],
    ["1.2.9", "1.2.10", -1],
  ])("compareAppVersions(%s, %s) === %s", (a, b, expected) => {
    expect(compareAppVersions(a, b)).toBe(expected);
  });
});

describe("compareAppVersions — build metadata (numeric, not lexical)", () => {
  it.each([
    ["1.0.0+7", "1.0.0+10", -1, "build compared numerically, not lexically"],
    ["1.0.0+10", "1.0.0+7", 1, "reverse"],
    ["1.0.0+7", "1.0.0+7", 0, "equal builds"],
    ["1.0.0+007", "1.0.0+7", 0, "leading zeros"],
    ["1.0.0+7", "1.0.0", 0, "build missing on one side => ignored (fail-open)"],
    ["1.0.0", "1.0.0+7", 0, "reverse direction"],
    ["1.0.1+1", "1.0.0+9", 1, "core dominates build"],
    ["1.0.0+abc", "1.0.0+10", 0, "non-numeric build ignored"],
    ["1.0.0+1e3", "1.0.0+10", 0, "non-numeric build ignored"],
    [" 1.0.0 ", "1.0.0", 0, "trim"],
  ])("compareAppVersions(%j, %j) === %s (%s)", (a, b, expected) => {
    expect(compareAppVersions(a, b)).toBe(expected);
  });
});

describe("compareAppVersions — malformed input fails OPEN (null)", () => {
  it.each([
    ["1.0", "1.0.0"],
    ["1.0.0.0", "1.0.0"],
    ["v1.0.0", "1.0.0"],
    ["1.x.0", "1.0.0"],
    ["1.0.0-beta", "1.0.0"],
    ["1.0.0+", "1.0.0"],
    ["", "1.0.0"],
    ["garbage", "1.0.0"],
    // reverse side malformed too
    ["1.0.0", "1.0"],
    ["1.0.0", "1.0.0.0"],
    ["1.0.0", "v1.0.0"],
    ["1.0.0", "1.x.0"],
    ["1.0.0", "1.0.0-beta"],
    ["1.0.0", "1.0.0+"],
    ["1.0.0", ""],
    ["1.0.0", "garbage"],
  ])("compareAppVersions(%j, %j) is null", (a, b) => {
    expect(compareAppVersions(a, b)).toBeNull();
  });
});

describe("isVersionBelow", () => {
  it("build-only shortfall CAN gate", () => {
    expect(isVersionBelow("1.0.0+7", "1.0.0+10")).toBe(true);
  });

  it("an invisible build (missing on one side) never gates", () => {
    expect(isVersionBelow("1.0.0", "1.0.0+10")).toBe(false);
  });

  it.each([
    ["garbage", "2.0.0"],
    ["1.0.0", "garbage"],
    ["1.0.0-rc1", "2.0.0"],
    ["1.0.0", "1.0.0"],
    ["2.0.0", "1.0.0"],
  ])("isVersionBelow(%j, %j) is false (fail-open / boundary)", (current, target) => {
    expect(isVersionBelow(current, target)).toBe(false);
  });
});
