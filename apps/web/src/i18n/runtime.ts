// T110: web i18n runtime. Read docs/I18N.md before editing. No device
// locale API on web (F7/D9): the override is `NEXT_PUBLIC_I18N_LOCALE`
// only, honored outside production; there is no per-request negotiation
// wired yet (plan §8 -- module-scope resolution is per-PROCESS, not
// per-request, which is why serving more than one reviewed locale on web is
// explicitly deferred).
import {
  type LocaleId,
  type LocaleOverrides,
  getTextDirection,
  pseudoString,
  pseudoTree,
  resolveStrings,
  rtlPseudoString,
  selectActiveLocale,
} from "@bombaypetcompany/config";

import { getLocaleOverrides } from "./locale-registry";

function resolveForLocale<T>(en: T, locale: LocaleId): T {
  if (locale === "en-XA") return pseudoTree(en, pseudoString);
  if (locale === "ar-XB") return pseudoTree(en, rtlPseudoString);
  const overrides = getLocaleOverrides(locale) as LocaleOverrides<T> | undefined;
  return resolveStrings(en, overrides);
}

let cachedActiveLocale: LocaleId | undefined;

/** Memoized, computed once per process (F7/R1 -- see the header comment). */
export function getActiveLocale(): LocaleId {
  if (cachedActiveLocale === undefined) {
    cachedActiveLocale = selectActiveLocale({
      override: process.env.NEXT_PUBLIC_I18N_LOCALE ?? null,
      candidates: [],
      nodeEnv: process.env.NODE_ENV,
    });
  }
  return cachedActiveLocale;
}

export function getActiveDirection(): "ltr" | "rtl" {
  return getTextDirection(getActiveLocale());
}

/** Registry lookup -> `resolveStrings`. Safe to call at module-init time; never throws. */
export function resolveActiveStrings<T>(en: T): T {
  return resolveForLocale(en, getActiveLocale());
}

/**
 * Resolver-level convenience for an EXPLICIT locale (F7: web jest has no
 * jsdom/render, so tests exercise this pure function instead of rendering).
 * Lazily requires `../strings` (rather than a top-level import) so this
 * module -- which `../strings` itself imports for `resolveActiveStrings` --
 * never forms a circular top-level import.
 */
export function getStrings(locale: LocaleId): unknown {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: deferred require avoids a circular top-level import with ../strings, which imports THIS module for `resolveActiveStrings`
  const { enStrings } = require("../strings") as typeof import("../strings");
  return resolveForLocale(enStrings, locale);
}
