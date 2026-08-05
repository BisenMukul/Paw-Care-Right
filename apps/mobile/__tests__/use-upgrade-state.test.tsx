import { renderHook } from "@testing-library/react-native";

import { useUpgradeState } from "../src/config/use-upgrade-state";

/**
 * T115: `useUpgradeState` hook spec.
 * - per-field fallback to `DEFAULT_APP_CONFIG` when the mocked `useAppConfig()`
 *   returns a PARTIAL config (no `minAppVersion`/`recommendedAppVersion`) --
 *   the invariant that keeps `emergency-interstitial.test.tsx` /
 *   `paywall-config.test.tsx` green without editing them.
 * - mount-snapshot semantics: a post-mount config change (either direction)
 *   never changes the returned value (mirrors `update-gate.test.tsx`'s
 *   pinning cases / T080 decision 1).
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

describe("useUpgradeState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAppVersionWithBuild.mockReturnValue("1.0.0");
  });

  it("returns 'none' when useAppConfig() returns a PARTIAL config with no minAppVersion/recommendedAppVersion (per-field fallback => fail-open)", async () => {
    mockUseAppConfig.mockReturnValue({
      data: { variant: "A", minSupportedVersion: "0.0.0", hotlinePackVersion: 1, features: { checks: true, chat: true, paywall: true } },
    });

    const { result } = await renderHook(() => useUpgradeState());

    expect(result.current).toBe("none");
  });

  it("resolves 'blocked' when minAppVersion is present and above the installed version", async () => {
    mockUseAppConfig.mockReturnValue({
      data: {
        variant: "A",
        minSupportedVersion: "0.0.0",
        hotlinePackVersion: 1,
        features: { checks: true, chat: true, paywall: true },
        criticalOtaVersion: null,
        minAppVersion: { ios: "9.0.0", android: "9.0.0" },
        recommendedAppVersion: { ios: "9.0.0", android: "9.0.0" },
      },
    });

    const { result } = await renderHook(() => useUpgradeState());

    expect(result.current).toBe("blocked");
  });

  it("mount snapshot: a post-mount config change permissive -> blocking does NOT change the returned value", async () => {
    mockUseAppConfig.mockReturnValue({
      data: {
        minSupportedVersion: "0.0.0",
        minAppVersion: { ios: "0.0.0", android: "0.0.0" },
        recommendedAppVersion: { ios: "0.0.0", android: "0.0.0" },
      },
    });

    const { result, rerender } = await renderHook(() => useUpgradeState());

    expect(result.current).toBe("none");

    mockUseAppConfig.mockReturnValue({
      data: {
        minSupportedVersion: "0.0.0",
        minAppVersion: { ios: "99.0.0", android: "99.0.0" },
        recommendedAppVersion: { ios: "99.0.0", android: "99.0.0" },
      },
    });
    await rerender({});

    expect(result.current).toBe("none");
  });

  it("mount snapshot: a post-mount config change blocking -> permissive does NOT change the returned value", async () => {
    mockUseAppConfig.mockReturnValue({
      data: {
        minSupportedVersion: "0.0.0",
        minAppVersion: { ios: "99.0.0", android: "99.0.0" },
        recommendedAppVersion: { ios: "99.0.0", android: "99.0.0" },
      },
    });

    const { result, rerender } = await renderHook(() => useUpgradeState());

    expect(result.current).toBe("blocked");

    mockUseAppConfig.mockReturnValue({
      data: {
        minSupportedVersion: "0.0.0",
        minAppVersion: { ios: "0.0.0", android: "0.0.0" },
        recommendedAppVersion: { ios: "0.0.0", android: "0.0.0" },
      },
    });
    await rerender({});

    expect(result.current).toBe("blocked");
  });
});
