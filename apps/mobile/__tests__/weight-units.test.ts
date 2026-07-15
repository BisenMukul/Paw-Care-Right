import {
  WEIGHT_MAX_GRAMS,
  WEIGHT_MIN_GRAMS,
  defaultUnitForRegion,
  formatWeight,
  gramsToDisplay,
  parseDisplayToGrams,
} from "../src/weight/weight-units";

// T065 plan — pure unit-conversion AC. Every case here is a straight
// input/output assertion; no React, no mocks needed.
describe("gramsToDisplay", () => {
  it("converts grams to kg, rounded to 1 decimal", () => {
    expect(gramsToDisplay(25000, "kg")).toBe(25.0);
  });

  it("converts grams to lb, rounded to 1 decimal", () => {
    expect(gramsToDisplay(25000, "lb")).toBeCloseTo(55.1, 1);
  });
});

describe("formatWeight", () => {
  it("formats kg with a trailing unit label", () => {
    expect(formatWeight(25000, "kg")).toBe("25.0 kg");
  });

  it("formats lb with a trailing unit label", () => {
    expect(formatWeight(25000, "lb")).toBe("55.1 lb");
  });
});

describe("parseDisplayToGrams", () => {
  it("parses a valid kg value to grams", () => {
    expect(parseDisplayToGrams("25", "kg")).toEqual({ ok: true, grams: 25000 });
  });

  it("round-trips a lb value back to grams within tolerance", () => {
    const result = parseDisplayToGrams("55.1", "lb");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Math.abs(result.grams - 25000)).toBeLessThan(100);
    }
  });

  it("rejects an empty string", () => {
    expect(parseDisplayToGrams("", "kg")).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects whitespace-only input as empty", () => {
    expect(parseDisplayToGrams("   ", "kg")).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects non-numeric input", () => {
    expect(parseDisplayToGrams("abc", "kg")).toEqual({ ok: false, reason: "nan" });
  });

  it("rejects zero", () => {
    expect(parseDisplayToGrams("0", "kg")).toEqual({ ok: false, reason: "range" });
  });

  it("rejects a negative value", () => {
    expect(parseDisplayToGrams("-3", "kg")).toEqual({ ok: false, reason: "range" });
  });

  it("rejects a value far above the max (kg)", () => {
    expect(parseDisplayToGrams("9999", "kg")).toEqual({ ok: false, reason: "range" });
  });

  it("accepts the exact min/max boundary grams", () => {
    expect(parseDisplayToGrams(String(WEIGHT_MIN_GRAMS / 1000), "kg")).toEqual({
      ok: true,
      grams: WEIGHT_MIN_GRAMS,
    });
    expect(parseDisplayToGrams(String(WEIGHT_MAX_GRAMS / 1000), "kg")).toEqual({
      ok: true,
      grams: WEIGHT_MAX_GRAMS,
    });
  });
});

describe("defaultUnitForRegion", () => {
  it.each(["US", "LR", "MM"])("returns lb for imperial region %s", (region) => {
    expect(defaultUnitForRegion(region)).toBe("lb");
  });

  it.each(["GB", "FR", "IN"])("returns kg for a metric region %s", (region) => {
    expect(defaultUnitForRegion(region)).toBe("kg");
  });

  it("returns kg when region is undefined", () => {
    expect(defaultUnitForRegion(undefined)).toBe("kg");
  });
});
