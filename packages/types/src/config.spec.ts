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
  it("parses a variant-A response with the min-version + hotline-pack fields", () => {
    expect(
      appConfigResponseSchema.parse({
        paywall: { variant: "A" },
        minSupportedVersion: "0.0.0",
        hotlinePackVersion: 1,
      }),
    ).toEqual({
      paywall: { variant: "A" },
      minSupportedVersion: "0.0.0",
      hotlinePackVersion: 1,
    });
  });

  it("parses a variant-B response with the min-version + hotline-pack fields", () => {
    expect(
      appConfigResponseSchema.parse({
        paywall: { variant: "B" },
        minSupportedVersion: "1.2.3",
        hotlinePackVersion: 3,
      }),
    ).toEqual({
      paywall: { variant: "B" },
      minSupportedVersion: "1.2.3",
      hotlinePackVersion: 3,
    });
  });

  it("rejects an unknown variant", () => {
    expect(
      appConfigResponseSchema.safeParse({
        paywall: { variant: "C" },
        minSupportedVersion: "0.0.0",
        hotlinePackVersion: 1,
      }).success,
    ).toBe(false);
  });

  it("rejects a missing paywall field", () => {
    expect(
      appConfigResponseSchema.safeParse({ minSupportedVersion: "0.0.0", hotlinePackVersion: 1 }).success,
    ).toBe(false);
  });

  it("rejects a missing minSupportedVersion field", () => {
    expect(
      appConfigResponseSchema.safeParse({ paywall: { variant: "A" }, hotlinePackVersion: 1 }).success,
    ).toBe(false);
  });

  it("rejects a missing hotlinePackVersion field", () => {
    expect(
      appConfigResponseSchema.safeParse({ paywall: { variant: "A" }, minSupportedVersion: "0.0.0" }).success,
    ).toBe(false);
  });

  it("rejects a non-integer hotlinePackVersion", () => {
    expect(
      appConfigResponseSchema.safeParse({
        paywall: { variant: "A" },
        minSupportedVersion: "0.0.0",
        hotlinePackVersion: 1.5,
      }).success,
    ).toBe(false);
  });

  it("rejects a negative hotlinePackVersion", () => {
    expect(
      appConfigResponseSchema.safeParse({
        paywall: { variant: "A" },
        minSupportedVersion: "0.0.0",
        hotlinePackVersion: -1,
      }).success,
    ).toBe(false);
  });

  it("rejects extra unknown top-level fields (strict)", () => {
    expect(
      appConfigResponseSchema.safeParse({
        paywall: { variant: "A" },
        minSupportedVersion: "0.0.0",
        hotlinePackVersion: 1,
        extra: true,
      }).success,
    ).toBe(false);
  });
});
