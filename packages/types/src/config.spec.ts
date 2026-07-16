import { appConfigResponseSchema, PAYWALL_VARIANTS, paywallVariantSchema } from "./config";

describe("PAYWALL_VARIANTS / paywallVariantSchema", () => {
  it("has exactly the 2 documented variants", () => {
    expect(PAYWALL_VARIANTS).toEqual(["A", "B"]);
  });

  it.each(PAYWALL_VARIANTS)("accepts %s", (variant) => {
    expect(paywallVariantSchema.parse(variant)).toBe(variant);
  });

  it("rejects an unknown variant", () => {
    expect(paywallVariantSchema.safeParse("C").success).toBe(false);
  });
});

describe("appConfigResponseSchema", () => {
  it("parses a variant-A response", () => {
    expect(appConfigResponseSchema.parse({ paywall: { variant: "A" } })).toEqual({
      paywall: { variant: "A" },
    });
  });

  it("parses a variant-B response", () => {
    expect(appConfigResponseSchema.parse({ paywall: { variant: "B" } })).toEqual({
      paywall: { variant: "B" },
    });
  });

  it("rejects an unknown variant", () => {
    expect(appConfigResponseSchema.safeParse({ paywall: { variant: "C" } }).success).toBe(false);
  });

  it("rejects a missing paywall field", () => {
    expect(appConfigResponseSchema.safeParse({}).success).toBe(false);
  });

  it("rejects extra unknown top-level fields (strict)", () => {
    expect(
      appConfigResponseSchema.safeParse({ paywall: { variant: "A" }, extra: true }).success,
    ).toBe(false);
  });
});
