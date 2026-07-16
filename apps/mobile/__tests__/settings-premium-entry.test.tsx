import { APP_DISPLAY_NAME } from "@pawcareright/config";
import { fireEvent, render, screen } from "@testing-library/react-native";

import SettingsScreen from "../app/(tabs)/settings";

/** T074 "Settings entry" AC. */
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("settings screen — premium entry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders a premium row labeled with the app display name", async () => {
    await render(<SettingsScreen />);

    expect(screen.getByTestId("settings-premium")).toHaveTextContent(APP_DISPLAY_NAME, { exact: false });
  });

  it("pressing it navigates to /paywall with source=settings", async () => {
    await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId("settings-premium"));

    expect(mockPush).toHaveBeenCalledWith({ pathname: "/paywall", params: { source: "settings" } });
  });
});
