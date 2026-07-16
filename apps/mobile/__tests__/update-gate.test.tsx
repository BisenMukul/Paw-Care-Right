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
 * T080 carry-forward: the gate's decision is a LAUNCH SNAPSHOT (lazy
 * `useState` init), not a reactive read of `useAppConfig()`. The pinning
 * cases below assert a post-mount config change (simulating the shared
 * `["app-config"]` cache being refetched by another observer, e.g. the
 * paywall) never swaps the gate over already-live children, in either
 * direction (§5-protective, plan decision 1/2).
 */
const mockUseAppConfig = jest.fn();

jest.mock("../src/config/app-config-queries", () => ({
  useAppConfig: () => mockUseAppConfig(),
}));

jest.mock("expo-linking", () => ({
  openURL: jest.fn(),
}));

const mockOpenURL = Linking.openURL as jest.Mock;

describe("UpdateGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
