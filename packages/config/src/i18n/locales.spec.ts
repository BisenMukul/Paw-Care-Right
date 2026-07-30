import {
  DEFAULT_LOCALE,
  LOCALES,
  RTL_LANGUAGES,
  getTextDirection,
  isRtlLocale,
  isSupportedLocale,
  negotiateLocale,
  parseAcceptLanguage,
  resolveServedLocale,
  selectActiveLocale,
} from "./locales";

describe("locale registry", () => {
  it("every non-en locale is reviewed:false, en is reviewed:true", () => {
    for (const entry of Object.values(LOCALES)) {
      if (entry.id === "en") {
        expect(entry.reviewed).toBe(true);
      } else {
        expect(entry.reviewed).toBe(false);
      }
    }
  });

  it("DEFAULT_LOCALE is en", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("RTL_LANGUAGES covers the standard RTL language subtags", () => {
    expect(RTL_LANGUAGES).toEqual(expect.arrayContaining(["ar", "he", "fa", "ur"]));
  });
});

describe("direction resolves from the base language, not the full tag", () => {
  it.each([
    ["ar", "rtl"],
    ["ar-EG", "rtl"],
    ["ar-XB", "rtl"],
    ["he-IL", "rtl"],
    ["fa", "rtl"],
    ["ur", "rtl"],
    ["en", "ltr"],
    ["en-XA", "ltr"],
    ["es", "ltr"],
    ["pt-BR", "ltr"],
    ["hi", "ltr"],
    ["", "ltr"],
    ["zz-ZZ", "ltr"],
  ] as const)("%s -> %s", (locale, direction) => {
    expect(getTextDirection(locale)).toBe(direction);
  });

  it("isRtlLocale mirrors getTextDirection", () => {
    expect(isRtlLocale("ar-XB")).toBe(true);
    expect(isRtlLocale("en")).toBe(false);
  });
});

describe("isSupportedLocale", () => {
  it("recognizes every registered locale id", () => {
    for (const id of Object.keys(LOCALES)) {
      expect(isSupportedLocale(id)).toBe(true);
    }
  });

  it("rejects unknown values", () => {
    expect(isSupportedLocale("fr")).toBe(false);
    expect(isSupportedLocale("")).toBe(false);
  });
});

describe("parseAcceptLanguage", () => {
  it("orders by descending q-value", () => {
    expect(parseAcceptLanguage("en;q=0.5, es;q=0.9, hi;q=0.1")).toEqual(["es", "en", "hi"]);
  });

  it("treats a missing q as 1 and keeps header order for ties", () => {
    expect(parseAcceptLanguage("en, es")).toEqual(["en", "es"]);
  });

  it("is tolerant of malformed segments", () => {
    expect(parseAcceptLanguage("en;q=banana, ,es;q=0.8;garbage=1")).toEqual(["en", "es"]);
  });

  it("returns [] for null/undefined/empty", () => {
    expect(parseAcceptLanguage(null)).toEqual([]);
    expect(parseAcceptLanguage(undefined)).toEqual([]);
    expect(parseAcceptLanguage("")).toEqual([]);
  });
});

describe("negotiateLocale", () => {
  it("prefers an exact match", () => {
    expect(negotiateLocale(["fr", "pt-BR", "en"])).toBe("pt-BR");
  });

  it("falls back to a base-language match", () => {
    expect(negotiateLocale(["pt-PT"])).toBe("pt-BR");
  });

  it("falls back to DEFAULT_LOCALE when nothing matches", () => {
    expect(negotiateLocale(["fr", "de"])).toBe(DEFAULT_LOCALE);
  });

  it("falls back to DEFAULT_LOCALE for an empty candidate list", () => {
    expect(negotiateLocale([])).toBe(DEFAULT_LOCALE);
  });
});

describe("resolveServedLocale — the safety gate", () => {
  it("serves en unmodified", () => {
    expect(resolveServedLocale("en")).toBe("en");
  });

  it("forces every unreviewed locale back to en", () => {
    expect(resolveServedLocale("es")).toBe("en");
    expect(resolveServedLocale("pt-BR")).toBe("en");
    expect(resolveServedLocale("hi")).toBe("en");
    expect(resolveServedLocale("ar")).toBe("en");
  });

  it("forces an unsupported locale back to en", () => {
    expect(resolveServedLocale("fr")).toBe("en");
    expect(resolveServedLocale("")).toBe("en");
  });
});

describe("selectActiveLocale", () => {
  it("the dev override wins when NODE_ENV is development or test (the allowlist)", () => {
    expect(
      selectActiveLocale({ override: "en-XA", candidates: ["en"], nodeEnv: "test" }),
    ).toBe("en-XA");
    expect(
      selectActiveLocale({ override: "en-XA", candidates: ["en"], nodeEnv: "development" }),
    ).toBe("en-XA");
  });

  it("the dev override is ignored when NODE_ENV is production", () => {
    expect(
      selectActiveLocale({ override: "en-XA", candidates: ["en"], nodeEnv: "production" }),
    ).toBe("en");
  });

  // T110 review F3: a safety gate must fail CLOSED on the unknown case, not
  // open. `nodeEnv` is an ALLOWLIST (`"development" | "test"`), not a
  // denylist of `!== "production"` -- so a bare process that never set
  // `NODE_ENV` (a script, a custom server entry) can never bypass the serve
  // gate via a stray override env var.
  it("fails closed (treated as production) when nodeEnv is undefined, even with an override set", () => {
    expect(selectActiveLocale({ override: "es" })).toBe("en");
    expect(selectActiveLocale({ override: "en-XA" })).toBe("en");
  });

  it("fails closed for any nodeEnv value outside the allowlist (e.g. a custom deploy env name)", () => {
    expect(selectActiveLocale({ override: "es", nodeEnv: "staging" })).toBe("en");
  });

  it("negotiates from candidates when there is no override", () => {
    expect(selectActiveLocale({ candidates: ["pt-BR", "en"], nodeEnv: "test" })).toBe("en");
  });

  it("still applies the safety gate to a negotiated but unreviewed locale", () => {
    expect(selectActiveLocale({ candidates: ["es"], nodeEnv: "test" })).toBe("en");
  });

  it("defaults to en with no override and no candidates", () => {
    expect(selectActiveLocale({})).toBe("en");
  });
});
