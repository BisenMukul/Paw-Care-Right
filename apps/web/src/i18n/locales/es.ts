// T110: MACHINE TRANSLATION — produced by an LLM, not reviewed by a human
// translator or a veterinarian. `reviewed: false` in the locale registry
// (`@bombaypetcompany/config`); this dictionary is NEVER served. Covers
// exactly the sections declared in `TRANSLATED_SECTIONS` (locale-registry.ts)
// -- every §5/§7 safety surface stays English by construction (never
// imported here). Read docs/I18N.md before editing.
import type { LocaleOverrides } from "@bombaypetcompany/config";

import type { StringsShape } from "../../strings";

export const es = {
  globalError: {
    heading: "Algo salió mal",
    body: "Esta página tuvo un error inesperado. Por favor, inténtalo de nuevo.",
    retry: "Intentar de nuevo",
  },
} satisfies LocaleOverrides<StringsShape>;
