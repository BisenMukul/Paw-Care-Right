// T110 group C (web mirror) + folded-in group S safety-pin assertions (the
// web file inventory has no separate safety-pins spec -- plan §4 lists
// exactly 4 web i18n spec files).
import { collectLeafPaths, collectOverridePaths, resolveStrings } from "@bombaypetcompany/config";

import { enStrings } from "../strings";
import { SAFETY_PINNED_PREFIXES, TRANSLATED_SECTIONS } from "./locale-registry";
import { es } from "./locales/es";
import { hi } from "./locales/hi";
import { ptBR } from "./locales/pt-BR";

const DICTS = { es, "pt-BR": ptBR, hi } as const;

describe("each declared section is 100% translated in es, pt-BR and hi", () => {
  for (const [localeId, dict] of Object.entries(DICTS)) {
    it(`${localeId} covers every leaf of every declared section`, () => {
      const sections = TRANSLATED_SECTIONS[localeId as keyof typeof TRANSLATED_SECTIONS];
      for (const section of sections) {
        const englishPaths = collectLeafPaths(
          (enStrings as Record<string, unknown>)[section],
        ).sort();
        const dictPaths = collectOverridePaths(
          (dict as Record<string, unknown>)[section],
        ).sort();
        expect(dictPaths).toEqual(englishPaths);
      }
    });
  }
});

describe("no dictionary contains a key outside its declared sections", () => {
  for (const [localeId, dict] of Object.entries(DICTS)) {
    it(`${localeId} declares no top-level key beyond TRANSLATED_SECTIONS`, () => {
      const sections = TRANSLATED_SECTIONS[localeId as keyof typeof TRANSLATED_SECTIONS];
      for (const key of Object.keys(dict)) {
        expect(sections).toContain(key);
      }
    });
  }
});

describe("no dictionary contains a key under a SAFETY_PINNED prefix", () => {
  for (const [localeId, dict] of Object.entries(DICTS)) {
    it(`${localeId} never declares a key under a safety-pinned top-level prefix`, () => {
      for (const key of Object.keys(dict)) {
        expect(SAFETY_PINNED_PREFIXES).not.toContain(`${key}.`);
      }
    });
  }
});

describe("every dictionary key exists in the English tree", () => {
  for (const [localeId, dict] of Object.entries(DICTS)) {
    it(`${localeId} adds no key absent from the English tree`, () => {
      const englishPaths = new Set(collectLeafPaths(enStrings));
      for (const path of collectOverridePaths(dict)) {
        expect(englishPaths.has(path)).toBe(true);
      }
    });
  }
});

describe("SAFETY_PINNED_PREFIXES equals the computed complement of TRANSLATED_SECTIONS", () => {
  it("matches exactly, so the two lists can never silently drift", () => {
    const topLevelKeys = Object.keys(enStrings);
    const translatedSections = new Set<string>(TRANSLATED_SECTIONS.es);
    const computedComplement = topLevelKeys
      .filter((key) => !translatedSections.has(key))
      .map((key) => `${key}.`)
      .sort();
    expect([...SAFETY_PINNED_PREFIXES].sort()).toEqual(computedComplement);
  });
});

describe("every §5/§7 frozen pin is byte-identical English in es, pt-BR and hi", () => {
  for (const [localeId, dict] of Object.entries(DICTS)) {
    const merged = resolveStrings(enStrings, dict);

    it(`${localeId}: disclaimer function is untouched`, () => {
      expect(merged.disclaimer).toBe(enStrings.disclaimer);
    });

    it(`${localeId}: legal.* is untouched`, () => {
      expect(merged.legal).toEqual(enStrings.legal);
    });

    it(`${localeId}: landing.* is untouched`, () => {
      expect(merged.landing).toEqual(enStrings.landing);
    });

    it(`${localeId}: foodPage.* is untouched`, () => {
      expect(merged.foodPage).toEqual(enStrings.foodPage);
    });

    it(`${localeId}: layout.* is untouched`, () => {
      expect(merged.layout).toEqual(enStrings.layout);
    });

    // T110 review F2: `footer.notice` ("... is not a substitute for
    // veterinary care") is a §5 safety-disclaimer sentence -- `footer` was
    // removed from `TRANSLATED_SECTIONS` and moved to the safety-pinned
    // complement precisely so this stays English-pinned like every other
    // §5/§7 surface above.
    it(`${localeId}: footer.* (incl. the safety-disclaimer footer.notice) is untouched`, () => {
      expect(merged.footer).toEqual(enStrings.footer);
    });
  }
});

// T110 review F1: the web dictionaries had NO dose/diagnosis safety scan at
// all (only English byte-pin equality checks above). This mirrors the
// mobile `i18n-safety-pins.test.ts` scan exactly, including invoking
// FUNCTION leaves (dummy args built from `fn.length`, same idiom as the
// T097 `strings-detector-lint` collector) so an interpolated leaf can never
// be a blind spot for either app.
describe("no translated web value contains a digit+unit dose pattern", () => {
  const DOSE_PATTERN = /\d+\s?(mg|ml|mcg|g|kg|iu|cc)\b/i;
  const SAMPLE_ARG = "Bombay Pet Company";

  function collectStringLeaves(node: unknown): string[] {
    if (typeof node === "string") return [node];
    if (typeof node === "function") {
      const fn = node as (...args: string[]) => string;
      const args = Array.from({ length: fn.length }, () => SAMPLE_ARG);
      return [fn(...args)];
    }
    if (Array.isArray(node)) return node.flatMap(collectStringLeaves);
    if (node && typeof node === "object") {
      return Object.values(node as Record<string, unknown>).flatMap(collectStringLeaves);
    }
    return [];
  }

  for (const [localeId, dict] of Object.entries(DICTS)) {
    it(`${localeId} has no dose-shaped string`, () => {
      for (const value of collectStringLeaves(dict)) {
        expect(value).not.toMatch(DOSE_PATTERN);
      }
    });
  }

  it("the pattern catches a planted positive control", () => {
    expect("administre 5mg de ibuprofeno").toMatch(DOSE_PATTERN);
  });

  it("the collector reaches a planted dose pattern hidden ONLY inside a function leaf's return value (non-vacuity)", () => {
    const fixture = { globalError: { retry: (a: string) => `${a} 5mg` } };
    const leaves = collectStringLeaves(fixture);
    expect(leaves.some((value) => DOSE_PATTERN.test(value))).toBe(true);
  });
});

describe("no translated web value contains a diagnosis lexeme in its own language", () => {
  const DIAGNOSIS_LEXEMES = [/diagn[oó]stic/i, /diagnosticar/i, /निदान/];
  const SAMPLE_ARG = "Bombay Pet Company";

  function collectStringLeaves(node: unknown): string[] {
    if (typeof node === "string") return [node];
    if (typeof node === "function") {
      const fn = node as (...args: string[]) => string;
      const args = Array.from({ length: fn.length }, () => SAMPLE_ARG);
      return [fn(...args)];
    }
    if (Array.isArray(node)) return node.flatMap(collectStringLeaves);
    if (node && typeof node === "object") {
      return Object.values(node as Record<string, unknown>).flatMap(collectStringLeaves);
    }
    return [];
  }

  for (const [localeId, dict] of Object.entries(DICTS)) {
    it(`${localeId} has no diagnosis lexeme`, () => {
      for (const value of collectStringLeaves(dict)) {
        for (const lexeme of DIAGNOSIS_LEXEMES) {
          expect(value).not.toMatch(lexeme);
        }
      }
    });
  }

  it("the lexeme list catches planted positive controls", () => {
    expect("Este es un diagnóstico").toMatch(/diagn[oó]stic/i);
    expect("यह एक निदान है").toMatch(/निदान/);
  });

  it("the collector reaches a planted diagnosis lexeme hidden ONLY inside a function leaf's return value (non-vacuity)", () => {
    const fixture = { globalError: { retry: (a: string) => `${a} Diagnóstico` } };
    const leaves = collectStringLeaves(fixture);
    expect(leaves.some((value) => DIAGNOSIS_LEXEMES.some((lexeme) => lexeme.test(value)))).toBe(
      true,
    );
  });
});
