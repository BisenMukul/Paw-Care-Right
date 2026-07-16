import { render } from "@testing-library/react-native";

import PaywallScreen from "../app/paywall";
import { useAuthStore } from "../src/auth/auth-store";
import type { PaywallOffering } from "../src/billing/paywall-types";

/**
 * AC "emissions asserted — paywall_view" (T078 plan). `captureEvent` is
 * mocked so this test proves ONLY the wiring (call count/args), independent
 * of the consent gate / transport (covered by `analytics-consent.test.ts`
 * and the `packages/analytics` suite).
 */
const mockCaptureEvent = jest.fn();
jest.mock("../src/analytics/analytics", () => ({
  captureEvent: (...args: unknown[]) => mockCaptureEvent(...args),
}));

const mockUsePaywallConfig = jest.fn();
const mockUseOfferings = jest.fn();
jest.mock("../src/billing/paywall-queries", () => ({
  usePaywallConfig: () => mockUsePaywallConfig(),
  useOfferings: () => mockUseOfferings(),
}));

// Reassigned per-test below; a `mock`-prefixed name is required so jest
// allows referencing it inside the `jest.mock` factory.
let mockSearchParams: { source?: string } = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockSearchParams,
}));

const FIXTURE_OFFERING: PaywallOffering = {
  packages: [{ id: "monthly", priceString: "$4.99/mo", rcPackage: {} }],
};

describe("paywall screen — paywall_view analytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = {};
    mockUsePaywallConfig.mockReturnValue({ data: { variant: "A" } });
    mockUseOfferings.mockReturnValue({ data: FIXTURE_OFFERING, isLoading: false });
    useAuthStore.setState({ householdId: null });
  });

  it("mounting with source: 'onboarding' emits paywall_view exactly once with that source", async () => {
    mockSearchParams = { source: "onboarding" };

    await render(<PaywallScreen />);

    expect(mockCaptureEvent).toHaveBeenCalledTimes(1);
    expect(mockCaptureEvent).toHaveBeenCalledWith("paywall_view", { source: "onboarding" });
  });

  it("mounting with source: 'settings' emits paywall_view with that source", async () => {
    mockSearchParams = { source: "settings" };

    await render(<PaywallScreen />);

    expect(mockCaptureEvent).toHaveBeenCalledTimes(1);
    expect(mockCaptureEvent).toHaveBeenCalledWith("paywall_view", { source: "settings" });
  });

  it("an undefined/unrecognized source param defaults to 'onboarding'", async () => {
    mockSearchParams = {};

    await render(<PaywallScreen />);

    expect(mockCaptureEvent).toHaveBeenCalledWith("paywall_view", { source: "onboarding" });
  });

  it("includes householdId when the signed-in user has one", async () => {
    mockSearchParams = { source: "onboarding" };
    useAuthStore.setState({ householdId: "household-1" });

    await render(<PaywallScreen />);

    expect(mockCaptureEvent).toHaveBeenCalledWith("paywall_view", {
      source: "onboarding",
      householdId: "household-1",
    });
  });

  it("re-rendering (not remounting) within a single mount does not double-count", async () => {
    mockSearchParams = { source: "onboarding" };

    const view = await render(<PaywallScreen />);
    view.rerender(<PaywallScreen />);

    expect(mockCaptureEvent).toHaveBeenCalledTimes(1);
  });
});
