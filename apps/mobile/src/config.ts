import Constants from "expo-constants";

// Single typed accessor for runtime config (CLAUDE.md §6 — no hardcoded
// URLs/ids in components). Defaults mirror `app.config.ts`'s `extra` block
// so behavior is identical whether `expoConfig` is populated or not (e.g.
// in a bare Jest environment where `expo-constants` is mocked).
export interface AppConfig {
  apiBaseUrl: string;
  googleClientId: string;
  revenueCatIosKey: string;
  revenueCatAndroidKey: string;
  termsUrl: string;
  privacyUrl: string;
  posthogKey: string;
  posthogHost: string;
  sentryDsn: string;
  gitSha: string;
  /** T104 plan D6: gates the root-mounted beta banner. `false` by default -- nothing changes for non-beta builds. */
  betaBanner: boolean;
}

export function getConfig(): AppConfig {
  const extra = Constants.expoConfig?.extra as
    | {
        apiBaseUrl?: string;
        googleClientId?: string;
        revenueCatIosKey?: string;
        revenueCatAndroidKey?: string;
        termsUrl?: string;
        privacyUrl?: string;
        posthogKey?: string;
        posthogHost?: string;
        sentryDsn?: string;
        gitSha?: string;
        betaBanner?: boolean;
      }
    | undefined;

  return {
    apiBaseUrl: extra?.apiBaseUrl ?? "http://localhost:3000",
    googleClientId: extra?.googleClientId ?? "",
    revenueCatIosKey: extra?.revenueCatIosKey ?? "stub_ios_key",
    revenueCatAndroidKey: extra?.revenueCatAndroidKey ?? "stub_android_key",
    // §1a: bombaypetcompany.app is the provisional web placeholder until T102.
    termsUrl: extra?.termsUrl ?? "https://bombaypetcompany.app/terms",
    privacyUrl: extra?.privacyUrl ?? "https://bombaypetcompany.app/privacy",
    posthogKey: extra?.posthogKey ?? "",
    posthogHost: extra?.posthogHost ?? "https://us.i.posthog.com",
    // T089: stub-safe by default (empty DSN => Sentry never inits, D5).
    sentryDsn: extra?.sentryDsn ?? "",
    gitSha: extra?.gitSha ?? "dev",
    betaBanner: extra?.betaBanner ?? false,
  };
}

/** The installed app's own version (T079 plan decision 3), read via Expo's config, defaulting permissively when absent (e.g. a bare Jest environment). */
export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? "0.0.0";
}

/**
 * T115: the installed BINARY's build number (iOS `CFBundleVersion` /
 * Android `versionCode`); `null` when unavailable (Expo Go, jest, web).
 * Read via `Constants.platform` -- NOT `expo-application` (would be a new
 * dependency, CLAUDE §6). iOS reports a raw string (`CFBundleVersion` can be
 * non-numeric, e.g. a marketing-version-shaped string); Android reports a
 * plain integer (`versionCode`). Only a NUMERIC iOS build number is
 * meaningful here -- a non-numeric one is filtered out by the caller
 * (`getAppVersionWithBuild`) via the shared semver util's build-metadata
 * grammar, so this function itself does no numeric validation.
 */
export function getAppBuildNumber(): string | null {
  const iosBuildNumber = Constants.platform?.ios?.buildNumber;

  if (typeof iosBuildNumber === "string" && iosBuildNumber.length > 0) {
    return iosBuildNumber;
  }

  const androidVersionCode = Constants.platform?.android?.versionCode;

  if (typeof androidVersionCode === "number" && Number.isInteger(androidVersionCode) && androidVersionCode >= 0) {
    return String(androidVersionCode);
  }

  return null;
}

/**
 * T115: `"1.2.3+45"` when a NUMERIC build number is available, else
 * `"1.2.3"`. A non-numeric iOS `CFBundleVersion` (e.g. `"1.2.3"`) is NOT
 * appended -- fail-open; `compareAppVersions`/`isVersionBelow` would ignore
 * it anyway (non-numeric build metadata is treated as absent), so appending
 * it here would only add noise.
 */
export function getAppVersionWithBuild(): string {
  const version = getAppVersion();
  const buildNumber = getAppBuildNumber();

  if (buildNumber !== null && /^\d+$/.test(buildNumber)) {
    return `${version}+${buildNumber}`;
  }

  return version;
}
