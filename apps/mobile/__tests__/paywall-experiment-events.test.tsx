import { render, screen } from "@testing-library/react-native";

import PaywallScreen from "../app/paywall";
import { useAuthStore } from "../src/auth/auth-store";
import type { PaywallOffering } from "../src/billing/paywall-types";
import { resetPaywallExperimentSession } from "../src/experiments/paywall-experiment";
import { usePaywallExperimentAssignment } from "../src/experiments/use-paywall-experiment-assignment";

/**
 * T107 plan AC1 — the executor-provable half ("Assignment + exposure events
 * verified in staging" splits into a mocked-flow proof here + a `[FOUNDER]`
 * staging step, doc §7). Mirrors `apps/mobile/__tests__/paywall-analytics.test.tsx:14-37`'s
 * mock shape for `usePaywallConfig`/`useOfferings`/`expo-router`.
 *
 * `captureEvent` is normally routed to a plain jest mock (clean call-arg
 * assertions across most tests), EXCEPT the one "signed out" test below,
 * which flips `mockUseRealCaptureEvent` so the REAL `captureEvent` runs --
 * proving the sign-in no-op guard actually holds for this wiring (not just
 * for a mocked stand-in), following the `analytics-consent.test.ts:56-78`
 * idiom (non-empty `posthogKey`, a spied `fetch`).
 */
const mockCaptureEvent = jest.fn();
let mockUseRealCaptureEvent = false;
jest.mock("../src/analytics/analytics", () => ({
  captureEvent: (...args: unknown[]) => {
    if (mockUseRealCaptureEvent) {
      const actual = jest.requireActual<typeof import("../src/analytics/analytics")>("../src/analytics/analytics");
      (actual.captureEvent as (...callArgs: unknown[]) => void)(...args);
      return;
    }
    mockCaptureEvent(...args);
  },
}));

// Non-empty `posthogKey` (unused unless `mockUseRealCaptureEvent` is true)
// so the REAL transport in the "signed out" test is not itself a no-op for
// the wrong reason (an empty key) -- the fetch-spy assertion in that test
// proves the SIGN-IN guard, not the stub-safe-key guard.
jest.mock("../src/config", () => ({
  getConfig: () => ({
    apiBaseUrl: "http://localhost:3000",
    googleClientId: "",
    revenueCatIosKey: "stub_ios_key",
    revenueCatAndroidKey: "stub_android_key",
    termsUrl: "https://bombaypetcompany.app/terms",
    privacyUrl: "https://bombaypetcompany.app/privacy",
    posthogKey: "phc_test_key",
    posthogHost: "https://us.i.posthog.com",
    sentryDsn: "",
    gitSha: "dev",
    betaBanner: false,
  }),
}));

const mockUsePaywallConfig = jest.fn();
const mockUseOfferings = jest.fn();
jest.mock("../src/billing/paywall-queries", () => ({
  usePaywallConfig: () => mockUsePaywallConfig(),
  useOfferings: () => mockUseOfferings(),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ source: "onboarding" }),
}));

const FIXTURE_OFFERING: PaywallOffering = {
  packages: [{ id: "monthly", priceString: "$4.99/mo", introPriceString: "Free for 7 days", rcPackage: {} }],
};

/** Minimal probe: renders nothing, mounts only the assignment hook under test. */
function AssignmentProbe() {
  usePaywallExperimentAssignment();
  return null;
}

function eventCalls(name: string): unknown[][] {
  return mockCaptureEvent.mock.calls.filter((call) => call[0] === name);
}

/**
 * Fix-round (F1+F2): `useResolvedPaywallVariant()` now calls `.refetch()`
 * on the mocked `usePaywallConfig()` return value before it will ever mark
 * anything `resolved` (see `use-resolved-paywall-variant.ts`) -- every
 * mocked variant fixture below must supply a `refetch` that resolves, or
 * the assignment/exposure effects in this mocked-flow suite would spin
 * forever. `data` and the `refetch` result intentionally carry the SAME
 * variant, matching an already-authenticated, steady-state session (the
 * anonymous/mid-flip races these mocks deliberately do NOT exercise are
 * covered, with the REAL auth+query layers, by
 * `paywall-experiment-auth-resolution.test.tsx`).
 */
function mockPaywallConfig(variant: "A" | "B") {
  mockUsePaywallConfig.mockReturnValue({
    data: { variant },
    refetch: jest.fn().mockResolvedValue({ data: { variant } }),
  });
}

describe("paywall experiment — assignment + exposure events (T107 AC1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRealCaptureEvent = false;
    resetPaywallExperimentSession();
    mockUseOfferings.mockReturnValue({ data: FIXTURE_OFFERING, isLoading: false });
    useAuthStore.setState({
      status: "signedIn",
      user: { id: "user-1", email: "user@example.com" },
      householdId: null,
    });
  });

  it("emits paywall_experiment_assigned once per session with the resolved variant", async () => {
    mockPaywallConfig("B");

    await render(<AssignmentProbe />);

    expect(mockCaptureEvent).toHaveBeenCalledTimes(1);
    expect(mockCaptureEvent).toHaveBeenCalledWith("paywall_experiment_assigned", {
      experiment: "paywall_copy_ab",
      variant: "B",
    });
  });

  it("does not re-emit assignment on re-render or remount within the same session", async () => {
    mockPaywallConfig("A");

    const view = await render(<AssignmentProbe />);
    await view.rerender(<AssignmentProbe />);
    await view.unmount();
    await render(<AssignmentProbe />);

    expect(eventCalls("paywall_experiment_assigned")).toHaveLength(1);
  });

  it("re-emits assignment when the server variant changes mid-session", async () => {
    mockPaywallConfig("A");
    const view = await render(<AssignmentProbe />);

    mockPaywallConfig("B");
    await view.rerender(<AssignmentProbe />);

    const assigned = eventCalls("paywall_experiment_assigned");
    expect(assigned).toHaveLength(2);
    expect(assigned[1]?.[1]).toEqual({ experiment: "paywall_copy_ab", variant: "B" });
  });

  it("emits paywall_experiment_exposed on paywall mount with the rendered variant (A)", async () => {
    mockPaywallConfig("A");

    await render(<PaywallScreen />);

    const exposed = eventCalls("paywall_experiment_exposed");
    expect(exposed).toHaveLength(1);
    expect(exposed[0]?.[1]).toEqual({ experiment: "paywall_copy_ab", variant: "A" });
  });

  it("emits paywall_experiment_exposed with variant B and renders the B trial framing", async () => {
    mockPaywallConfig("B");

    await render(<PaywallScreen />);

    const exposed = eventCalls("paywall_experiment_exposed");
    expect(exposed).toHaveLength(1);
    expect(exposed[0]?.[1]).toEqual({ experiment: "paywall_copy_ab", variant: "B" });

    expect(screen.getByTestId("paywall-trial-badge")).toHaveTextContent("Free for 7 days", { exact: false });
    expect(screen.getByTestId("paywall-trial-cta")).toHaveTextContent("Try it free for 7 days", { exact: false });
  });

  it("does not re-emit exposure on re-render of the same variant", async () => {
    mockPaywallConfig("A");

    const view = await render(<PaywallScreen />);
    await view.rerender(<PaywallScreen />);

    expect(eventCalls("paywall_experiment_exposed")).toHaveLength(1);
  });

  it("emits paywall_view and the exposure event exactly once each per mount", async () => {
    mockPaywallConfig("A");

    await render(<PaywallScreen />);

    expect(eventCalls("paywall_view")).toHaveLength(1);
    expect(eventCalls("paywall_experiment_exposed")).toHaveLength(1);
  });

  it("emits nothing when nobody is signed in", async () => {
    mockUseRealCaptureEvent = true;
    useAuthStore.setState({ status: "signedOut", user: null, householdId: null });
    mockPaywallConfig("A");

    const fetchSpy = jest.fn().mockResolvedValue({ ok: true });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    try {
      await render(<PaywallScreen />);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(mockCaptureEvent).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
