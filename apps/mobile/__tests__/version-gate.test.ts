import { compareVersions, isUpdateRequired } from "../src/config/version-gate";

describe("compareVersions", () => {
  it("returns -1 when a < b", () => {
    expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
  });

  it("returns 0 when a === b", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });

  it("returns 1 when a > b", () => {
    expect(compareVersions("2.0.0", "1.9.9")).toBe(1);
  });

  it("compares multi-digit segments numerically, not lexically (1.2.10 > 1.2.9)", () => {
    expect(compareVersions("1.2.10", "1.2.9")).toBe(1);
    expect(compareVersions("1.2.9", "1.2.10")).toBe(-1);
  });

  it("returns null when a is malformed", () => {
    expect(compareVersions("not-a-version", "1.0.0")).toBeNull();
  });

  it("returns null when b is malformed", () => {
    expect(compareVersions("1.0.0", "not-a-version")).toBeNull();
  });

  it("returns null for non-numeric segments", () => {
    expect(compareVersions("1.x.0", "1.0.0")).toBeNull();
  });

  it("returns null for a version missing a segment", () => {
    expect(compareVersions("1.0", "1.0.0")).toBeNull();
  });
});

describe("isUpdateRequired — fail-open (AC)", () => {
  it("returns true when current < min (below)", () => {
    expect(isUpdateRequired("1.0.0", "2.0.0")).toBe(true);
  });

  it("returns false when current === min (equal)", () => {
    expect(isUpdateRequired("1.0.0", "1.0.0")).toBe(false);
  });

  it("returns false when current > min (above)", () => {
    expect(isUpdateRequired("2.0.0", "1.0.0")).toBe(false);
  });

  it("returns false when current is malformed (fail-open)", () => {
    expect(isUpdateRequired("garbage", "2.0.0")).toBe(false);
  });

  it("returns false when min is malformed (fail-open)", () => {
    expect(isUpdateRequired("1.0.0", "garbage")).toBe(false);
  });

  it("returns false when either version has non-numeric parts (fail-open)", () => {
    expect(isUpdateRequired("1.a.0", "2.0.0")).toBe(false);
    expect(isUpdateRequired("1.0.0", "2.b.0")).toBe(false);
  });

  it("handles multi-digit segments correctly (1.2.9 requires update to 1.2.10)", () => {
    expect(isUpdateRequired("1.2.9", "1.2.10")).toBe(true);
    expect(isUpdateRequired("1.2.10", "1.2.9")).toBe(false);
  });
});
