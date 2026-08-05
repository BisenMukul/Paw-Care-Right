import {
  appConfigClientSchema,
  appConfigResponseSchema,
  FEATURE_KEYS,
  featureFlagsSchema,
  NO_GATE_VERSION,
  PAYWALL_VARIANTS,
  paywallVariantSchema,
  platformAppVersionsSchema,
} from "./config";

const ALL_FEATURES_ON = { checks: true, chat: true, paywall: true };
const NO_GATE = { ios: NO_GATE_VERSION, android: NO_GATE_VERSION };

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
  it("parses a variant-A response with the min-version + hotline-pack + features + T115 fields", () => {
    expect(
      appConfigResponseSchema.parse({
        paywall: { variant: "A" },
        minSupportedVersion: "0.0.0",
        hotlinePackVersion: 1,
        features: ALL_FEATURES_ON,
        criticalOtaVersion: null,
        minAppVersion: NO_GATE,
        recommendedAppVersion: NO_GATE,
      }),
    ).toEqual({
      paywall: { variant: "A" },
      minSupportedVersion: "0.0.0",
      hotlinePackVersion: 1,
      features: ALL_FEATURES_ON,
      criticalOtaVersion: null,
      minAppVersion: NO_GATE,
      recommendedAppVersion: NO_GATE,
    });
  });

  it("parses a variant-B response with the min-version + hotline-pack + features + T115 fields", () => {
    expect(
      appConfigResponseSchema.parse({
        paywall: { variant: "B" },
        minSupportedVersion: "1.2.3",
        hotlinePackVersion: 3,
        features: { checks: false, chat: true, paywall: true },
        criticalOtaVersion: "u-critical-1",
        minAppVersion: { ios: "2.0.0", android: "1.9.0" },
        recommendedAppVersion: { ios: "2.5.0", android: "2.0.0" },
      }),
    ).toEqual({
      paywall: { variant: "B" },
      minSupportedVersion: "1.2.3",
      hotlinePackVersion: 3,
      features: { checks: false, chat: true, paywall: true },
      criticalOtaVersion: "u-critical-1",
      minAppVersion: { ios: "2.0.0", android: "1.9.0" },
      recommendedAppVersion: { ios: "2.5.0", android: "2.0.0" },
    });
  });

  it("rejects an unknown variant", () => {
    expect(
      appConfigResponseSchema.safeParse({
        paywall: { variant: "C" },
        minSupportedVersion: "0.0.0",
        hotlinePackVersion: 1,
        features: ALL_FEATURES_ON,
        criticalOtaVersion: null,
        minAppVersion: NO_GATE,
        recommendedAppVersion: NO_GATE,
      }).success,
    ).toBe(false);
  });

  it("rejects a missing paywall field", () => {
    expect(
      appConfigResponseSchema.safeParse({
        minSupportedVersion: "0.0.0",
        hotlinePackVersion: 1,
        features: ALL_FEATURES_ON,
        criticalOtaVersion: null,
        minAppVersion: NO_GATE,
        recommendedAppVersion: NO_GATE,
      }).success,
    ).toBe(false);
  });

  it("rejects a missing minSupportedVersion field", () => {
    expect(
      appConfigResponseSchema.safeParse({
        paywall: { variant: "A" },
        hotlinePackVersion: 1,
        features: ALL_FEATURES_ON,
        criticalOtaVersion: null,
        minAppVersion: NO_GATE,
        recommendedAppVersion: NO_GATE,
      }).success,
    ).toBe(false);
  });

  it("rejects a missing hotlinePackVersion field", () => {
    expect(
      appConfigResponseSchema.safeParse({
        paywall: { variant: "A" },
        minSupportedVersion: "0.0.0",
        features: ALL_FEATURES_ON,
        criticalOtaVersion: null,
        minAppVersion: NO_GATE,
        recommendedAppVersion: NO_GATE,
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
        criticalOtaVersion: null,
        minAppVersion: NO_GATE,
        recommendedAppVersion: NO_GATE,
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
        criticalOtaVersion: null,
        minAppVersion: NO_GATE,
        recommendedAppVersion: NO_GATE,
      }).success,
    ).toBe(false);
  });

  it("rejects a missing features field", () => {
    expect(
      appConfigResponseSchema.safeParse({
        paywall: { variant: "A" },
        minSupportedVersion: "0.0.0",
        hotlinePackVersion: 1,
        criticalOtaVersion: null,
        minAppVersion: NO_GATE,
        recommendedAppVersion: NO_GATE,
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
        criticalOtaVersion: null,
        minAppVersion: NO_GATE,
        recommendedAppVersion: NO_GATE,
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
        criticalOtaVersion: null,
        minAppVersion: NO_GATE,
        recommendedAppVersion: NO_GATE,
        extra: true,
      }).success,
    ).toBe(false);
  });

  describe("criticalOtaVersion (T114)", () => {
    const base = {
      paywall: { variant: "A" as const },
      minSupportedVersion: "0.0.0",
      hotlinePackVersion: 1,
      features: ALL_FEATURES_ON,
      minAppVersion: NO_GATE,
      recommendedAppVersion: NO_GATE,
    };

    it("accepts a string updateId", () => {
      expect(
        appConfigResponseSchema.safeParse({ ...base, criticalOtaVersion: "u-critical-1" })
          .success,
      ).toBe(true);
    });

    it("accepts null", () => {
      expect(appConfigResponseSchema.safeParse({ ...base, criticalOtaVersion: null }).success).toBe(
        true,
      );
    });

    it("rejects a missing criticalOtaVersion key", () => {
      expect(appConfigResponseSchema.safeParse(base).success).toBe(false);
    });

    it("rejects a non-string/non-null value", () => {
      expect(
        appConfigResponseSchema.safeParse({ ...base, criticalOtaVersion: 5 }).success,
      ).toBe(false);
    });
  });

  describe("minAppVersion / recommendedAppVersion (T115)", () => {
    const base = {
      paywall: { variant: "A" as const },
      minSupportedVersion: "0.0.0",
      hotlinePackVersion: 1,
      features: ALL_FEATURES_ON,
      criticalOtaVersion: null,
    };

    it("accepts distinct per-platform ios/android values for both fields", () => {
      expect(
        appConfigResponseSchema.safeParse({
          ...base,
          minAppVersion: { ios: "2.0.0", android: "1.9.0" },
          recommendedAppVersion: { ios: "2.5.0", android: "2.1.0" },
        }).success,
      ).toBe(true);
    });

    it("rejects a missing minAppVersion key", () => {
      expect(
        appConfigResponseSchema.safeParse({ ...base, recommendedAppVersion: NO_GATE }).success,
      ).toBe(false);
    });

    it("rejects a missing recommendedAppVersion key", () => {
      expect(
        appConfigResponseSchema.safeParse({ ...base, minAppVersion: NO_GATE }).success,
      ).toBe(false);
    });

    it("rejects minAppVersion missing the android key", () => {
      expect(
        appConfigResponseSchema.safeParse({
          ...base,
          minAppVersion: { ios: "1.0.0" },
          recommendedAppVersion: NO_GATE,
        }).success,
      ).toBe(false);
    });

    it("rejects a non-string ios value", () => {
      expect(
        appConfigResponseSchema.safeParse({
          ...base,
          minAppVersion: { ios: 1, android: "1.0.0" },
          recommendedAppVersion: NO_GATE,
        }).success,
      ).toBe(false);
    });

    it("rejects an unknown key inside minAppVersion (strict)", () => {
      expect(
        appConfigResponseSchema.safeParse({
          ...base,
          minAppVersion: { ios: "1.0.0", android: "1.0.0", web: "1.0.0" },
          recommendedAppVersion: NO_GATE,
        }).success,
      ).toBe(false);
    });
  });
});

describe("platformAppVersionsSchema", () => {
  it("accepts an {ios, android} pair", () => {
    expect(platformAppVersionsSchema.parse({ ios: "1.0.0", android: "2.0.0" })).toEqual({
      ios: "1.0.0",
      android: "2.0.0",
    });
  });

  it("rejects an unknown key (strict)", () => {
    expect(
      platformAppVersionsSchema.safeParse({ ios: "1.0.0", android: "2.0.0", web: "3.0.0" }).success,
    ).toBe(false);
  });
});

/**
 * Carry-forward F1 (T114 checker Finding 1 / docs/OTA_UPDATES.md §5.4): the
 * CLIENT parse path must never let an old bundle's schema reject a body just
 * because the server grew a field it doesn't know about yet -- that would
 * strand the `features` kill switches. `appConfigResponseSchema` (the SERVER
 * contract) keeps its own "rejects extra unknown top-level fields (strict)"
 * case above, unchanged.
 */
describe("appConfigClientSchema (T115 / OTA_UPDATES §5.4)", () => {
  const fullValidBody = {
    paywall: { variant: "A" as const },
    minSupportedVersion: "0.0.0",
    hotlinePackVersion: 1,
    features: ALL_FEATURES_ON,
    criticalOtaVersion: null,
    minAppVersion: NO_GATE,
    recommendedAppVersion: NO_GATE,
  };

  it("accepts a body carrying an UNKNOWN FUTURE top-level field and still returns the features kill switches", () => {
    const result = appConfigClientSchema.safeParse({ ...fullValidBody, someFutureField: true });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.features).toEqual(ALL_FEATURES_ON);
      expect(result.data).not.toHaveProperty("someFutureField");
    }
  });

  it("tolerates an unknown key inside features and still returns the three documented flags", () => {
    const result = appConfigClientSchema.safeParse({
      ...fullValidBody,
      features: { ...ALL_FEATURES_ON, futureFlag: true },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.features).toEqual(ALL_FEATURES_ON);
    }
  });

  it("defaults minAppVersion/recommendedAppVersion to 0.0.0 on both platforms when the server omits them (pre-T115 server)", () => {
    const { minAppVersion, recommendedAppVersion, ...preT115Body } = fullValidBody;
    void minAppVersion;
    void recommendedAppVersion;

    const result = appConfigClientSchema.safeParse(preT115Body);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.minAppVersion).toEqual(NO_GATE);
      expect(result.data.recommendedAppVersion).toEqual(NO_GATE);
    }
  });

  it("tolerates an unknown key inside minAppVersion/recommendedAppVersion", () => {
    const result = appConfigClientSchema.safeParse({
      ...fullValidBody,
      minAppVersion: { ...NO_GATE, web: "1.0.0" },
      recommendedAppVersion: { ...NO_GATE, web: "1.0.0" },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.minAppVersion).toEqual(NO_GATE);
      expect(result.data.recommendedAppVersion).toEqual(NO_GATE);
    }
  });

  it("still rejects a body missing a pre-existing required field (non-vacuity)", () => {
    const { paywall: _paywall, ...missingPaywall } = fullValidBody;
    void _paywall;

    expect(appConfigClientSchema.safeParse(missingPaywall).success).toBe(false);
  });
});
