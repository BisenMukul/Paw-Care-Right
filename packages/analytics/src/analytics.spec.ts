import { createAnalytics, type AnalyticsTransport } from "./analytics";

/**
 * AC "consent flag respected (default on, off switch)" (T078 plan). This
 * spec proves the CONSENT GATE ITSELF, independent of any store -- the
 * mobile/API consumers each supply their own `isEnabled` (mobile: the
 * consent store; server: none/always-on, decision 4/R1).
 */
describe("createAnalytics", () => {
  function buildTransport() {
    const send = jest.fn();
    return { transport: { send } as AnalyticsTransport, send };
  }

  it("with no isEnabled option, capture sends the payload (default ON)", () => {
    const { transport, send } = buildTransport();
    const analytics = createAnalytics({ transport });

    analytics.capture("user-1", "trial_start", { householdId: "house-1", plan: "monthly" });

    expect(send).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "trial_start",
      properties: { householdId: "house-1", plan: "monthly" },
    });
  });

  it("isEnabled returning true sends the payload", () => {
    const { transport, send } = buildTransport();
    const analytics = createAnalytics({ transport, isEnabled: () => true });

    analytics.capture("user-1", "paywall_view", { source: "settings" });

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("isEnabled returning false is a no-op -- the transport is NEVER invoked (consent off)", () => {
    const { transport, send } = buildTransport();
    const analytics = createAnalytics({ transport, isEnabled: () => false });

    analytics.capture("user-1", "paywall_view", { source: "settings" });

    expect(send).not.toHaveBeenCalled();
  });

  it("isEnabled is consulted per-call, so a runtime toggle takes effect immediately", () => {
    const { transport, send } = buildTransport();
    let enabled = true;
    const analytics = createAnalytics({ transport, isEnabled: () => enabled });

    analytics.capture("user-1", "paywall_view", { source: "onboarding" });
    enabled = false;
    analytics.capture("user-1", "paywall_view", { source: "onboarding" });

    expect(send).toHaveBeenCalledTimes(1);
  });
});
