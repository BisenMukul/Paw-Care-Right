import type { AppConfigService } from "../config/app-config.service";
import { RemoteConfigService } from "./remote-config.service";

describe("RemoteConfigService", () => {
  function buildService(paywallVariant: "A" | "B") {
    const appConfig = { paywallVariant } as unknown as AppConfigService;
    return new RemoteConfigService(appConfig);
  }

  it("returns the paywall variant from AppConfigService (A)", () => {
    const service = buildService("A");

    expect(service.getConfig()).toEqual({ paywall: { variant: "A" } });
  });

  it("returns the paywall variant from AppConfigService (B)", () => {
    const service = buildService("B");

    expect(service.getConfig()).toEqual({ paywall: { variant: "B" } });
  });
});
