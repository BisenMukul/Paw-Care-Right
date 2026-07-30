import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Linking from "expo-linking";

import { useUpgradeBannerStore } from "../src/config/upgrade-banner-store";
import * as useUpgradeStateModule from "../src/config/use-upgrade-state";
import { UpgradeRecommendedBanner } from "../src/components/upgrade-recommended-banner";
import { resolveStoreUpdateUrl } from "../src/config/store-update-url";
import { strings } from "../src/strings";

/**
 * T115 banner spec. Local-module-spy idiom (`jest.spyOn` on
 * `use-upgrade-state`, per the repo's standard) rather than a full
 * `jest.mock`, so the store/gate logic under test stays isolated to this
 * component. `upgrade-banner-store` `reset()` in `beforeEach` so the file is
 * order-independent (T114 Finding 8 lesson).
 */
jest.mock("expo-linking", () => ({
  openURL: jest.fn(),
}));

const mockOpenURL = Linking.openURL as jest.Mock;

describe("UpgradeRecommendedBanner", () => {
  let useUpgradeStateSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    useUpgradeBannerStore.getState().reset();
    useUpgradeStateSpy = jest.spyOn(useUpgradeStateModule, "useUpgradeState");
  });

  afterEach(() => {
    useUpgradeStateSpy.mockRestore();
  });

  it("renders null when state is 'none'", async () => {
    useUpgradeStateSpy.mockReturnValue("none");

    await render(<UpgradeRecommendedBanner />);

    expect(screen.queryByTestId("upgrade-recommended-banner")).toBeNull();
  });

  it("renders null when state is 'blocked' (belt-and-braces: never coexists with the blocking screen)", async () => {
    useUpgradeStateSpy.mockReturnValue("blocked");

    await render(<UpgradeRecommendedBanner />);

    expect(screen.queryByTestId("upgrade-recommended-banner")).toBeNull();
  });

  it("renders the banner with copy read FROM the strings module when state is 'recommended'", async () => {
    useUpgradeStateSpy.mockReturnValue("recommended");

    await render(<UpgradeRecommendedBanner />);

    expect(screen.getByTestId("upgrade-recommended-banner")).toBeTruthy();
    expect(screen.getByText(strings.upgradeBanner.body)).toBeTruthy();
    expect(screen.getByText(strings.upgradeBanner.cta)).toBeTruthy();
    expect(screen.getByText(strings.upgradeBanner.dismiss)).toBeTruthy();
  });

  it("pressing the CTA calls Linking.openURL(resolveStoreUpdateUrl('ios')) exactly once", async () => {
    useUpgradeStateSpy.mockReturnValue("recommended");

    await render(<UpgradeRecommendedBanner />);
    fireEvent.press(screen.getByTestId("upgrade-banner-cta"));

    expect(mockOpenURL).toHaveBeenCalledTimes(1);
    expect(mockOpenURL).toHaveBeenCalledWith(resolveStoreUpdateUrl("ios"));
  });

  it("pressing dismiss hides it and it stays hidden for the session", async () => {
    useUpgradeStateSpy.mockReturnValue("recommended");

    const { rerender } = await render(<UpgradeRecommendedBanner />);
    expect(screen.getByTestId("upgrade-recommended-banner")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("upgrade-banner-dismiss"));

    expect(screen.queryByTestId("upgrade-recommended-banner")).toBeNull();
    expect(useUpgradeBannerStore.getState().dismissed).toBe(true);

    // Still hidden across a re-render with the SAME still-recommended state
    // ("returns on next app launch", not on the same session's re-render).
    await rerender(<UpgradeRecommendedBanner />);
    expect(screen.queryByTestId("upgrade-recommended-banner")).toBeNull();
  });
});
