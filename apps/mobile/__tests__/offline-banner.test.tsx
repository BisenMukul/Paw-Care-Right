import { setOnline } from "@pawcareright/api-client";
import { act, render, screen } from "@testing-library/react-native";

import { OfflineBanner } from "../src/components/offline-banner";
import { strings } from "../src/strings";

/**
 * Global offline banner (T094 plan step 7 / D2). Non-dismissible chrome,
 * laid out in NORMAL FLOW so it can never overlay the Emergency
 * interstitial's hotline numbers (§5 / CLAUDE §7 rule 4) -- see M9's
 * "no absolute positioning" pin below.
 */
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 12, bottom: 0, left: 0, right: 0 }),
}));

describe("OfflineBanner", () => {
  afterEach(async () => {
    await act(async () => {
      setOnline(true);
    });
  });

  it("renders nothing while online", async () => {
    await render(<OfflineBanner />);

    expect(screen.queryByTestId("offline-banner")).toBeNull();
  });

  it("renders an alert-role banner when the shared store goes offline", async () => {
    await act(async () => {
      setOnline(false);
    });

    await render(<OfflineBanner />);

    const banner = screen.getByTestId("offline-banner");
    expect(banner.props.accessibilityRole).toBe("alert");
    expect(screen.getByText(strings.offline.banner)).toBeTruthy();
  });

  it("has no dismiss affordance", async () => {
    await act(async () => {
      setOnline(false);
    });

    await render(<OfflineBanner />);

    const serialized = JSON.stringify(screen.getByTestId("offline-banner"));
    expect(serialized).not.toMatch(/"onPress":/);
    expect(serialized).not.toMatch(/"accessibilityRole":"button"/);
  });

  it("is laid out in normal flow and can never overlay a screen (no absolute positioning)", async () => {
    await act(async () => {
      setOnline(false);
    });

    await render(<OfflineBanner />);

    const banner = screen.getByTestId("offline-banner");
    const className = (banner.props.className as string | undefined) ?? "";
    expect(className).not.toMatch(/\babsolute\b/);
    expect(className).not.toMatch(/\binset-/);
    expect(className).not.toMatch(/\bz-/);

    const style = banner.props.style as Record<string, unknown> | Record<string, unknown>[] | undefined;
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : (style ?? {});
    expect(flatStyle.position).not.toBe("absolute");
  });
});
