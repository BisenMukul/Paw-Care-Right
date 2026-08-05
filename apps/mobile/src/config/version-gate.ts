import { compareAppVersions, isVersionBelow, type PlatformAppVersions } from "@bombaypetcompany/types";

/**
 * Min-supported-version comparison (T079 plan decision 3 / Safety R3),
 * extended by T115 for the per-platform forced/recommended binary upgrade
 * gate. `compareVersions`/`isUpdateRequired` now DELEGATE to the shared,
 * dependency-free `compareAppVersions`/`isVersionBelow` in
 * `packages/types/src/semver.ts` (plan D4 -- one comparator, not two; this
 * file's own pre-existing test suite, unchanged, is the behaviour-
 * preservation proof). Every uncertainty still fails OPEN -- ANY parse
 * failure on either side means no gate, so a corrupt/odd version string can
 * NEVER lock a user (including one mid-emergency) out of the app.
 */

/**
 * Compares two version strings. Returns `-1` if `a < b`, `0` if equal, `1`
 * if `a > b`, or `null` if EITHER fails to parse (fail-open signal for the
 * caller). `= compareAppVersions` (packages/types).
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 | null {
  return compareAppVersions(a, b);
}

/**
 * `true` ONLY when both versions parse AND `current < min`. Any parse
 * failure (malformed current, malformed min, non-numeric segments) resolves
 * to `false` -- fail OPEN, never fail closed (CLAUDE.md §7 / plan Risk R3).
 * `= isVersionBelow` (packages/types).
 */
export function isUpdateRequired(current: string, min: string): boolean {
  return isVersionBelow(current, min);
}

/** T115: the three possible outcomes of `resolveUpgradeState`. */
export type UpgradeState = "blocked" | "recommended" | "none";

export interface UpgradeStateInput {
  /** The installed app version, may carry a `"+build"` suffix (see `getAppVersionWithBuild`). */
  appVersion: string;
  /** `Platform.OS`. */
  platformOS: string;
  /** Legacy scalar gate (T079) -- still honoured, OR-combined with `minAppVersion` (plan D8). */
  minSupportedVersion: string;
  /** T115: per-platform blocking gate. */
  minAppVersion: PlatformAppVersions;
  /** T115: per-platform dismissible-banner gate. */
  recommendedAppVersion: PlatformAppVersions;
}

/**
 * Selects the per-platform slot for the installed OS: `"android"` -> `.android`;
 * every other OS (including unknown/`"web"`) -> `.ios` (mirrors
 * `resolveStoreUpdateUrl`'s platform-branch idiom).
 */
export function resolvePlatformVersion(versions: PlatformAppVersions, platformOS: string): string {
  return platformOS === "android" ? versions.android : versions.ios;
}

/**
 * Decides the upgrade state for a launch snapshot. Order (plan D8 / §3):
 * 1. `"blocked"` if the installed version is below EITHER the legacy
 *    `minSupportedVersion` scalar OR the per-platform `minAppVersion`
 *    (min beats a misconfigured lower `recommended` -- the higher-urgency,
 *    spec-consistent direction; urgency fails upward, version PARSING fails
 *    open).
 * 2. Else `"recommended"` if the installed version is below the
 *    per-platform `recommendedAppVersion`.
 * 3. Else `"none"`.
 * Every uncertainty (malformed version, unparseable input) resolves toward
 * `"none"` via `isVersionBelow`'s own fail-open `false` return.
 */
export function resolveUpgradeState(input: UpgradeStateInput): UpgradeState {
  const { appVersion, platformOS, minSupportedVersion, minAppVersion, recommendedAppVersion } = input;

  const platformMin = resolvePlatformVersion(minAppVersion, platformOS);
  const platformRecommended = resolvePlatformVersion(recommendedAppVersion, platformOS);

  if (isUpdateRequired(appVersion, minSupportedVersion) || isUpdateRequired(appVersion, platformMin)) {
    return "blocked";
  }

  if (isUpdateRequired(appVersion, platformRecommended)) {
    return "recommended";
  }

  return "none";
}
