import type { NotificationPrefs } from "@pawcareright/types";
import { REMINDER_TYPES } from "@pawcareright/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import NotificationPrefsScreen from "../app/settings/notifications";
import { useNotificationPrefs, useUpdateNotificationPrefs } from "../src/api/notification-prefs-api";

/**
 * Notifications settings screen (T058 plan): schema-driven toggle count
 * (one per `REMINDER_TYPES` entry, proving it isn't a hardcoded list),
 * toggle + Save producing the expected `disabledTypes` payload, and
 * enabling quiet hours + picking times including `quietHours` in the
 * payload. `notification-prefs-api` hooks are mocked (mirrors
 * `family-screen.test.tsx`). RNTL v14 — every render/press is awaited.
 */
jest.mock("../src/api/notification-prefs-api", () => ({
  useNotificationPrefs: jest.fn(),
  useUpdateNotificationPrefs: jest.fn(),
}));

const mockedUseNotificationPrefs = useNotificationPrefs as unknown as jest.Mock;
const mockedUseUpdateNotificationPrefs = useUpdateNotificationPrefs as unknown as jest.Mock;
const mockRefetch = jest.fn();
const mockMutateAsync = jest.fn();

const DEFAULT_PREFS: NotificationPrefs = { disabledTypes: [], quietHours: null };

describe("notification prefs screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseUpdateNotificationPrefs.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });
    mockMutateAsync.mockResolvedValue(DEFAULT_PREFS);
  });

  it("loading: shows notifications-loading", async () => {
    mockedUseNotificationPrefs.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: mockRefetch,
    });

    await render(<NotificationPrefsScreen />);

    expect(screen.getByTestId("notifications-loading")).toBeTruthy();
  });

  it("error: shows notifications-error; retry calls refetch once", async () => {
    mockedUseNotificationPrefs.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    });

    await render(<NotificationPrefsScreen />);

    expect(screen.getByTestId("notifications-error")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("notifications-retry"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("[AC] renders one toggle per REMINDER_TYPES entry (schema-driven count)", async () => {
    mockedUseNotificationPrefs.mockReturnValue({
      data: DEFAULT_PREFS,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    await render(<NotificationPrefsScreen />);

    for (const type of REMINDER_TYPES) {
      expect(screen.getByTestId(`notifications-type-switch-${type}`)).toBeTruthy();
    }
    expect(screen.getAllByTestId(/^notifications-type-switch-/)).toHaveLength(REMINDER_TYPES.length);
  });

  it("[AC] toggling a type off + Save calls the mutation with the expected disabledTypes", async () => {
    mockedUseNotificationPrefs.mockReturnValue({
      data: DEFAULT_PREFS,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    await render(<NotificationPrefsScreen />);

    await fireEvent(screen.getByTestId(`notifications-type-switch-${REMINDER_TYPES[0]}`), "valueChange", false);
    await fireEvent.press(screen.getByTestId("notifications-save"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        disabledTypes: [REMINDER_TYPES[0]],
        quietHours: null,
      });
    });
  });

  it("[AC] enabling quiet hours + selecting times includes quietHours in the save payload", async () => {
    mockedUseNotificationPrefs.mockReturnValue({
      data: DEFAULT_PREFS,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    await render(<NotificationPrefsScreen />);

    await fireEvent(screen.getByTestId("notifications-quiet-enable"), "valueChange", true);
    await fireEvent.press(screen.getByTestId("notifications-quiet-start-22:30"));
    await fireEvent.press(screen.getByTestId("notifications-quiet-end-06:30"));
    await fireEvent.press(screen.getByTestId("notifications-save"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          quietHours: expect.objectContaining({ start: "22:30", end: "06:30" }),
        }),
      );
    });
  });

  it("shows a save error when the mutation fails, without crashing", async () => {
    mockedUseNotificationPrefs.mockReturnValue({
      data: DEFAULT_PREFS,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });
    mockMutateAsync.mockRejectedValue(new Error("network down"));

    await render(<NotificationPrefsScreen />);
    await fireEvent.press(screen.getByTestId("notifications-save"));

    await waitFor(() => {
      expect(screen.getByTestId("notifications-save-error")).toBeTruthy();
    });
  });
});
