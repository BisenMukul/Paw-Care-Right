import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import PaywallScreen from "../app/paywall";
import { usePremiumStore } from "../src/billing/premium-store";
import type { PaywallOffering } from "../src/billing/paywall-types";
import { purchasePackage } from "../src/billing/purchases";

/** T074 "purchase … success/user-cancel/pending" ACs. */
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => ({ source: "onboarding" }),
}));

jest.mock("../src/billing/purchases", () => ({
  ...jest.requireActual("../src/billing/purchases"),
  purchasePackage: jest.fn(),
}));

const mockUsePaywallConfig = jest.fn();
const mockUseOfferings = jest.fn();

jest.mock("../src/billing/paywall-queries", () => ({
  usePaywallConfig: () => mockUsePaywallConfig(),
  useOfferings: () => mockUseOfferings(),
}));

const mockPurchasePackage = purchasePackage as jest.Mock;

const FIXTURE_OFFERING: PaywallOffering = {
  packages: [
    { id: "monthly", priceString: "$4.99/mo", introPriceString: "Free for 7 days", rcPackage: {} },
    { id: "annual", priceString: "$39.99/yr", rcPackage: {} },
    { id: "family", priceString: "$59.99/yr", rcPackage: {} },
  ],
};

describe("paywall screen — purchase flows", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePremiumStore.setState({ status: "free" });
    mockUsePaywallConfig.mockReturnValue({ data: { variant: "A" } });
    mockUseOfferings.mockReturnValue({ data: FIXTURE_OFFERING, isLoading: false });
  });

  afterEach(() => {
    usePremiumStore.setState({ status: "unknown" });
  });

  it("success: store becomes entitled and router.back() is called", async () => {
    const entitledCustomerInfo = { entitlements: { active: { plus: {} } } };
    mockPurchasePackage.mockResolvedValue({ status: "success", customerInfo: entitledCustomerInfo });

    await render(<PaywallScreen />);
    await fireEvent.press(screen.getByTestId("paywall-plan-annual"));

    await waitFor(() => {
      expect(usePremiumStore.getState().status).toBe("entitled");
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("user-cancel: screen stays mounted, no navigation, no error notice, store unchanged", async () => {
    mockPurchasePackage.mockResolvedValue({ status: "cancelled" });

    await render(<PaywallScreen />);
    await fireEvent.press(screen.getByTestId("paywall-plan-monthly"));

    await waitFor(() => {
      expect(mockPurchasePackage).toHaveBeenCalledTimes(1);
    });

    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.queryByTestId("paywall-error-notice")).toBeNull();
    expect(screen.getByTestId("paywall-screen")).toBeTruthy();
    expect(usePremiumStore.getState().status).toBe("free");
  });

  it("pending: shows the pending notice, no navigation, store not entitled", async () => {
    mockPurchasePackage.mockResolvedValue({ status: "pending" });

    await render(<PaywallScreen />);
    await fireEvent.press(screen.getByTestId("paywall-plan-family"));

    await waitFor(() => {
      expect(screen.getByTestId("paywall-pending-notice")).toBeTruthy();
    });
    expect(mockBack).not.toHaveBeenCalled();
    expect(usePremiumStore.getState().status).toBe("free");
  });

  it("error: shows the error notice, no navigation, store unchanged", async () => {
    mockPurchasePackage.mockResolvedValue({ status: "error" });

    await render(<PaywallScreen />);
    await fireEvent.press(screen.getByTestId("paywall-trial-cta"));

    await waitFor(() => {
      expect(screen.getByTestId("paywall-error-notice")).toBeTruthy();
    });
    expect(mockBack).not.toHaveBeenCalled();
    expect(usePremiumStore.getState().status).toBe("free");
  });

  it("dismiss: Maybe later calls router.back() without purchasing", async () => {
    await render(<PaywallScreen />);
    await fireEvent.press(screen.getByTestId("paywall-maybe-later"));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPurchasePackage).not.toHaveBeenCalled();
  });
});
