import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import SettingsScreen from "../app/(tabs)/settings";
import { useEntitlement } from "../src/api/billing-api";
import { useAuthStore } from "../src/auth/auth-store";
import { usePremiumStore } from "../src/billing/premium-store";

/**
 * Founder report: the app had no logout in the UI. Pins the settings
 * sign-out row: it renders, delegates to the auth store's signOut (which
 * revokes server-side and clears SecureStore — the root auth gate then
 * redirects), and busy-guards against double-fire.
 */
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../src/api/billing-api", () => ({
  useEntitlement: jest.fn(),
}));

const mockSignOut = jest.fn();

jest.mock("../src/auth/auth-store", () => {
  const useAuthStore = (selector: (state: { status: string }) => unknown) => selector({ status: "signedIn" });
  useAuthStore.getState = () => ({ status: "signedIn", signOut: mockSignOut });
  return { useAuthStore };
});

const mockedUseEntitlement = useEntitlement as unknown as jest.Mock;

describe("settings screen — sign out (founder gap report)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseEntitlement.mockReturnValue({ data: undefined });
    usePremiumStore.setState({ status: "free" });
  });

  afterEach(() => {
    usePremiumStore.setState({ status: "unknown" });
  });

  it("renders the sign-out row and delegates to the auth store's signOut", async () => {
    let resolveSignOut: () => void = () => undefined;
    mockSignOut.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSignOut = () => resolve();
        }),
    );

    await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId("settings-sign-out"));
    expect(mockSignOut).toHaveBeenCalledTimes(1);

    // Busy guard: a second press while signOut is in flight must not double-fire.
    await fireEvent.press(screen.getByTestId("settings-sign-out"));
    expect(mockSignOut).toHaveBeenCalledTimes(1);

    resolveSignOut();
    await waitFor(() => {
      expect(useAuthStore.getState().signOut).toBe(mockSignOut);
    });
  });
});
