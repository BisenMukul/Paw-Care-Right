// T110: MACHINE TRANSLATION — produced by an LLM, not reviewed by a human
// translator or a veterinarian. `reviewed: false` in the locale registry
// (`@bombaypetcompany/config`); this dictionary is NEVER served. Covers
// exactly the sections declared in `TRANSLATED_SECTIONS` (locale-registry.ts)
// -- every §5/§7 safety surface stays English by construction (never
// imported here). Read docs/I18N.md before editing.
import type { LocaleOverrides } from "@bombaypetcompany/config";

import type { StringsShape } from "../../strings";

export const hi = {
  globalError: {
    heading: "कुछ गलत हो गया",
    body: "इस पेज में एक अप्रत्याशित त्रुटि आई। कृपया फिर से प्रयास करें।",
    retry: "फिर से प्रयास करें",
  },
} satisfies LocaleOverrides<StringsShape>;
