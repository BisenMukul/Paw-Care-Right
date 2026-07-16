import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import PaywallScreen from "../app/paywall";
import { usePremiumStore } from "../src/billing/premium-store";
import type { PaywallOffering } from "../src/billing/paywall-types";
import { restorePurchases } from "../src/billing/purchases";

/** T074 "restore flow" AC. */
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => ({ source: "settings" }),
}));

jest.mock("../src/billing/purchases", () => ({
  ...jest.requireActual("../src/billing/purchases"),
  restorePurchases: jest.fn(),
}));

const mockUsePaywallConfig = jest.fn();
const mockUseOfferings = jest.fn();

jest.mock("../src/billing/paywall-queries", () => ({
  usePaywallConfig: () => mockUsePaywallConfig(),
  useOfferings: () => mockUseOfferings(),
}));

const mockRestorePurchases = restorePurchases as jest.Mock;

const FIXTURE_OFFERING: PaywallOffering = {
  packages: [
    { id: "monthly", priceString: "$4.99/mo", rcPackage: {} },
    { id: "annual", priceString: "$39.99/yr", rcPackage: {} },
    { id: "family", priceString: "$59.99/yr", rcPackage: {} },
  ],
};

describe("paywall screen — restore flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePremiumStore.setState({ status: "free" });
    mockUsePaywallConfig.mockReturnValue({ data: { variant: "A" } });
    mockUseOfferings.mockReturnValue({ data: FIXTURE_OFFERING, isLoading: false });
  });

  afterEach(() => {
    usePremiumStore.setState({ status: "unknown" });
  });

  it("success+entitled: store becomes entitled and the screen dismisses", async () => {
    mockRestorePurchases.mockResolvedValue({ status: "success", entitled: true });

    await render(<PaywallScreen />);
    await fireEvent.press(screen.getByTestId("paywall-restore"));

    await waitFor(() => {
      expect(usePremiumStore.getState().status).toBe("entitled");
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("success+not entitled: shows the neutral restore-none notice, not an error", async () => {
    mockRestorePurchases.mockResolvedValue({ status: "success", entitled: false });

    await render(<PaywallScreen />);
    await fireEvent.press(screen.getByTestId("paywall-restore"));

    await waitFor(() => {
      expect(screen.getByTestId("paywall-restore-none")).toBeTruthy();
    });
    expect(screen.queryByTestId("paywall-error-notice")).toBeNull();
    expect(mockBack).not.toHaveBeenCalled();
    expect(usePremiumStore.getState().status).toBe("free");
  });

  it("error: shows the error notice", async () => {
    mockRestorePurchases.mockResolvedValue({ status: "error" });

    await render(<PaywallScreen />);
    await fireEvent.press(screen.getByTestId("paywall-restore"));

    await waitFor(() => {
      expect(screen.getByTestId("paywall-error-notice")).toBeTruthy();
    });
    expect(mockBack).not.toHaveBeenCalled();
    expect(usePremiumStore.getState().status).toBe("free");
  });
});
