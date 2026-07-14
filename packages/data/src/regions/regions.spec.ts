import { regionHotlineSchema } from "./schema";
import { FALLBACK_REGION_HOTLINE, REGION_HOTLINES, resolveRegionHotline } from "./index";

describe("region hotline dataset — resolution", () => {
  it("resolves a known region (US) with the correct ASPCA details", () => {
    const resolved = resolveRegionHotline("US");
    expect(resolved.known).toBe(true);
    expect(resolved.dialNumber).toBe("+18884264435");
    expect(resolved.poisonHotlineName).toContain("ASPCA");
  });

  it("is case-insensitive on the input region code", () => {
    expect(resolveRegionHotline("us")).toEqual(resolveRegionHotline("US"));
  });

  // T049 carried hygiene (T052 plan "Key decisions" #5): end-to-end
  // resolution assertions for the remaining pinned regions beyond US.
  it.each(["CA", "GB", "AU", "NZ"] as const)("resolves a known region (%s) with a real dial number", (code) => {
    const resolved = resolveRegionHotline(code);
    expect(resolved.known).toBe(true);
    expect(resolved.dialNumber).toMatch(/^[+0-9]+$/);
    expect(resolved.poisonHotlineName).not.toBeNull();
    expect(resolved.regionCode).toBe(code);
  });

  it("is case-insensitive on a non-US region code (GB)", () => {
    expect(resolveRegionHotline("gb")).toEqual(resolveRegionHotline("GB"));
  });

  it("resolves undefined region to the fallback (no fabricated number)", () => {
    expect(resolveRegionHotline(undefined)).toEqual(FALLBACK_REGION_HOTLINE);
  });

  it("resolves an unknown region code to the fallback (no fabricated number)", () => {
    expect(resolveRegionHotline("ZZ")).toEqual(FALLBACK_REGION_HOTLINE);
  });

  it("fallback carries no dial number, name, display number, or fee note", () => {
    expect(FALLBACK_REGION_HOTLINE.known).toBe(false);
    expect(FALLBACK_REGION_HOTLINE.dialNumber).toBeNull();
    expect(FALLBACK_REGION_HOTLINE.poisonHotlineName).toBeNull();
    expect(FALLBACK_REGION_HOTLINE.displayNumber).toBeNull();
    expect(FALLBACK_REGION_HOTLINE.feeNote).toBeNull();
  });
});

describe("region hotline dataset — integrity", () => {
  it("every row parses under regionHotlineSchema", () => {
    expect(() => regionHotlineSchema.array().parse(REGION_HOTLINES)).not.toThrow();
  });

  it("has exactly the 5 pinned rows", () => {
    expect(REGION_HOTLINES.length).toBe(5);
  });

  it("every regionCode matches /^[A-Z]{2}$/ and is unique", () => {
    const codes = REGION_HOTLINES.map((row) => row.regionCode);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("every dialNumber matches /^[+0-9]+$/", () => {
    for (const row of REGION_HOTLINES) {
      expect(row.dialNumber).toMatch(/^[+0-9]+$/);
    }
  });

  it("every displayNumber/poisonHotlineName/source is non-empty", () => {
    for (const row of REGION_HOTLINES) {
      expect(row.displayNumber.length).toBeGreaterThan(0);
      expect(row.poisonHotlineName.length).toBeGreaterThan(0);
      expect(row.source.length).toBeGreaterThan(0);
    }
  });
});
