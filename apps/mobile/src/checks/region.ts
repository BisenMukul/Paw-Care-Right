import * as Localization from "expo-localization";

/**
 * On-device region resolution (T049 plan D3): wraps `expo-localization` so
 * tests can mock this module instead of the native SDK. Returns the
 * ISO-3166-1 alpha-2 region code of the device's primary locale, or
 * `undefined` when unavailable.
 */
export function getDeviceRegionCode(): string | undefined {
  return Localization.getLocales()[0]?.regionCode ?? undefined;
}
