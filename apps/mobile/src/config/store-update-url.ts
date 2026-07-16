/**
 * Store-update URLs for the launch-time update gate (T079 plan decision "Mobile
 * — update gate UI"; mirrors `manage-subscription.ts`'s URL-resolution pattern).
 */

/**
 * Android Play Store listing, scoped to our package (§1a: `com.pawcareright.app`
 * is the bundle-id identifier, safe to hardcode -- it is not the display name).
 */
export const ANDROID_UPDATE_URL = "https://play.google.com/store/apps/details?id=com.pawcareright.app";

/**
 * Provisional iOS store link (plan Risk R7): no App Store numeric app id
 * exists pre-submission -- confirmed at the C3 checkpoint after T102. Points
 * at the marketing site until then.
 * NOTE(T102): replace with the real `https://apps.apple.com/app/id<APP_ID>` once assigned.
 */
export const IOS_UPDATE_URL = "https://pawcareright.app";

/** Pure URL resolution: no `Linking` dependency, unit-testable without mocking React Native. */
export function resolveStoreUpdateUrl(platformOS: string): string {
  return platformOS === "android" ? ANDROID_UPDATE_URL : IOS_UPDATE_URL;
}
