// Expo dynamic config (CommonJS).
//
// Why .js/`require` and not app.config.ts: this file is read not only by
// Metro/`expo` but also by external tooling (eas-cli, `expo prebuild`) that
// runs outside the project's TypeScript loader. A `.ts` config forces those
// tools to transpile TypeScript AND resolve the workspace import, which fails
// in eas-cli's isolated environment ("Cannot read properties of undefined
// (reading 'CommonJS')"). Requiring the already-built CommonJS entry of
// `@bombaypetcompany/config` removes all transpilation from the config-load path
// while keeping the brand constants single-sourced (CLAUDE.md §1a).

const {
  APP_DISPLAY_NAME,
  APP_SLUG,
  BUNDLE_ID,
  DEEPLINK_SCHEME,
} = require("@bombaypetcompany/config");

// T099: treats empty-string env values as absent (EAS build-server env vars
// are sometimes unset-but-present) and prefers the caller-supplied
// EXPO_PUBLIC_GIT_SHA over EAS's own build-server variable.
/** @param {Array<string | undefined>} values */
const firstNonEmpty = (...values) => values.find((v) => typeof v === "string" && v.trim() !== "") ?? "";

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: APP_DISPLAY_NAME,
  slug: APP_SLUG,
  scheme: DEEPLINK_SCHEME,
  owner: "mukbisens-team",
  // T099: marketing/store version, hand-bumped per release train. iOS
  // buildNumber / Android versionCode are REMOTE and auto-incremented by EAS
  // (see eas.json `cli.appVersionSource: "remote"` + per-profile
  // `autoIncrement: true`), so they never appear in this file.
  version: "1.0.0",
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
      // T100 (plan D7): the adaptive foreground is a transparent-background
      // cream paw mark (store-assets/tools/asset-manifest.ts's "adaptive-icon"
      // entry), so the launcher background must be the brand field colour for
      // the icon to read as the brand mark instead of a blank tile. Matches
      // `packages/config/tailwind-preset.mjs` `brand.700` -- cross-checked by
      // `apps/mobile/__tests__/store-assets-manifest.test.ts`.
      backgroundColor: "#1f6350",
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
    termsUrl: process.env.EXPO_PUBLIC_TERMS_URL ?? "https://bombaypetcompany.app/terms",
    privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://bombaypetcompany.app/privacy",
    posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "",
    posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    // T089: stub-safe by default (empty DSN => Sentry never inits, D5).
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? "",
    // T104: gates the root-mounted beta banner. `false` everywhere except a
    // profile where the founder explicitly sets EXPO_PUBLIC_BETA=1 (e.g. the
    // preview/beta EAS profile) -- default off so no existing build changes.
    betaBanner: process.env.EXPO_PUBLIC_BETA === "1",
    // T099: EXPO_PUBLIC_GIT_SHA -> EAS_BUILD_GIT_COMMIT_HASH -> "dev". Without
    // this chain every EAS build reports Sentry release "...+dev" and all
    // builds collide in one release bucket (T089 §7 / OTA_UPDATES §7 make
    // per-build releases load-bearing). eas.json's `cli.requireCommit: true`
    // is what makes EAS_BUILD_GIT_COMMIT_HASH meaningful.
    gitSha:
      firstNonEmpty(process.env.EXPO_PUBLIC_GIT_SHA, process.env.EAS_BUILD_GIT_COMMIT_HASH) || "dev",
    // T099: this UUID points at the pre-REBRAND-1 EAS project. Renaming /
    // re-creating the EAS project to slug "bombaypetcompany" (`eas init` /
    // project rename in expo.dev) is a standing founder to-do; after that,
    // paste the new server-assigned projectId here — a one-line edit, no
    // code change. Do not invent a UUID here; do not remove this block
    // (removing it breaks `eas update`/`eas build` project resolution).
    eas: {
      projectId: "a7a52d2d-c7f4-44b0-9234-017d07bd1ced",
    },
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
        organization: process.env.SENTRY_ORG ?? "bombaypetcompany",
        project: process.env.SENTRY_PROJECT ?? "bombaypetcompany-mobile",
      },
    ],
  ],
};

module.exports = config;
