import { fireEvent, render, screen } from "@testing-library/react-native";

import SettingsScreen from "../app/(tabs)/settings";
import { useEntitlement } from "../src/api/billing-api";
import { openManageSubscription } from "../src/billing/manage-subscription";

/** T076 "manage row visibility + wiring" AC. */
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../src/api/billing-api", () => ({
  useEntitlement: jest.fn(),
}));

jest.mock("../src/billing/manage-subscription", () => ({
  openManageSubscription: jest.fn(),
}));

jest.mock("../src/billing/purchases", () => ({
  ...jest.requireActual("../src/billing/purchases"),
  restorePurchases: jest.fn().mockResolvedValue({ status: "error" }),
}));

const mockedUseEntitlement = useEntitlement as unknown as jest.Mock;
const mockedOpenManageSubscription = openManageSubscription as jest.Mock;

describe("settings screen — manage subscription row", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("is present when entitled and pressing it opens the manage-subscription flow", async () => {
    mockedUseEntitlement.mockReturnValue({
      data: { entitled: true, source: "own", plan: "pawcareright_monthly", expiresAt: null, billingIssue: false },
    });

    await render(<SettingsScreen />);
    expect(screen.getByTestId("settings-manage")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("settings-manage"));
    expect(mockedOpenManageSubscription).toHaveBeenCalledTimes(1);
  });

  it("is absent when not entitled", async () => {
    mockedUseEntitlement.mockReturnValue({
      data: { entitled: false, source: "none", plan: null, expiresAt: null, billingIssue: false },
    });

    await render(<SettingsScreen />);

    expect(screen.queryByTestId("settings-manage")).toBeNull();
  });

  it("is absent while entitlement is loading (data: undefined)", async () => {
    mockedUseEntitlement.mockReturnValue({ data: undefined });

    await render(<SettingsScreen />);

    expect(screen.queryByTestId("settings-manage")).toBeNull();
  });
});
