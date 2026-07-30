import type { PlatformAppVersions } from "@bombaypetcompany/types";

import {
  compareVersions,
  isUpdateRequired,
  resolvePlatformVersion,
  resolveUpgradeState,
  type UpgradeState,
  type UpgradeStateInput,
} from "../src/config/version-gate";

describe("compareVersions", () => {
  it("returns -1 when a < b", () => {
    expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
  });

  it("returns 0 when a === b", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });

  it("returns 1 when a > b", () => {
    expect(compareVersions("2.0.0", "1.9.9")).toBe(1);
  });

  it("compares multi-digit segments numerically, not lexically (1.2.10 > 1.2.9)", () => {
    expect(compareVersions("1.2.10", "1.2.9")).toBe(1);
    expect(compareVersions("1.2.9", "1.2.10")).toBe(-1);
  });

  it("returns null when a is malformed", () => {
    expect(compareVersions("not-a-version", "1.0.0")).toBeNull();
  });

  it("returns null when b is malformed", () => {
    expect(compareVersions("1.0.0", "not-a-version")).toBeNull();
  });

  it("returns null for non-numeric segments", () => {
    expect(compareVersions("1.x.0", "1.0.0")).toBeNull();
  });

  it("returns null for a version missing a segment", () => {
    expect(compareVersions("1.0", "1.0.0")).toBeNull();
  });
});

describe("isUpdateRequired — fail-open (AC)", () => {
  it("returns true when current < min (below)", () => {
    expect(isUpdateRequired("1.0.0", "2.0.0")).toBe(true);
  });

  it("returns false when current === min (equal)", () => {
    expect(isUpdateRequired("1.0.0", "1.0.0")).toBe(false);
  });

  it("returns false when current > min (above)", () => {
    expect(isUpdateRequired("2.0.0", "1.0.0")).toBe(false);
  });

  it("returns false when current is malformed (fail-open)", () => {
    expect(isUpdateRequired("garbage", "2.0.0")).toBe(false);
  });

  it("returns false when min is malformed (fail-open)", () => {
    expect(isUpdateRequired("1.0.0", "garbage")).toBe(false);
  });

  it("returns false when either version has non-numeric parts (fail-open)", () => {
    expect(isUpdateRequired("1.a.0", "2.0.0")).toBe(false);
    expect(isUpdateRequired("1.0.0", "2.b.0")).toBe(false);
  });

  it("handles multi-digit segments correctly (1.2.9 requires update to 1.2.10)", () => {
    expect(isUpdateRequired("1.2.9", "1.2.10")).toBe(true);
    expect(isUpdateRequired("1.2.10", "1.2.9")).toBe(false);
  });
});

describe("resolvePlatformVersion", () => {
  const versions: PlatformAppVersions = { ios: "1.0.0", android: "2.0.0" };

  it("'android' selects .android", () => {
    expect(resolvePlatformVersion(versions, "android")).toBe("2.0.0");
  });

  it("'ios' selects .ios", () => {
    expect(resolvePlatformVersion(versions, "ios")).toBe("1.0.0");
  });

  it("'web' (unknown OS) falls back to .ios", () => {
    expect(resolvePlatformVersion(versions, "web")).toBe("1.0.0");
  });

  it("'' (empty) falls back to .ios", () => {
    expect(resolvePlatformVersion(versions, "")).toBe("1.0.0");
  });
});

/**
 * T115 AC2 — "screen/banner logic table-driven tests": the decision table
 * from the plan §5 AC2, one row per `it.each` case.
 */
describe("resolveUpgradeState — decision table (T115 AC2)", () => {
  function input(overrides: Partial<UpgradeStateInput>): UpgradeStateInput {
    return {
      appVersion: "1.0.0",
      platformOS: "ios",
      minSupportedVersion: "0.0.0",
      minAppVersion: { ios: "0.0.0", android: "0.0.0" },
      recommendedAppVersion: { ios: "0.0.0", android: "0.0.0" },
      ...overrides,
    };
  }

  it.each<[string, Partial<UpgradeStateInput>, UpgradeState]>([
    [
      "below minAppVersion (legacy minSupportedVersion permissive)",
      {
        appVersion: "1.0.0",
        minSupportedVersion: "0.0.0",
        minAppVersion: { ios: "2.0.0", android: "0.0.0" },
        recommendedAppVersion: { ios: "2.0.0", android: "0.0.0" },
        platformOS: "ios",
      },
      "blocked",
    ],
    [
      "below legacy minSupportedVersion (per-platform minAppVersion permissive)",
      {
        appVersion: "1.0.0",
        minSupportedVersion: "2.0.0",
        minAppVersion: { ios: "0.0.0", android: "0.0.0" },
        recommendedAppVersion: { ios: "0.0.0", android: "0.0.0" },
        platformOS: "ios",
      },
      "blocked",
    ],
    [
      "equal to min is NOT below -> recommended",
      {
        appVersion: "2.0.0",
        minAppVersion: { ios: "2.0.0", android: "0.0.0" },
        recommendedAppVersion: { ios: "3.0.0", android: "0.0.0" },
        platformOS: "ios",
      },
      "recommended",
    ],
    [
      "between min and recommended -> recommended",
      {
        appVersion: "2.5.0",
        minAppVersion: { ios: "2.0.0", android: "0.0.0" },
        recommendedAppVersion: { ios: "3.0.0", android: "0.0.0" },
        platformOS: "ios",
      },
      "recommended",
    ],
    [
      "equal to recommended is NOT below -> none",
      {
        appVersion: "3.0.0",
        minAppVersion: { ios: "2.0.0", android: "0.0.0" },
        recommendedAppVersion: { ios: "3.0.0", android: "0.0.0" },
        platformOS: "ios",
      },
      "none",
    ],
    [
      "above recommended -> none",
      {
        appVersion: "4.0.0",
        minAppVersion: { ios: "2.0.0", android: "0.0.0" },
        recommendedAppVersion: { ios: "3.0.0", android: "0.0.0" },
        platformOS: "ios",
      },
      "none",
    ],
    [
      "per-platform selection: android slot permissive while ios slot would block",
      {
        appVersion: "1.0.0",
        minAppVersion: { ios: "9.9.9", android: "0.0.0" },
        recommendedAppVersion: { ios: "0.0.0", android: "0.0.0" },
        platformOS: "android",
      },
      "none",
    ],
    [
      "same config, ios platform -> blocked (per-platform selection, other direction)",
      {
        appVersion: "1.0.0",
        minAppVersion: { ios: "9.9.9", android: "0.0.0" },
        recommendedAppVersion: { ios: "0.0.0", android: "0.0.0" },
        platformOS: "ios",
      },
      "blocked",
    ],
    [
      "unknown OS ('web') resolves to the ios slot",
      {
        appVersion: "1.0.0",
        minAppVersion: { ios: "0.0.0", android: "9.9.9" },
        recommendedAppVersion: { ios: "0.0.0", android: "0.0.0" },
        platformOS: "web",
      },
      "none",
    ],
    [
      "min beats a misconfigured lower recommended",
      {
        appVersion: "1.5.0",
        minAppVersion: { ios: "2.0.0", android: "0.0.0" },
        recommendedAppVersion: { ios: "1.0.0", android: "0.0.0" },
        platformOS: "ios",
      },
      "blocked",
    ],
    [
      "build-number gate: installed build below the platform minimum's build",
      {
        appVersion: "1.0.0+7",
        minAppVersion: { ios: "1.0.0+10", android: "0.0.0" },
        recommendedAppVersion: { ios: "0.0.0", android: "0.0.0" },
        platformOS: "ios",
      },
      "blocked",
    ],
    [
      "no visible build on the installed side -> fail-open, no gate",
      {
        appVersion: "1.0.0",
        minAppVersion: { ios: "1.0.0+10", android: "0.0.0" },
        recommendedAppVersion: { ios: "0.0.0", android: "0.0.0" },
        platformOS: "ios",
      },
      "none",
    ],
    [
      "malformed installed version -> fail-open",
      {
        appVersion: "garbage",
        minAppVersion: { ios: "2.0.0", android: "0.0.0" },
        recommendedAppVersion: { ios: "3.0.0", android: "0.0.0" },
        platformOS: "ios",
      },
      "none",
    ],
    [
      "everything malformed -> fail-open",
      {
        appVersion: "1.0.0",
        minSupportedVersion: "garbage",
        minAppVersion: { ios: "garbage", android: "0.0.0" },
        recommendedAppVersion: { ios: "garbage", android: "0.0.0" },
        platformOS: "ios",
      },
      "none",
    ],
    [
      "DEFAULT_APP_CONFIG shape (all 0.0.0) -> never a gate",
      {
        appVersion: "1.0.0",
        minSupportedVersion: "0.0.0",
        minAppVersion: { ios: "0.0.0", android: "0.0.0" },
        recommendedAppVersion: { ios: "0.0.0", android: "0.0.0" },
        platformOS: "ios",
      },
      "none",
    ],
  ])("%s", (_description, overrides, expected) => {
    expect(resolveUpgradeState(input(overrides))).toBe(expected);
  });
});
