import { createAnalytics } from "./analytics";
import type { AnalyticsTransport, CapturePayload } from "./analytics";

/**
 * AC "Event map type-tested (unknown event = compile error)" (T078 plan
 * decision 3). Every `@ts-expect-error` line below is checked by ts-jest AND
 * `pnpm typecheck`: a STALE/unused `@ts-expect-error` (i.e. the underlying
 * error stops occurring) fails the test/build, which is exactly the
 * "unknown event = compile error" guarantee this file proves.
 */
describe("AnalyticsEventMap type safety", () => {
  function buildAnalytics() {
    const send = jest.fn();
    const transport: AnalyticsTransport = { send };
    return { analytics: createAnalytics({ transport }), send };
  }

  it("a valid event name + matching properties typechecks and emits", () => {
    const { analytics, send } = buildAnalytics();

    analytics.capture("user-1", "paywall_view", { source: "onboarding" });

    expect(send).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "paywall_view",
      properties: { source: "onboarding" },
    } satisfies CapturePayload);
  });

  it("an unknown event name is a compile error", () => {
    const { analytics } = buildAnalytics();

    // @ts-expect-error unknown event name
    analytics.capture("user-1", "not_a_real_event", {});
  });

  it("wrong/mismatched properties for a known event is a compile error", () => {
    const { analytics } = buildAnalytics();

    // @ts-expect-error wrong props: "nope" is not "onboarding" | "settings"
    analytics.capture("user-1", "paywall_view", { source: "nope" });
  });
});
