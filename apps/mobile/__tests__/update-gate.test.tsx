import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Linking from "expo-linking";
import { Text } from "react-native";

import { UpdateGate } from "../src/components/update-gate";
import { resolveStoreUpdateUrl } from "../src/config/store-update-url";

/**
 * T079 "update gate" AC: blocks when required (server minSupportedVersion
 * above the installed version), passes children through otherwise, and the
 * CTA opens the resolved store URL.
 *
 * T080 carry-forward: the gate's decision is a LAUNCH SNAPSHOT (T115: now
 * delegated to `useUpgradeState()`'s own lazy `useState` init, but the
 * guarantee is identical). The pinning cases below assert a post-mount
 * config change (simulating the shared `["app-config"]` cache being
 * refetched by another observer, e.g. the paywall) never swaps the gate
 * over already-live children, in either direction (§5-protective, plan
 * decision 1/2).
 *
 * T115: `useAppConfig` is still the mocked data source (unchanged idiom) --
 * `UpdateGate` -> `useUpgradeState()` -> `resolveUpgradeState()` all run for
 * REAL, so these tests exercise the actual production wiring end to end.
 * `../src/config`'s `getAppVersionWithBuild` is mocked only in the new
 * build-number case below (default real behaviour otherwise resolves to the
 * jest-environment fallback "0.0.0", matching the pre-T115 assumption that
 * kept the original 5 cases passing unmodified).
 */
const mockUseAppConfig = jest.fn();

jest.mock("../src/config/app-config-queries", () => {
  const actual = jest.requireActual("../src/config/app-config-queries");
  return { ...actual, useAppConfig: () => mockUseAppConfig() };
});

const mockGetAppVersionWithBuild = jest.fn();

jest.mock("../src/config", () => {
  const actual = jest.requireActual("../src/config");
  return { ...actual, getAppVersionWithBuild: () => mockGetAppVersionWithBuild() };
});

jest.mock("expo-linking", () => ({
  openURL: jest.fn(),
}));

const mockOpenURL = Linking.openURL as jest.Mock;

describe("UpdateGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAppVersionWithBuild.mockReturnValue("0.0.0");
  });

  it("shows the update-gate screen and hides children when an update is required", async () => {
    mockUseAppConfig.mockReturnValue({
      data: { variant: "A", minSupportedVersion: "99.0.0", hotlinePackVersion: 1 },
    });

    await render(
      <UpdateGate>
        <Text testID="protected-child">Protected content</Text>
      </UpdateGate>,
    );

    expect(screen.getByTestId("update-gate-screen")).toBeTruthy();
    expect(screen.queryByTestId("protected-child")).toBeNull();
  });

  it("the CTA opens the platform-resolved store URL", async () => {
    mockUseAppConfig.mockReturnValue({
      data: { variant: "A", minSupportedVersion: "99.0.0", hotlinePackVersion: 1 },
    });

    await render(
      <UpdateGate>
        <Text testID="protected-child">Protected content</Text>
      </UpdateGate>,
    );

    fireEvent.press(screen.getByTestId("update-gate-cta"));

    expect(mockOpenURL).toHaveBeenCalledWith(resolveStoreUpdateUrl("ios"));
  });

  it("renders children and no gate when the permissive default '0.0.0' is in effect", async () => {
    mockUseAppConfig.mockReturnValue({
      data: { variant: "A", minSupportedVersion: "0.0.0", hotlinePackVersion: 1 },
    });

    await render(
      <UpdateGate>
        <Text testID="protected-child">Protected content</Text>
      </UpdateGate>,
    );

    expect(screen.getByTestId("protected-child")).toBeTruthy();
    expect(screen.queryByTestId("update-gate-screen")).toBeNull();
  });

  it("pins the launch decision: a post-mount config change to a HIGH minSupportedVersion does NOT raise the gate over live children", async () => {
    mockUseAppConfig.mockReturnValue({
      data: { variant: "A", minSupportedVersion: "0.0.0", hotlinePackVersion: 1 },
    });

    const { rerender } = await render(
      <UpdateGate>
        <Text testID="protected-child">Protected content</Text>
      </UpdateGate>,
    );

    expect(screen.getByTestId("protected-child")).toBeTruthy();
    expect(screen.queryByTestId("update-gate-screen")).toBeNull();

    // Simulate the shared `["app-config"]` cache being refetched (e.g. by
    // the paywall's `usePaywallConfig` observer) to a config that would now
    // require an update, then re-render with the SAME mounted component.
    mockUseAppConfig.mockReturnValue({
      data: { variant: "A", minSupportedVersion: "99.0.0", hotlinePackVersion: 1 },
    });

    await rerender(
      <UpdateGate>
        <Text testID="protected-child">Protected content</Text>
      </UpdateGate>,
    );

    expect(screen.getByTestId("protected-child")).toBeTruthy();
    expect(screen.queryByTestId("update-gate-screen")).toBeNull();
  });

  it("pins the launch decision (reverse direction): a post-mount config change to a permissive minSupportedVersion does NOT drop a gate shown at launch", async () => {
    mockUseAppConfig.mockReturnValue({
      data: { variant: "A", minSupportedVersion: "99.0.0", hotlinePackVersion: 1 },
    });

    const { rerender } = await render(
      <UpdateGate>
        <Text testID="protected-child">Protected content</Text>
      </UpdateGate>,
    );

    expect(screen.getByTestId("update-gate-screen")).toBeTruthy();
    expect(screen.queryByTestId("protected-child")).toBeNull();

    mockUseAppConfig.mockReturnValue({
      data: { variant: "A", minSupportedVersion: "0.0.0", hotlinePackVersion: 1 },
    });

    await rerender(
      <UpdateGate>
        <Text testID="protected-child">Protected content</Text>
      </UpdateGate>,
    );

    expect(screen.getByTestId("update-gate-screen")).toBeTruthy();
    expect(screen.queryByTestId("protected-child")).toBeNull();
  });

  it("blocks on the per-platform minAppVersion even when the legacy minSupportedVersion is permissive", async () => {
    mockUseAppConfig.mockReturnValue({
      data: {
        variant: "A",
        minSupportedVersion: "0.0.0",
        hotlinePackVersion: 1,
        minAppVersion: { ios: "2.0.0", android: "2.0.0" },
        recommendedAppVersion: { ios: "2.0.0", android: "2.0.0" },
      },
    });

    await render(
      <UpdateGate>
        <Text testID="protected-child">Protected content</Text>
      </UpdateGate>,
    );

    expect(screen.getByTestId("update-gate-screen")).toBeTruthy();
    expect(screen.queryByTestId("protected-child")).toBeNull();
  });

  it("does NOT block when only recommendedAppVersion is above the installed version", async () => {
    mockUseAppConfig.mockReturnValue({
      data: {
        variant: "A",
        minSupportedVersion: "0.0.0",
        hotlinePackVersion: 1,
        minAppVersion: { ios: "0.0.0", android: "0.0.0" },
        recommendedAppVersion: { ios: "2.0.0", android: "2.0.0" },
      },
    });

    await render(
      <UpdateGate>
        <Text testID="protected-child">Protected content</Text>
      </UpdateGate>,
    );

    expect(screen.getByTestId("protected-child")).toBeTruthy();
    expect(screen.queryByTestId("update-gate-screen")).toBeNull();
  });

  it("blocks when only the BUILD NUMBER is below the platform minimum", async () => {
    mockGetAppVersionWithBuild.mockReturnValue("1.0.0+7");
    mockUseAppConfig.mockReturnValue({
      data: {
        variant: "A",
        minSupportedVersion: "0.0.0",
        hotlinePackVersion: 1,
        minAppVersion: { ios: "1.0.0+10", android: "0.0.0" },
        recommendedAppVersion: { ios: "0.0.0", android: "0.0.0" },
      },
    });

    await render(
      <UpdateGate>
        <Text testID="protected-child">Protected content</Text>
      </UpdateGate>,
    );

    expect(screen.getByTestId("update-gate-screen")).toBeTruthy();
    expect(screen.queryByTestId("protected-child")).toBeNull();
  });

  it("the blocking screen offers no dismiss affordance", async () => {
    mockUseAppConfig.mockReturnValue({
      data: { variant: "A", minSupportedVersion: "99.0.0", hotlinePackVersion: 1 },
    });

    await render(
      <UpdateGate>
        <Text testID="protected-child">Protected content</Text>
      </UpdateGate>,
    );

    expect(screen.queryByTestId("update-gate-dismiss")).toBeNull();
    expect(screen.queryByTestId("update-gate-later")).toBeNull();
    // The CTA is the ONLY testID containing "update-gate-" beyond the
    // screen's own root testID.
    const serialized = JSON.stringify(screen.toJSON());
    const testIdMatches = serialized.match(/"testID":"update-gate-[a-z-]+"/g) ?? [];
    expect(testIdMatches.sort()).toEqual(['"testID":"update-gate-cta"', '"testID":"update-gate-screen"'].sort());

    fireEvent.press(screen.getByTestId("update-gate-cta"));

    expect(mockOpenURL).toHaveBeenCalledTimes(1);
    // Still rendered -- pressing the CTA cannot dismiss the screen itself.
    expect(screen.getByTestId("update-gate-screen")).toBeTruthy();
    expect(screen.queryByTestId("protected-child")).toBeNull();
  });
});
