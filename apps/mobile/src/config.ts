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
      }
    | undefined;

  return {
    apiBaseUrl: extra?.apiBaseUrl ?? "http://localhost:3000",
    googleClientId: extra?.googleClientId ?? "",
    revenueCatIosKey: extra?.revenueCatIosKey ?? "stub_ios_key",
    revenueCatAndroidKey: extra?.revenueCatAndroidKey ?? "stub_android_key",
    // §1a: pawcareright.app is the provisional web placeholder until T102.
    termsUrl: extra?.termsUrl ?? "https://pawcareright.app/terms",
    privacyUrl: extra?.privacyUrl ?? "https://pawcareright.app/privacy",
    posthogKey: extra?.posthogKey ?? "",
    posthogHost: extra?.posthogHost ?? "https://us.i.posthog.com",
  };
}
