import { Logger } from "@nestjs/common";

import type { AppConfigService } from "../config/app-config.service";
import { AnalyticsService } from "./analytics.service";

function buildConfig(overrides: Partial<{ posthogApiKey: string; posthogHost: string }> = {}): AppConfigService {
  return {
    posthogApiKey: overrides.posthogApiKey ?? "",
    posthogHost: overrides.posthogHost ?? "https://us.i.posthog.com",
  } as unknown as AppConfigService;
}

describe("AnalyticsService", () => {
  it("with an empty POSTHOG_API_KEY (stub-safe default), capture never throws and never hits the network", () => {
    const originalFetch = global.fetch;
    const fetchSpy = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JUSTIFIED: swapping global.fetch for a test spy, restored in finally
    (global as any).fetch = fetchSpy;

    try {
      const service = new AnalyticsService(buildConfig());

      expect(() =>
        service.capture("user-1", "paywall_view", { source: "onboarding" }),
      ).not.toThrow();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("a configured key sends the capture payload via fetch", () => {
    const originalFetch = global.fetch;
    const fetchSpy = jest.fn().mockResolvedValue({ ok: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JUSTIFIED: swapping global.fetch for a test spy, restored in finally
    (global as any).fetch = fetchSpy;

    try {
      const service = new AnalyticsService(buildConfig({ posthogApiKey: "phc_test" }));

      service.capture("user-1", "trial_start", { householdId: "house-1", plan: "monthly" });

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://us.i.posthog.com/capture/",
        expect.objectContaining({ method: "POST" }),
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("an underlying capture throw is caught and logged ids-only -- never rethrown", () => {
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    try {
      const service = new AnalyticsService(buildConfig());
      // Force the internal analytics client to throw by poisoning its `capture`.
      (service as unknown as { analytics: { capture: () => void } }).analytics = {
        capture: () => {
          throw new Error("boom");
        },
      };

      expect(() => service.capture("user-1", "paywall_view", { source: "onboarding" })).not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({ event: "analytics_emit_failed", analyticsEvent: "paywall_view" }),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});
