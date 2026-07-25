import { ApiError } from "@pawcareright/api-client";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import SettingsScreen from "../app/(tabs)/settings";
import PrivacyScreen from "../app/settings/privacy";
import { useEntitlement } from "../src/api/billing-api";
import { usePrivacySettings, useUpdatePrivacySettings, useRequestExport, useDeleteAccount } from "../src/api/privacy-api";
import { useConsentStore } from "../src/analytics/consent-store";

/**
 * T091 plan "Tests to write": the analytics-opt-out client-side toggle
 * (SettingsScreen, real `useConsentStore`) and the Privacy & data screen's
 * export/delete confirmation UX (PrivacyScreen). `privacy-api` is mocked
 * for both (mirrors `notification-prefs-screen.test.tsx`'s pattern) — every
 * mutation call is asserted directly rather than exercising a real network
 * round-trip (that's the api e2e suite's job).
 */
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), canGoBack: () => false, replace: jest.fn() }),
}));

jest.mock("../src/api/billing-api", () => ({
  useEntitlement: jest.fn(),
}));

jest.mock("../src/api/privacy-api", () => ({
  usePrivacySettings: jest.fn(),
  useUpdatePrivacySettings: jest.fn(),
  useRequestExport: jest.fn(),
  useDeleteAccount: jest.fn(),
}));

const mockSignOut = jest.fn().mockResolvedValue(undefined);

jest.mock("../src/auth/auth-store", () => {
  const useAuthStore = (selector: (state: { status: string }) => unknown) => selector({ status: "signedIn" });
  useAuthStore.getState = () => ({ status: "signedIn", signOut: mockSignOut });
  return { useAuthStore };
});

const mockedUseEntitlement = useEntitlement as unknown as jest.Mock;
const mockedUsePrivacySettings = usePrivacySettings as unknown as jest.Mock;
const mockedUseUpdatePrivacySettings = useUpdatePrivacySettings as unknown as jest.Mock;
const mockedUseRequestExport = useRequestExport as unknown as jest.Mock;
const mockedUseDeleteAccount = useDeleteAccount as unknown as jest.Mock;

describe("SettingsScreen — analytics toggle also PUTs the server flag (T091)", () => {
  const mockUpdateMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseEntitlement.mockReturnValue({ data: undefined });
    mockedUsePrivacySettings.mockReturnValue({ data: { analyticsOptOut: false, deletionScheduledAt: null } });
    mockedUseUpdatePrivacySettings.mockReturnValue({ mutateAsync: mockUpdateMutateAsync, isPending: false });
    mockUpdateMutateAsync.mockResolvedValue({ analyticsOptOut: true, deletionScheduledAt: null });
    useConsentStore.setState({ enabled: true });
  });

  afterEach(() => {
    useConsentStore.setState({ enabled: true });
  });

  it("toggling analytics off calls PUT /me/privacy with analyticsOptOut: true", async () => {
    await render(<SettingsScreen />);

    await fireEvent(screen.getByTestId("settings-analytics-toggle"), "valueChange", false);

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({ analyticsOptOut: true });
    });
    expect(useConsentStore.getState().enabled).toBe(false);
  });

  it("a failed toggle reverts the switch and shows the error notice", async () => {
    mockUpdateMutateAsync.mockRejectedValueOnce(new Error("network down"));

    await render(<SettingsScreen />);

    await fireEvent(screen.getByTestId("settings-analytics-toggle"), "valueChange", false);

    await waitFor(() => {
      expect(screen.getByTestId("settings-analytics-error")).toBeTruthy();
    });
    expect(useConsentStore.getState().enabled).toBe(true);
  });
});

describe("PrivacyScreen (T091)", () => {
  const mockDeleteMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUsePrivacySettings.mockReturnValue({
      data: { analyticsOptOut: false, deletionScheduledAt: null },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    mockedUseRequestExport.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({}), isPending: false });
    mockedUseDeleteAccount.mockReturnValue({ mutateAsync: mockDeleteMutateAsync, isPending: false });
  });

  it("delete requires two confirmations before any request is sent", async () => {
    await render(<PrivacyScreen />);

    expect(screen.queryByTestId("privacy-delete-confirm-panel")).toBeNull();
    expect(mockDeleteMutateAsync).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("privacy-delete-button"));
    expect(screen.getByTestId("privacy-delete-confirm-panel")).toBeTruthy();
    expect(mockDeleteMutateAsync).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("privacy-delete-confirm-button"));
    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalledTimes(1);
    });
  });

  it("the confirmation copy states the 30-day window and that signing in cancels it", async () => {
    await render(<PrivacyScreen />);

    await fireEvent.press(screen.getByTestId("privacy-delete-button"));

    const graceText = screen.getByTestId("privacy-delete-grace");
    expect(graceText).toHaveTextContent("30", { exact: false });
    expect(graceText).toHaveTextContent(/signing back in/i);
  });

  it("a 409 response renders the shared-household explanation", async () => {
    mockDeleteMutateAsync.mockRejectedValueOnce(
      new ApiError({ code: "CONFLICT", message: "Conflict", httpStatus: 409, requestId: "req-1" }),
    );

    await render(<PrivacyScreen />);
    await fireEvent.press(screen.getByTestId("privacy-delete-button"));
    await fireEvent.press(screen.getByTestId("privacy-delete-confirm-button"));

    await waitFor(() => {
      expect(screen.getByTestId("privacy-delete-conflict")).toBeTruthy();
    });
    expect(screen.queryByTestId("privacy-delete-error")).toBeNull();
  });

  it("a non-conflict failure renders the generic error notice", async () => {
    mockDeleteMutateAsync.mockRejectedValueOnce(new Error("network down"));

    await render(<PrivacyScreen />);
    await fireEvent.press(screen.getByTestId("privacy-delete-button"));
    await fireEvent.press(screen.getByTestId("privacy-delete-confirm-button"));

    await waitFor(() => {
      expect(screen.getByTestId("privacy-delete-error")).toBeTruthy();
    });
  });
});
