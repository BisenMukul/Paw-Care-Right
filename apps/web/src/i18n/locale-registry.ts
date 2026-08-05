// T110: web locale dictionary registry. Read docs/I18N.md before editing.
//
// TYPE-ONLY import: erased at compile time, so there is NO runtime cycle
// between this file and `strings.ts` (which imports the i18n runtime, which
// lazily requires `strings.ts` at call time only -- see `runtime.ts`).
import type { LocaleId, LocaleOverrides } from "@bombaypetcompany/config";

import type { StringsShape } from "../strings";
import { es } from "./locales/es";
import { hi } from "./locales/hi";
import { ptBR } from "./locales/pt-BR";

/**
 * Every top-level section of the English tree that IS machine-translated.
 * Each declared section must be 100% covered by every machine locale's
 * dictionary; any key outside a declared section is a coverage-test failure.
 *
 * T110 review F2: `footer` was REMOVED from this list. `footer.notice`
 * ("... is not a substitute for veterinary care") is a §5 safety-disclaimer
 * sentence, not ordinary chrome copy -- it must never be machine-translated
 * (plan §2 line 13 / §8), so `footer` as a whole moves to the
 * safety-pinned complement below rather than carrying a narrower
 * per-key carve-out.
 */
export const TRANSLATED_SECTIONS = {
  es: ["globalError"],
  "pt-BR": ["globalError"],
  hi: ["globalError"],
} as const satisfies Readonly<Record<"es" | "pt-BR" | "hi", readonly string[]>>;

/**
 * Safety pinning is expressed as the COMPLEMENT of `TRANSLATED_SECTIONS` --
 * every top-level key of the English tree that is NOT a translated section.
 * A test asserts this list equals the computed complement so the two can
 * never drift (plan §2.5).
 */
export const SAFETY_PINNED_PREFIXES: readonly string[] = [
  "disclaimer.",
  "layout.",
  "landing.",
  "legal.",
  "foodPage.",
  "footer.",
  // T111: the internal admin mini-dashboard is operational chrome, never
  // machine-translated -- forced into the safety-pinned complement rather
  // than declared as a new `TRANSLATED_SECTIONS` entry.
  "admin.",
];

/**
 * MACHINE TRANSLATION dictionaries — produced by an LLM, not reviewed by a
 * human translator or a veterinarian. `reviewed: false` in the locale
 * registry (`@bombaypetcompany/config`); these dictionaries are NEVER
 * served. Returns `undefined` for pseudolocales (handled directly by the
 * runtime) and for `en`/`ar` (no dictionary shipped for either).
 */
export function getLocaleOverrides(locale: LocaleId): LocaleOverrides<StringsShape> | undefined {
  switch (locale) {
    case "es":
      return es;
    case "pt-BR":
      return ptBR;
    case "hi":
      return hi;
    default:
      // `ar` ships no dictionary in this task (plan §2.2/D4) and
      // pseudolocales are handled directly by the runtime, never via this
      // registry.
      return undefined;
  }
}
