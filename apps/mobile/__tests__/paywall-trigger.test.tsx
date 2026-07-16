import { cleanup, renderHook } from "@testing-library/react-native";

import { usePaywallShownStore } from "../src/billing/paywall-shown-store";
import { usePremiumStore } from "../src/billing/premium-store";
import { usePaywallOnboardingTrigger } from "../src/billing/use-paywall-trigger";

/**
 * T074 onboarding-trigger unit tests. `expo-router` is mocked; the premium
 * store's `refresh()` is stubbed to a no-op (it is exercised separately in
 * `billing-offerings.test.ts` via `fetchCustomerInfo`) so each case can
 * seed `usePremiumStore`'s status directly and deterministically.
 */
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("usePaywallOnboardingTrigger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePremiumStore.setState({ status: "unknown", refresh: jest.fn().mockResolvedValue(undefined) });
    usePaywallShownStore.setState({ shown: false });
  });

  afterEach(() => {
    cleanup();
    usePremiumStore.setState({ status: "unknown" });
    usePaywallShownStore.setState({ shown: false });
  });

  it("fires (push onboarding paywall + markShown) when free, count>=1, not shown", async () => {
    usePremiumStore.setState({ status: "free" });

    await renderHook(() => usePaywallOnboardingTrigger({ completedCheckCount: 1 }));

    expect(mockPush).toHaveBeenCalledWith({ pathname: "/paywall", params: { source: "onboarding" } });
    expect(usePaywallShownStore.getState().shown).toBe(true);
  });

  it("does NOT fire when entitled", async () => {
    usePremiumStore.setState({ status: "entitled" });

    await renderHook(() => usePaywallOnboardingTrigger({ completedCheckCount: 1 }));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does NOT fire when status is "unknown" (fail-safe: pre-load / Expo Go)', async () => {
    usePremiumStore.setState({ status: "unknown" });

    await renderHook(() => usePaywallOnboardingTrigger({ completedCheckCount: 1 }));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does NOT fire when already shown", async () => {
    usePremiumStore.setState({ status: "free" });
    usePaywallShownStore.setState({ shown: true });

    await renderHook(() => usePaywallOnboardingTrigger({ completedCheckCount: 1 }));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does NOT fire when completedCheckCount is 0", async () => {
    usePremiumStore.setState({ status: "free" });

    await renderHook(() => usePaywallOnboardingTrigger({ completedCheckCount: 0 }));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("calls refresh() on mount", async () => {
    await renderHook(() => usePaywallOnboardingTrigger({ completedCheckCount: 0 }));

    expect(usePremiumStore.getState().refresh).toHaveBeenCalledTimes(1);
  });
});
