// T110 group S: the `reviewed:false` hard gate + the §5/§7 safety-copy pin.
// Read docs/I18N.md before editing. See plan §2.2/§9 R3.
import { LOCALES, DEFAULT_LOCALE, resolveServedLocale, resolveStrings, type LocaleId } from "@bombaypetcompany/config";

import { es } from "../src/i18n/locales/es";
import { hi } from "../src/i18n/locales/hi";
import { ptBR } from "../src/i18n/locales/pt-BR";
import { enStrings } from "../src/strings";

const DICTS = { es, "pt-BR": ptBR, hi } as const;

describe("every non-en locale is reviewed:false", () => {
  for (const [id, entry] of Object.entries(LOCALES)) {
    it(`${id}`, () => {
      if (id === "en") {
        expect(entry.reviewed).toBe(true);
      } else {
        expect(entry.reviewed).toBe(false);
      }
    });
  }
});

describe("resolveServedLocale returns en for every locale shipped today", () => {
  for (const id of Object.keys(LOCALES)) {
    it(`${id} -> en unless it is en itself`, () => {
      expect(resolveServedLocale(id)).toBe("en");
    });
  }
});

describe("only flipping reviewed to true changes what is served", () => {
  // A self-contained replica of the exact gate expression documented on
  // `resolveServedLocale` ("returns DEFAULT_LOCALE unless
  // LOCALES[locale].reviewed === true"), applied to a constructed, MUTABLE
  // clone so this test cannot mutate the shared, real (readonly) locale
  // registry.
  type MutableRegistry = { -readonly [K in keyof typeof LOCALES]: (typeof LOCALES)[K] };

  function simulateResolveServedLocale(
    registry: typeof LOCALES,
    locale: LocaleId,
  ): LocaleId {
    return registry[locale]?.reviewed ? locale : DEFAULT_LOCALE;
  }

  it("a reviewed:false clone still resolves to en", () => {
    const registryClone: MutableRegistry = JSON.parse(JSON.stringify(LOCALES));
    expect(simulateResolveServedLocale(registryClone, "es")).toBe("en");
  });

  it("flipping reviewed:true on the clone is the ONLY thing that changes what is served", () => {
    const registryClone: MutableRegistry = JSON.parse(JSON.stringify(LOCALES));
    registryClone.es = { ...registryClone.es, reviewed: true };
    expect(simulateResolveServedLocale(registryClone, "es")).toBe("es");
    // every other unreviewed locale in the same clone is unaffected
    expect(simulateResolveServedLocale(registryClone, "pt-BR")).toBe("en");
    expect(simulateResolveServedLocale(registryClone, "hi")).toBe("en");
  });
});

describe("every §5/§7 frozen pin is byte-identical English in es, pt-BR and hi", () => {
  for (const [localeId, dict] of Object.entries(DICTS)) {
    const merged = resolveStrings(enStrings, dict);

    it(`${localeId}: disclaimer function is untouched`, () => {
      expect(merged.check.result.disclaimer).toBe(enStrings.check.result.disclaimer);
    });

    it(`${localeId}: check.emergency.* is untouched`, () => {
      expect(merged.check.emergency).toEqual(enStrings.check.emergency);
    });

    it(`${localeId}: check.result.fallbackNotice / emergencyNotice* are untouched`, () => {
      expect(merged.check.result.fallbackNotice).toBe(enStrings.check.result.fallbackNotice);
      expect(merged.check.result.emergencyNoticeTitle).toBe(
        enStrings.check.result.emergencyNoticeTitle,
      );
      expect(merged.check.result.emergencyNoticeBody).toBe(
        enStrings.check.result.emergencyNoticeBody,
      );
      expect(merged.check.result.emergencyNoticeCta).toBe(
        enStrings.check.result.emergencyNoticeCta,
      );
    });

    it(`${localeId}: chat.safeFallback is untouched`, () => {
      expect(merged.chat.safeFallback).toBe(enStrings.chat.safeFallback);
    });

    it(`${localeId}: medForm.* is untouched`, () => {
      expect(merged.medForm).toEqual(enStrings.medForm);
    });

    it(`${localeId}: both kill-switch bodies are untouched`, () => {
      expect(merged.check.unavailableTitle).toBe(enStrings.check.unavailableTitle);
      expect(merged.check.unavailableBody).toBe(enStrings.check.unavailableBody);
      expect(merged.chat.unavailableTitle).toBe(enStrings.chat.unavailableTitle);
      expect(merged.chat.unavailableBody).toBe(enStrings.chat.unavailableBody);
    });
  }
});

describe("no translated value contains a digit+unit dose pattern", () => {
  const DOSE_PATTERN = /\d+\s?(mg|ml|mcg|g|kg|iu|cc)\b/i;

  // T110 review F1: mirrors `strings-detector-lint.test.ts`'s collector --
  // a FUNCTION leaf is INVOKED (dummy args built from `fn.length`, same
  // idiom as the T097 detector) and its RESULT is scanned, rather than
  // silently dropped. There is exactly one function leaf per dictionary
  // today (`addPet.common.stepOf`); dropping it would leave the one
  // interpolated leaf in every dict permanently unscanned.
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
    expect("Give 5mg twice daily").toMatch(DOSE_PATTERN);
  });

  it("the collector reaches a planted dose pattern hidden ONLY inside a function leaf's return value (non-vacuity)", () => {
    const fixture = { addPet: { common: { stepOf: (a: string, b: string) => `${a} 5mg ${b}` } } };
    const leaves = collectStringLeaves(fixture);
    expect(leaves.some((value) => DOSE_PATTERN.test(value))).toBe(true);
  });
});

describe("no translated value contains a diagnosis lexeme in its own language", () => {
  const DIAGNOSIS_LEXEMES = [/diagn[oó]stic/i, /diagnosticar/i, /निदान/];

  // T110 review F1: mirrors `strings-detector-lint.test.ts`'s collector --
  // a FUNCTION leaf is INVOKED (dummy args built from `fn.length`, same
  // idiom as the T097 detector) and its RESULT is scanned, rather than
  // silently dropped. There is exactly one function leaf per dictionary
  // today (`addPet.common.stepOf`); dropping it would leave the one
  // interpolated leaf in every dict permanently unscanned.
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
    const fixture = { addPet: { common: { stepOf: (a: string, b: string) => `${a} Diagnóstico ${b}` } } };
    const leaves = collectStringLeaves(fixture);
    expect(leaves.some((value) => DIAGNOSIS_LEXEMES.some((lexeme) => lexeme.test(value)))).toBe(
      true,
    );
  });
});
