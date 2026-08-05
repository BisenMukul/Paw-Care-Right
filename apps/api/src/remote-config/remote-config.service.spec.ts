import type { PlatformAppVersions } from "@bombaypetcompany/types";

import type { AppConfigService } from "../config/app-config.service";
import type { FeatureFlagsService } from "./feature-flags.service";
import { RemoteConfigService } from "./remote-config.service";
import { assignPaywallVariant } from "./variant-assignment";

const ALL_FEATURES_ON = { checks: true, chat: true, paywall: true };
const NO_GATE: PlatformAppVersions = { ios: "0.0.0", android: "0.0.0" };

describe("RemoteConfigService", () => {
  function buildService(overrides: {
    paywallVariant: "A" | "B" | "AUTO";
    minSupportedVersion?: string;
    hotlinePackVersion?: number;
    features?: { checks: boolean; chat: boolean; paywall: boolean };
    criticalOtaVersion?: string | null;
    minAppVersion?: PlatformAppVersions;
    recommendedAppVersion?: PlatformAppVersions;
  }) {
    const appConfig = {
      paywallVariant: overrides.paywallVariant,
      minSupportedVersion: overrides.minSupportedVersion ?? "0.0.0",
      hotlinePackVersion: overrides.hotlinePackVersion ?? 1,
      criticalOtaVersion: overrides.criticalOtaVersion ?? null,
      minAppVersion: overrides.minAppVersion ?? NO_GATE,
      recommendedAppVersion: overrides.recommendedAppVersion ?? NO_GATE,
    } as unknown as AppConfigService;
    const featureFlags = {
      getAll: jest.fn().mockResolvedValue(overrides.features ?? ALL_FEATURES_ON),
    } as unknown as FeatureFlagsService;

    return new RemoteConfigService(appConfig, featureFlags);
  }

  it("returns the paywall variant from an 'A' override, regardless of userId", async () => {
    const service = buildService({ paywallVariant: "A" });

    await expect(service.getConfig("some-user")).resolves.toEqual({
      paywall: { variant: "A" },
      minSupportedVersion: "0.0.0",
      hotlinePackVersion: 1,
      features: ALL_FEATURES_ON,
      criticalOtaVersion: null,
      minAppVersion: NO_GATE,
      recommendedAppVersion: NO_GATE,
    });
  });

  it("returns the paywall variant from a 'B' override, regardless of userId", async () => {
    const service = buildService({ paywallVariant: "B" });

    await expect(service.getConfig("some-user")).resolves.toEqual({
      paywall: { variant: "B" },
      minSupportedVersion: "0.0.0",
      hotlinePackVersion: 1,
      features: ALL_FEATURES_ON,
      criticalOtaVersion: null,
      minAppVersion: NO_GATE,
      recommendedAppVersion: NO_GATE,
    });
  });

  it("'AUTO' with no userId falls back to the stable anonymous default 'A'", async () => {
    const service = buildService({ paywallVariant: "AUTO" });

    await expect(service.getConfig(undefined)).resolves.toEqual({
      paywall: { variant: "A" },
      minSupportedVersion: "0.0.0",
      hotlinePackVersion: 1,
      features: ALL_FEATURES_ON,
      criticalOtaVersion: null,
      minAppVersion: NO_GATE,
      recommendedAppVersion: NO_GATE,
    });
  });

  it("'AUTO' with a userId applies the stable hash bucketing (matches assignPaywallVariant directly)", async () => {
    const service = buildService({ paywallVariant: "AUTO" });
    const userId = "user-golden-pin-002";

    const result = await service.getConfig(userId);
    expect(result.paywall.variant).toBe(assignPaywallVariant(userId, "AUTO"));
  });

  it("passes minSupportedVersion and hotlinePackVersion through from AppConfigService", async () => {
    const service = buildService({
      paywallVariant: "A",
      minSupportedVersion: "2.5.0",
      hotlinePackVersion: 7,
    });

    const result = await service.getConfig();

    expect(result.minSupportedVersion).toBe("2.5.0");
    expect(result.hotlinePackVersion).toBe(7);
  });

  it("passes features through from FeatureFlagsService.getAll (T106)", async () => {
    const service = buildService({
      paywallVariant: "A",
      features: { checks: false, chat: true, paywall: true },
    });

    const result = await service.getConfig();

    expect(result.features).toEqual({ checks: false, chat: true, paywall: true });
  });

  it("passes criticalOtaVersion through from AppConfigService", async () => {
    const service = buildService({ paywallVariant: "A", criticalOtaVersion: "u-critical-1" });

    const result = await service.getConfig();

    expect(result.criticalOtaVersion).toBe("u-critical-1");
  });

  it("passes per-platform minAppVersion/recommendedAppVersion through from AppConfigService (T115)", async () => {
    const minAppVersion: PlatformAppVersions = { ios: "2.0.0", android: "1.9.0" };
    const recommendedAppVersion: PlatformAppVersions = { ios: "2.5.0", android: "2.1.0" };
    const service = buildService({ paywallVariant: "A", minAppVersion, recommendedAppVersion });

    const result = await service.getConfig();

    expect(result.minAppVersion).toEqual(minAppVersion);
    expect(result.recommendedAppVersion).toEqual(recommendedAppVersion);
  });
});
