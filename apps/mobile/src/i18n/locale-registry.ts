// T110: mobile locale dictionary registry. Read docs/I18N.md before editing.
//
// TYPE-ONLY import: erased at compile time, so there is NO runtime cycle
// between this file and `strings.ts` (which imports the i18n runtime).
import type { LocaleId, LocaleOverrides } from "@bombaypetcompany/config";

import type { StringsShape } from "../strings";
import { es } from "./locales/es";
import { hi } from "./locales/hi";
import { ptBR } from "./locales/pt-BR";

/**
 * Every top-level section of the English tree that IS machine-translated.
 * Each declared section must be 100% covered by every machine locale's
 * dictionary; any key outside a declared section is a coverage-test failure.
 */
export const TRANSLATED_SECTIONS = {
  es: ["tabs", "nav", "home", "switcher", "care", "addPet"],
  "pt-BR": ["tabs", "nav", "home", "switcher", "care", "addPet"],
  hi: ["tabs", "nav", "home", "switcher", "care", "addPet"],
} as const satisfies Readonly<Record<"es" | "pt-BR" | "hi", readonly string[]>>;

/**
 * Safety pinning is expressed as the COMPLEMENT of `TRANSLATED_SECTIONS` --
 * every top-level key of the English tree that is NOT a translated section.
 * By construction this includes every §5/§7 safety surface (`check.`,
 * `chat.`, `medForm.`, ...) plus every other untranslated section. A test
 * asserts this list equals the computed complement so the two can never
 * drift (plan §2.5).
 */
export const SAFETY_PINNED_PREFIXES: readonly string[] = [
  "careScore.",
  "timeline.",
  "settings.",
  "auth.",
  "petHome.",
  "weight.",
  "note.",
  "vetVisit.",
  "activity.",
  "healthLogPhoto.",
  "comingSoon.",
  "check.",
  "upsell.",
  "paywall.",
  "updateGate.",
  "upgradeBanner.",
  "updateReady.",
  "family.",
  "join.",
  "notifications.",
  "privacy.",
  "carePlan.",
  "intake.",
  "agenda.",
  "reminderForm.",
  "services.",
  "breedGuide.",
  "servicesPreview.",
  "medForm.",
  "chat.",
  "offline.",
  "feedback.",
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
