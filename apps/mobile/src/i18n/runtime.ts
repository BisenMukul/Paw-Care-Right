// T110: mobile i18n runtime. Read docs/I18N.md before editing.
//
// `detectDeviceLocales()` is reached at MODULE-INIT time (via `strings.ts`)
// and must never throw -- a throw here would break every screen in the app.
import * as Localization from "expo-localization";
import {
  type LocaleId,
  getTextDirection,
  pseudoString,
  resolveStrings,
  rtlPseudoString,
  selectActiveLocale,
  pseudoTree,
  type LocaleOverrides,
} from "@bombaypetcompany/config";

import { getLocaleOverrides } from "./locale-registry";

/**
 * Device locale tags (BCP-47, e.g. `"en-US"`), most-preferred first.
 * Wrapped in try/catch so ANY `expo-localization` failure returns `[]`
 * rather than crashing app startup.
 */
export function detectDeviceLocales(): string[] {
  try {
    return Localization.getLocales()
      .map((entry) => entry.languageTag)
      .filter((tag): tag is string => typeof tag === "string" && tag.length > 0);
  } catch {
    return [];
  }
}

let cachedActiveLocale: LocaleId | undefined;

/**
 * Memoized, computed once at module init (RN semantics: `I18nManager.forceRTL`
 * requires a reload anyway, so a runtime locale change is not honest to
 * support without one -- plan §2.1).
 */
export function getActiveLocale(): LocaleId {
  if (cachedActiveLocale === undefined) {
    cachedActiveLocale = selectActiveLocale({
      override: process.env.EXPO_PUBLIC_I18N_LOCALE ?? null,
      candidates: detectDeviceLocales(),
      nodeEnv: process.env.NODE_ENV,
    });
  }
  return cachedActiveLocale;
}

export function getActiveDirection(): "ltr" | "rtl" {
  return getTextDirection(getActiveLocale());
}

/**
 * Registry lookup -> `resolveStrings`. Safe to call at module-init time;
 * never throws. Pseudolocales are generated at runtime directly from the
 * English tree (plan §2.4) -- they ship no dictionary file.
 */
export function resolveActiveStrings<T>(en: T): T {
  const locale = getActiveLocale();
  if (locale === "en-XA") return pseudoTree(en, pseudoString);
  if (locale === "ar-XB") return pseudoTree(en, rtlPseudoString);
  const overrides = getLocaleOverrides(locale) as LocaleOverrides<T> | undefined;
  return resolveStrings(en, overrides);
}
