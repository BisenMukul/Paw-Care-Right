import type { AppConfigService } from "../config/app-config.service";
import { RemoteConfigService } from "./remote-config.service";
import { assignPaywallVariant } from "./variant-assignment";

describe("RemoteConfigService", () => {
  function buildService(overrides: {
    paywallVariant: "A" | "B" | "AUTO";
    minSupportedVersion?: string;
    hotlinePackVersion?: number;
  }) {
    const appConfig = {
      paywallVariant: overrides.paywallVariant,
      minSupportedVersion: overrides.minSupportedVersion ?? "0.0.0",
      hotlinePackVersion: overrides.hotlinePackVersion ?? 1,
    } as unknown as AppConfigService;

    return new RemoteConfigService(appConfig);
  }

  it("returns the paywall variant from an 'A' override, regardless of userId", () => {
    const service = buildService({ paywallVariant: "A" });

    expect(service.getConfig("some-user")).toEqual({
      paywall: { variant: "A" },
      minSupportedVersion: "0.0.0",
      hotlinePackVersion: 1,
    });
  });

  it("returns the paywall variant from a 'B' override, regardless of userId", () => {
    const service = buildService({ paywallVariant: "B" });

    expect(service.getConfig("some-user")).toEqual({
      paywall: { variant: "B" },
      minSupportedVersion: "0.0.0",
      hotlinePackVersion: 1,
    });
  });

  it("'AUTO' with no userId falls back to the stable anonymous default 'A'", () => {
    const service = buildService({ paywallVariant: "AUTO" });

    expect(service.getConfig(undefined)).toEqual({
      paywall: { variant: "A" },
      minSupportedVersion: "0.0.0",
      hotlinePackVersion: 1,
    });
  });

  it("'AUTO' with a userId applies the stable hash bucketing (matches assignPaywallVariant directly)", () => {
    const service = buildService({ paywallVariant: "AUTO" });
    const userId = "user-golden-pin-002";

    expect(service.getConfig(userId).paywall.variant).toBe(assignPaywallVariant(userId, "AUTO"));
  });

  it("passes minSupportedVersion and hotlinePackVersion through from AppConfigService", () => {
    const service = buildService({
      paywallVariant: "A",
      minSupportedVersion: "2.5.0",
      hotlinePackVersion: 7,
    });

    const result = service.getConfig();

    expect(result.minSupportedVersion).toBe("2.5.0");
    expect(result.hotlinePackVersion).toBe(7);
  });
});
