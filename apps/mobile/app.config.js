// Expo dynamic config (CommonJS).
//
// Why .js/`require` and not app.config.ts: this file is read not only by
// Metro/`expo` but also by external tooling (eas-cli, `expo prebuild`) that
// runs outside the project's TypeScript loader. A `.ts` config forces those
// tools to transpile TypeScript AND resolve the workspace import, which fails
// in eas-cli's isolated environment ("Cannot read properties of undefined
// (reading 'CommonJS')"). Requiring the already-built CommonJS entry of
// `@pawcareright/config` removes all transpilation from the config-load path
// while keeping the brand constants single-sourced (CLAUDE.md §1a).

const {
  APP_DISPLAY_NAME,
  APP_SLUG,
  BUNDLE_ID,
  DEEPLINK_SCHEME,
} = require("@pawcareright/config");

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: APP_DISPLAY_NAME,
  slug: APP_SLUG,
  scheme: DEEPLINK_SCHEME,
  owner: "mukbisens-team",
  version: "0.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  // Native splash screen config lives in the `expo-splash-screen` config
  // plugin in this SDK (no top-level `splash` field anymore); wiring that
  // plugin is out of scope here. `assets/splash-icon.png` is kept as an
  // unreferenced placeholder for when that plugin is added.
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: true,
    usesAppleSignIn: true,
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
    googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "",
    revenueCatIosKey: process.env.EXPO_PUBLIC_RC_IOS_KEY ?? "stub_ios_key",
    revenueCatAndroidKey: process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? "stub_android_key",
    termsUrl: process.env.EXPO_PUBLIC_TERMS_URL ?? "https://pawcareright.app/terms",
    privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://pawcareright.app/privacy",
    posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "",
    posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    // T089: stub-safe by default (empty DSN => Sentry never inits, D5).
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? "",
    gitSha: process.env.EXPO_PUBLIC_GIT_SHA ?? "dev",
    // `eas init` will create an EAS project with slug "pawcareright" (APP_SLUG)
    // and print its projectId — add it back here as `eas: { projectId: "<uuid>" }`.
    "eas": {
        "projectId": "a7a52d2d-c7f4-44b0-9234-017d07bd1ced"
      }
  },
  plugins: [
    "expo-router",
    "expo-apple-authentication",
    "expo-dev-client",
    // T089: source maps ride the EAS build/update pipeline (plan D7) — this
    // plugin only wires native project config (org/project + properties
    // files); the actual upload happens in EAS jobs at T099/T116, not CI.
    [
      "@sentry/react-native/expo",
      {
        organization: process.env.SENTRY_ORG ?? "pawcareright",
        project: process.env.SENTRY_PROJECT ?? "pawcareright-mobile",
      },
    ],
  ],
};

module.exports = config;
