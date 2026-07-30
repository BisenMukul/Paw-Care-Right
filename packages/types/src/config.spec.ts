import { appConfigResponseSchema, FEATURE_KEYS, featureFlagsSchema, PAYWALL_VARIANTS, paywallVariantSchema } from "./config";

const ALL_FEATURES_ON = { checks: true, chat: true, paywall: true };

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

describe("FEATURE_KEYS / featureFlagsSchema", () => {
  it("has exactly the 3 documented flag keys", () => {
    expect(FEATURE_KEYS).toEqual(["checks", "chat", "paywall"]);
  });

  it("accepts a body with all three flags", () => {
    expect(featureFlagsSchema.parse(ALL_FEATURES_ON)).toEqual(ALL_FEATURES_ON);
  });

  it("rejects a missing flag key", () => {
    expect(featureFlagsSchema.safeParse({ checks: true, chat: true }).success).toBe(false);
  });

  it("rejects a non-boolean flag value", () => {
    expect(
      featureFlagsSchema.safeParse({ checks: "on", chat: true, paywall: true }).success,
    ).toBe(false);
  });

  it("rejects an unknown flag key (strict)", () => {
    expect(
      featureFlagsSchema.safeParse({ ...ALL_FEATURES_ON, extra: true }).success,
    ).toBe(false);
  });
});

describe("appConfigResponseSchema", () => {
  it("parses a variant-A response with the min-version + hotline-pack + features fields", () => {
    expect(
      appConfigResponseSchema.parse({
        paywall: { variant: "A" },
        minSupportedVersion: "0.0.0",
        hotlinePackVersion: 1,
        features: ALL_FEATURES_ON,
      }),
    ).toEqual({
      paywall: { variant: "A" },
      minSupportedVersion: "0.0.0",
      hotlinePackVersion: 1,
      features: ALL_FEATURES_ON,
    });
  });

  it("parses a variant-B response with the min-version + hotline-pack + features fields", () => {
    expect(
      appConfigResponseSchema.parse({
        paywall: { variant: "B" },
        minSupportedVersion: "1.2.3",
        hotlinePackVersion: 3,
        features: { checks: false, chat: true, paywall: true },
      }),
    ).toEqual({
      paywall: { variant: "B" },
      minSupportedVersion: "1.2.3",
      hotlinePackVersion: 3,
      features: { checks: false, chat: true, paywall: true },
    });
  });

  it("rejects an unknown variant", () => {
    expect(
      appConfigResponseSchema.safeParse({
        paywall: { variant: "C" },
        minSupportedVersion: "0.0.0",
        hotlinePackVersion: 1,
        features: ALL_FEATURES_ON,
      }).success,
    ).toBe(false);
  });

  it("rejects a missing paywall field", () => {
    expect(
      appConfigResponseSchema.safeParse({
        minSupportedVersion: "0.0.0",
        hotlinePackVersion: 1,
        features: ALL_FEATURES_ON,
      }).success,
    ).toBe(false);
  });

  it("rejects a missing minSupportedVersion field", () => {
    expect(
      appConfigResponseSchema.safeParse({
        paywall: { variant: "A" },
        hotlinePackVersion: 1,
        features: ALL_FEATURES_ON,
      }).success,
    ).toBe(false);
  });

  it("rejects a missing hotlinePackVersion field", () => {
    expect(
      appConfigResponseSchema.safeParse({
        paywall: { variant: "A" },
        minSupportedVersion: "0.0.0",
        features: ALL_FEATURES_ON,
      }).success,
    ).toBe(false);
  });

  it("rejects a non-integer hotlinePackVersion", () => {
    expect(
      appConfigResponseSchema.safeParse({
        paywall: { variant: "A" },
        minSupportedVersion: "0.0.0",
        hotlinePackVersion: 1.5,
        features: ALL_FEATURES_ON,
      }).success,
    ).toBe(false);
  });

  it("rejects a negative hotlinePackVersion", () => {
    expect(
      appConfigResponseSchema.safeParse({
        paywall: { variant: "A" },
        minSupportedVersion: "0.0.0",
        hotlinePackVersion: -1,
        features: ALL_FEATURES_ON,
      }).success,
    ).toBe(false);
  });

  it("rejects a missing features field", () => {
    expect(
      appConfigResponseSchema.safeParse({
        paywall: { variant: "A" },
        minSupportedVersion: "0.0.0",
        hotlinePackVersion: 1,
      }).success,
    ).toBe(false);
  });

  it("rejects a non-boolean feature flag", () => {
    expect(
      appConfigResponseSchema.safeParse({
        paywall: { variant: "A" },
        minSupportedVersion: "0.0.0",
        hotlinePackVersion: 1,
        features: { checks: "on", chat: true, paywall: true },
      }).success,
    ).toBe(false);
  });

  it("rejects extra unknown top-level fields (strict)", () => {
    expect(
      appConfigResponseSchema.safeParse({
        paywall: { variant: "A" },
        minSupportedVersion: "0.0.0",
        hotlinePackVersion: 1,
        features: ALL_FEATURES_ON,
        extra: true,
      }).success,
    ).toBe(false);
  });
});
