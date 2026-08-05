// T110: shared locale registry + negotiation. Read docs/I18N.md before editing.
//
// SAFETY (CLAUDE §7 / plan §2.2): every non-`en` locale ships with
// `reviewed: false`. `resolveServedLocale` is the hard gate that forces any
// unreviewed locale back to `en` at serve time -- flipping the boolean is the
// ONLY way a locale is ever served, and doing so requires a human translator
// AND (for health-adjacent copy) a veterinarian sign-off per docs/I18N.md §10.

export type LocaleId = "en" | "es" | "pt-BR" | "hi" | "ar" | "en-XA" | "ar-XB";

export interface LocaleEntry {
  readonly id: LocaleId;
  readonly englishName: string;
  readonly direction: "ltr" | "rtl";
  /** TRUE only after a human reviewer (and, for safety copy, a veterinarian) has signed off. */
  readonly reviewed: boolean;
  /** Dev/CI-only pseudolocale -- never selectable from device detection, never served. */
  readonly pseudo: boolean;
  readonly source: "authored" | "machine" | "generated";
}

export const DEFAULT_LOCALE: LocaleId = "en";

export const LOCALES: Readonly<Record<LocaleId, LocaleEntry>> = {
  en: {
    id: "en",
    englishName: "English",
    direction: "ltr",
    reviewed: true,
    pseudo: false,
    source: "authored",
  },
  es: {
    id: "es",
    englishName: "Spanish",
    direction: "ltr",
    reviewed: false,
    pseudo: false,
    source: "machine",
  },
  "pt-BR": {
    id: "pt-BR",
    englishName: "Portuguese (Brazil)",
    direction: "ltr",
    reviewed: false,
    pseudo: false,
    source: "machine",
  },
  hi: {
    id: "hi",
    englishName: "Hindi",
    direction: "ltr",
    reviewed: false,
    pseudo: false,
    source: "machine",
  },
  ar: {
    id: "ar",
    englishName: "Arabic",
    direction: "rtl",
    reviewed: false,
    pseudo: false,
    source: "machine",
  },
  "en-XA": {
    id: "en-XA",
    englishName: "Pseudo (accented, LTR)",
    direction: "ltr",
    reviewed: false,
    pseudo: true,
    source: "generated",
  },
  "ar-XB": {
    id: "ar-XB",
    englishName: "Pseudo (bidi, RTL)",
    direction: "rtl",
    reviewed: false,
    pseudo: true,
    source: "generated",
  },
} as const;

/** Base languages that read right-to-left, keyed by the primary ISO 639-1/2 subtag. */
export const RTL_LANGUAGES: readonly string[] = ["ar", "he", "fa", "ur"];

/** Extracts the primary language subtag: "ar-XB" -> "ar", "pt-BR" -> "pt". */
function baseLanguage(locale: string): string {
  return locale.split("-")[0]?.toLowerCase() ?? "";
}

/** Direction resolves from the BASE LANGUAGE, not the full tag (AC2.6). */
export function getTextDirection(locale: string): "ltr" | "rtl" {
  return RTL_LANGUAGES.includes(baseLanguage(locale)) ? "rtl" : "ltr";
}

export function isRtlLocale(locale: string): boolean {
  return getTextDirection(locale) === "rtl";
}

export function isSupportedLocale(value: string): value is LocaleId {
  return Object.prototype.hasOwnProperty.call(LOCALES, value);
}

/**
 * Accept-Language header parsing. Tolerant of malformed input: unparsable
 * segments are dropped rather than throwing. Returns tags ordered by
 * descending `q` value (ties keep header order).
 */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  const entries: Array<{ tag: string; q: number; index: number }> = [];
  const segments = header.split(",");
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]?.trim();
    if (!segment) continue;
    const [rawTag, ...params] = segment.split(";").map((part) => part.trim());
    if (!rawTag) continue;
    let q = 1;
    for (const param of params) {
      const match = /^q=([0-9.]+)$/.exec(param);
      if (match) {
        const parsed = Number.parseFloat(match[1]!);
        if (Number.isFinite(parsed)) q = parsed;
      }
    }
    entries.push({ tag: rawTag, q, index });
  }
  return entries
    .sort((a, b) => (b.q === a.q ? a.index - b.index : b.q - a.q))
    .map((entry) => entry.tag);
}

/** Exact match first, then base-language match, then DEFAULT_LOCALE. Pure. */
export function negotiateLocale(candidates: readonly string[]): LocaleId {
  for (const candidate of candidates) {
    if (isSupportedLocale(candidate)) return candidate;
  }
  for (const candidate of candidates) {
    const base = baseLanguage(candidate);
    const match = (Object.keys(LOCALES) as LocaleId[]).find((id) => baseLanguage(id) === base);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

/**
 * THE SAFETY GATE. Maps any locale to the locale actually served: returns
 * DEFAULT_LOCALE unless `LOCALES[locale].reviewed === true`.
 */
export function resolveServedLocale(locale: string): LocaleId {
  if (!isSupportedLocale(locale)) return DEFAULT_LOCALE;
  return LOCALES[locale].reviewed ? locale : DEFAULT_LOCALE;
}

/**
 * Full selection: the dev override WINS outright -- it deliberately does NOT
 * pass through `resolveServedLocale`, because it is the only mechanism by
 * which the `en-XA`/`ar-XB` pseudolocales (which are, correctly, `reviewed:
 * false`) can ever be exercised in dev/CI (pseudo-locale leak test, RTL
 * smoke). This is safe because it is gated by an ALLOWLIST, not a
 * denylist: `nodeEnv` must be EXACTLY `"development"` or `"test"` (the
 * values Expo/Next.js/Jest actually set in those environments). Any other
 * value -- `"production"`, an unrecognized string, OR `undefined`/missing
 * -- fails CLOSED to the negotiated + `resolveServedLocale`-gated path, the
 * only path a real end user ever takes (T110 review F3: a denylist of just
 * `!== "production"` would let a bare Node process or script that never set
 * `NODE_ENV` serve an unreviewed locale; a safety gate must fail closed on
 * the unknown case, not open).
 */
export function selectActiveLocale(args: {
  override?: string | null;
  candidates?: readonly string[];
  nodeEnv?: string;
}): LocaleId {
  const { override, candidates = [], nodeEnv } = args;
  const devOverrideAllowed = nodeEnv === "development" || nodeEnv === "test";
  if (override && devOverrideAllowed && isSupportedLocale(override)) {
    return override;
  }
  return resolveServedLocale(negotiateLocale(candidates));
}
