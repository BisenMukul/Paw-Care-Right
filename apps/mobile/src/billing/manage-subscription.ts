import * as Linking from "expo-linking";
import { Platform } from "react-native";

import { fetchCustomerInfo, managementUrlFromCustomerInfo } from "./purchases";

/** iOS store subscriptions management page (App Store native, no bundle-id param needed). */
export const IOS_MANAGE_SUBSCRIPTION_URL = "https://apps.apple.com/account/subscriptions";

/**
 * Android Play Store subscriptions management page, scoped to our package
 * (§1a: `com.pawcareright.app` is the bundle-id identifier, safe to hardcode
 * -- it is not the display name).
 */
export const ANDROID_MANAGE_SUBSCRIPTION_URL =
  "https://play.google.com/store/account/subscriptions?package=com.pawcareright.app";

/**
 * Pure URL resolution (T076 plan decision 2): prefers RC's store-correct
 * `managementUrl` when present (non-empty string), otherwise falls back to
 * the platform-correct store subscriptions page. No `Linking` dependency --
 * unit-testable without mocking React Native.
 */
export function resolveManageSubscriptionUrl(managementUrl: string | null, platformOS: string): string {
  if (managementUrl !== null && managementUrl.length > 0) {
    return managementUrl;
  }

  return platformOS === "android" ? ANDROID_MANAGE_SUBSCRIPTION_URL : IOS_MANAGE_SUBSCRIPTION_URL;
}

/**
 * Opens the platform-correct manage-subscription surface (T076 plan decision
 * 2 / risk R3): reads the current `customerInfo`, resolves the best URL, and
 * opens it. Always resolves to a valid https store URL -- even when
 * `fetchCustomerInfo` returns `null` (Expo Go / native module absent) -- and
 * never throws (a failed `openURL` is swallowed, mirroring `purchases.ts`'s
 * best-effort posture).
 */
export async function openManageSubscription(platformOS: string = Platform.OS): Promise<void> {
  const customerInfo = await fetchCustomerInfo();
  const managementUrl = managementUrlFromCustomerInfo(customerInfo);
  const url = resolveManageSubscriptionUrl(managementUrl, platformOS);

  try {
    await Linking.openURL(url);
  } catch {
    // Best-effort: a failed deep link never crashes the app.
  }
}
