import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import SettingsScreen from "../app/(tabs)/settings";
import { useEntitlement } from "../src/api/billing-api";
import { usePremiumStore } from "../src/billing/premium-store";
import { restorePurchases } from "../src/billing/purchases";

/** T076 "restore from Settings" AC. */
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../src/api/billing-api", () => ({
  useEntitlement: jest.fn(),
}));

jest.mock("../src/billing/purchases", () => ({
  ...jest.requireActual("../src/billing/purchases"),
  restorePurchases: jest.fn(),
}));

const mockedUseEntitlement = useEntitlement as unknown as jest.Mock;
const mockRestorePurchases = restorePurchases as jest.Mock;

describe("settings screen — restore purchases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseEntitlement.mockReturnValue({ data: undefined });
    usePremiumStore.setState({ status: "free" });
  });

  afterEach(() => {
    usePremiumStore.setState({ status: "unknown" });
  });

  it("success+entitled: sets the premium store entitled and shows the success notice", async () => {
    mockRestorePurchases.mockResolvedValue({ status: "success", entitled: true });

    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByTestId("settings-restore"));

    await waitFor(() => {
      expect(usePremiumStore.getState().status).toBe("entitled");
    });
    expect(screen.getByTestId("settings-restore-success")).toBeTruthy();
  });

  it("success+not entitled: shows the neutral restore-none notice, no error, status unchanged", async () => {
    mockRestorePurchases.mockResolvedValue({ status: "success", entitled: false });

    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByTestId("settings-restore"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-restore-none")).toBeTruthy();
    });
    expect(screen.queryByTestId("settings-restore-error")).toBeNull();
    expect(usePremiumStore.getState().status).toBe("free");
  });

  it("error: shows the error notice", async () => {
    mockRestorePurchases.mockResolvedValue({ status: "error" });

    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByTestId("settings-restore"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-restore-error")).toBeTruthy();
    });
    expect(usePremiumStore.getState().status).toBe("free");
  });
});
