import type { ExpoConfig } from "expo/config";

import {
  APP_DISPLAY_NAME,
  APP_SLUG,
  BUNDLE_ID,
  DEEPLINK_SCHEME,
} from "@pawcareright/config";

// Sentry stub (future): this is the insertion point for the
// `@sentry/react-native` config plugin + release naming once error
// reporting is wired up. Intentionally omitted for T008 (scaffold-only).

const config: ExpoConfig = {
  name: APP_DISPLAY_NAME,
  slug: APP_SLUG,
  scheme: DEEPLINK_SCHEME,
  version: "0.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  // Native splash screen config moved to the `expo-splash-screen` config
  // plugin in this SDK (no top-level `splash` field on `ExpoConfig`
  // anymore); wiring that plugin is out of scope for T008 (scaffold-only,
  // see R8). `assets/splash-icon.png` is kept as an unreferenced
  // placeholder for when that plugin is added.
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
  },
  plugins: ["expo-router", "expo-apple-authentication"],
};

export default config;
