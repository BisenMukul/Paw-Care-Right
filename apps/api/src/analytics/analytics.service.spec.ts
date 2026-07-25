import { Logger } from "@nestjs/common";

import type { AppConfigService } from "../config/app-config.service";
import type { PrismaService } from "../prisma/prisma.service";
import { AnalyticsService } from "./analytics.service";

function buildConfig(overrides: Partial<{ posthogApiKey: string; posthogHost: string }> = {}): AppConfigService {
  return {
    posthogApiKey: overrides.posthogApiKey ?? "",
    posthogHost: overrides.posthogHost ?? "https://us.i.posthog.com",
  } as unknown as AppConfigService;
}

function buildPrisma(findUnique: jest.Mock): PrismaService {
  return { user: { findUnique } } as unknown as PrismaService;
}

describe("AnalyticsService", () => {
  it("with an empty POSTHOG_API_KEY (stub-safe default), capture never throws and never hits the network", () => {
    const originalFetch = global.fetch;
    const fetchSpy = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JUSTIFIED: swapping global.fetch for a test spy, restored in finally
    (global as any).fetch = fetchSpy;

    try {
      const service = new AnalyticsService(buildConfig(), buildPrisma(jest.fn()));

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
      const service = new AnalyticsService(buildConfig({ posthogApiKey: "phc_test" }), buildPrisma(jest.fn()));

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
      const service = new AnalyticsService(buildConfig(), buildPrisma(jest.fn()));
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

  describe("captureForUser (T091 plan D5/AC3)", () => {
    it("does not invoke the transport when analyticsOptOut is true", async () => {
      const originalFetch = global.fetch;
      const fetchSpy = jest.fn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JUSTIFIED: swapping global.fetch for a test spy, restored in finally
      (global as any).fetch = fetchSpy;

      try {
        const findUnique = jest.fn().mockResolvedValue({ analyticsOptOut: true });
        const service = new AnalyticsService(buildConfig({ posthogApiKey: "phc_test" }), buildPrisma(findUnique));

        await service.captureForUser("user-1", "paywall_view", { source: "onboarding" });

        expect(findUnique).toHaveBeenCalledWith({
          where: { id: "user-1" },
          select: { analyticsOptOut: true },
        });
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("does invoke it when analyticsOptOut is false", async () => {
      const originalFetch = global.fetch;
      const fetchSpy = jest.fn().mockResolvedValue({ ok: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JUSTIFIED: swapping global.fetch for a test spy, restored in finally
      (global as any).fetch = fetchSpy;

      try {
        const findUnique = jest.fn().mockResolvedValue({ analyticsOptOut: false });
        const service = new AnalyticsService(buildConfig({ posthogApiKey: "phc_test" }), buildPrisma(findUnique));

        await service.captureForUser("user-1", "paywall_view", { source: "onboarding" });

        expect(fetchSpy).toHaveBeenCalledWith(
          "https://us.i.posthog.com/capture/",
          expect.objectContaining({ method: "POST" }),
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("does not invoke it when the user row is missing", async () => {
      const originalFetch = global.fetch;
      const fetchSpy = jest.fn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JUSTIFIED: swapping global.fetch for a test spy, restored in finally
      (global as any).fetch = fetchSpy;

      try {
        const findUnique = jest.fn().mockResolvedValue(null);
        const service = new AnalyticsService(buildConfig({ posthogApiKey: "phc_test" }), buildPrisma(findUnique));

        await service.captureForUser("missing-user", "paywall_view", { source: "onboarding" });

        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("fails closed (does not emit, does not rethrow) when the consent read throws", async () => {
      const originalFetch = global.fetch;
      const fetchSpy = jest.fn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JUSTIFIED: swapping global.fetch for a test spy, restored in finally
      (global as any).fetch = fetchSpy;
      const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

      try {
        const findUnique = jest.fn().mockRejectedValue(new Error("db down"));
        const service = new AnalyticsService(buildConfig({ posthogApiKey: "phc_test" }), buildPrisma(findUnique));

        await expect(
          service.captureForUser("user-1", "paywall_view", { source: "onboarding" }),
        ).resolves.toBeUndefined();

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith(
          expect.objectContaining({ event: "analytics_consent_read_failed" }),
        );
      } finally {
        global.fetch = originalFetch;
        warnSpy.mockRestore();
      }
    });
  });
});
