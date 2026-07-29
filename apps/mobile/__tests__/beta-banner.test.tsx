import { setOnline } from "@bombaypetcompany/api-client";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 12, bottom: 0, left: 0, right: 0 }),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../src/config", () => ({
  getConfig: jest.fn(),
}));

import { getConfig } from "../src/config";
import { BetaBanner } from "../src/components/beta-banner";
import { strings } from "../src/strings";

const mockGetConfig = getConfig as jest.Mock;

/**
 * T104 plan D6: root-mounted, flag-gated, non-dismissible beta banner with
 * a feedback CTA. §7 rule 4: must never overlay the Emergency
 * interstitial's hotline numbers -- mirrors `offline-banner.test.tsx`'s
 * "no absolute positioning" pin.
 */
describe("BetaBanner", () => {
  afterEach(async () => {
    jest.clearAllMocks();
    await act(async () => {
      setOnline(true);
    });
  });

  it("renders nothing when the beta flag is off", async () => {
    mockGetConfig.mockReturnValue({ betaBanner: false });

    await render(<BetaBanner />);

    expect(screen.queryByTestId("beta-banner")).toBeNull();
  });

  it("renders the CTA and routes to /feedback when on", async () => {
    mockGetConfig.mockReturnValue({ betaBanner: true });

    await render(<BetaBanner />);

    expect(screen.getByTestId("beta-banner")).toBeTruthy();
    expect(screen.getByText(strings.feedback.betaBanner.label)).toBeTruthy();

    const cta = screen.getByTestId("beta-banner-cta");
    fireEvent.press(cta);
    expect(mockPush).toHaveBeenCalledWith("/feedback");
  });

  it("never uses absolute positioning (§7 rule 4)", async () => {
    mockGetConfig.mockReturnValue({ betaBanner: true });

    await render(<BetaBanner />);

    const banner = screen.getByTestId("beta-banner");
    const className = (banner.props.className as string | undefined) ?? "";
    expect(className).not.toMatch(/\babsolute\b/);
    expect(className).not.toMatch(/\binset-/);
    expect(className).not.toMatch(/\bz-/);

    const style = banner.props.style as Record<string, unknown> | Record<string, unknown>[] | undefined;
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : (style ?? {});
    expect(flatStyle.position).not.toBe("absolute");
  });

  it("does not double-apply safe-area padding while offline", async () => {
    mockGetConfig.mockReturnValue({ betaBanner: true });
    await act(async () => {
      setOnline(false);
    });

    await render(<BetaBanner />);

    const banner = screen.getByTestId("beta-banner");
    const style = banner.props.style as Record<string, unknown>;
    expect(style.paddingTop).toBe(0);
  });

  it("applies the safe-area inset while online", async () => {
    mockGetConfig.mockReturnValue({ betaBanner: true });

    await render(<BetaBanner />);

    const banner = screen.getByTestId("beta-banner");
    const style = banner.props.style as Record<string, unknown>;
    expect(style.paddingTop).toBe(12);
  });
});
