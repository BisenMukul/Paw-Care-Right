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
  };
}

/** The installed app's own version (T079 plan decision 3), read via Expo's config, defaulting permissively when absent (e.g. a bare Jest environment). */
export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? "0.0.0";
}
