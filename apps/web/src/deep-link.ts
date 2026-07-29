// App deep-link scheme builder (T086 D2). The scheme name itself is imported
// from the shared config constant — this file never spells out the scheme
// name as a standalone quoted literal — so a future rename of
// DEEPLINK_SCHEME cannot silently drift the web marketing surface out of
// sync with the mobile app.
import { DEEPLINK_SCHEME } from "@bombaypetcompany/config";

/** The full app URL scheme — derived, never a literal, from the shared scheme constant. */
export const APP_URL_SCHEME = `${DEEPLINK_SCHEME}://`;

/**
 * Builds an app-scheme deep link. `appPath` is optional and may be given
 * with or without a leading slash; both normalise to the same URL.
 *   buildAppDeepLink()             -> APP_URL_SCHEME
 *   buildAppDeepLink("join/ABC")   -> APP_URL_SCHEME + "join/ABC"
 *   buildAppDeepLink("/join/ABC")  -> APP_URL_SCHEME + "join/ABC"
 */
export function buildAppDeepLink(appPath?: string): string {
  if (!appPath) {
    return APP_URL_SCHEME;
  }
  const normalised = appPath.startsWith("/") ? appPath.slice(1) : appPath;
  return `${APP_URL_SCHEME}${normalised}`;
}
