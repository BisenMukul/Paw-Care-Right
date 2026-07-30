// T110 group C: "pipeline complete" -- the machine-translated dictionaries
// are structurally sound: complete for their declared sections, contain
// nothing outside them, contain nothing under a safety-pinned prefix, and
// every key traces back to a real English leaf.
import { collectLeafPaths, collectOverridePaths } from "@bombaypetcompany/config";

import { SAFETY_PINNED_PREFIXES, TRANSLATED_SECTIONS } from "../src/i18n/locale-registry";
import { es } from "../src/i18n/locales/es";
import { hi } from "../src/i18n/locales/hi";
import { ptBR } from "../src/i18n/locales/pt-BR";
import { enStrings } from "../src/strings";

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
      const topLevelKeys = Object.keys(dict);
      for (const key of topLevelKeys) {
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
      const dictPaths = collectOverridePaths(dict);
      for (const path of dictPaths) {
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

  it("adding a new English top-level section without updating either list would fail this test (positive control)", () => {
    const topLevelKeys = [...Object.keys(enStrings), "somebrandnewsection"];
    const translatedSections = new Set<string>(TRANSLATED_SECTIONS.es);
    const computedComplement = topLevelKeys
      .filter((key) => !translatedSections.has(key))
      .map((key) => `${key}.`)
      .sort();
    expect([...SAFETY_PINNED_PREFIXES].sort()).not.toEqual(computedComplement);
  });
});
