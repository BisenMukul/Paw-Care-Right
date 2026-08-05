// T110 group R: mobile i18n runtime + the `strings` identity fast-path.
import { pseudoTree, resolveStrings } from "@bombaypetcompany/config";

describe("strings identity fast-path (plan §2.1)", () => {
  it("strings is reference-identical to enStrings under en", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: fresh require to assert reference identity, mirrors eas-config.test.ts's resetModules idiom
    const { strings, enStrings } = require("../src/strings") as typeof import("../src/strings");
    expect(strings).toBe(enStrings);
  });
});

describe("resolveStrings (re-exported contract)", () => {
  it("an override merges without mutating the English tree", () => {
    const en = { tabs: { home: "Home", care: "Care" } } as const;
    const before = JSON.stringify(en);
    const merged = resolveStrings(en, { tabs: { home: "Inicio" } });
    expect(merged.tabs.home).toBe("Inicio");
    expect(merged.tabs.care).toBe("Care");
    expect(JSON.stringify(en)).toBe(before);
  });

  it("an unknown or garbage locale falls back to en", () => {
    process.env.EXPO_PUBLIC_I18N_LOCALE = "zz-not-a-locale";
    jest.resetModules();
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: resetModules requires a fresh require to re-evaluate the env-read at module init
      const { strings, enStrings } = require("../src/strings") as typeof import("../src/strings");
      expect(strings).toBe(enStrings);
    } finally {
      delete process.env.EXPO_PUBLIC_I18N_LOCALE;
      jest.resetModules();
    }
  });
});

describe("detectDeviceLocales", () => {
  it("never throws when expo-localization is unavailable", () => {
    jest.resetModules();
    jest.doMock("expo-localization", () => ({
      getLocales: () => {
        throw new Error("native module unavailable");
      },
    }));
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: doMock requires a fresh require to pick up the mocked module
      const { detectDeviceLocales } = require("../src/i18n/runtime") as typeof import("../src/i18n/runtime");
      expect(() => detectDeviceLocales()).not.toThrow();
      expect(detectDeviceLocales()).toEqual([]);
    } finally {
      jest.dontMock("expo-localization");
      jest.resetModules();
    }
  });

  it("returns the device language tags in the jest environment (en-US)", () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: resetModules requires a fresh require
    const { detectDeviceLocales } = require("../src/i18n/runtime") as typeof import("../src/i18n/runtime");
    expect(detectDeviceLocales()).toEqual(expect.arrayContaining(["en-US"]));
  });
});

describe("getActiveLocale / getActiveDirection", () => {
  it("resolve to en/ltr with no override in the jest environment", () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: resetModules requires a fresh require
    const { getActiveLocale, getActiveDirection } = require("../src/i18n/runtime") as typeof import("../src/i18n/runtime");
    expect(getActiveLocale()).toBe("en");
    expect(getActiveDirection()).toBe("ltr");
  });

  it("the dev override selects the requested locale (non-production)", () => {
    process.env.EXPO_PUBLIC_I18N_LOCALE = "en-XA";
    jest.resetModules();
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: resetModules requires a fresh require to re-evaluate the env-read at module init
      const { getActiveLocale } = require("../src/i18n/runtime") as typeof import("../src/i18n/runtime");
      expect(getActiveLocale()).toBe("en-XA");
    } finally {
      delete process.env.EXPO_PUBLIC_I18N_LOCALE;
      jest.resetModules();
    }
  });

  it("getActiveLocale is memoized (computed once at module init)", () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: resetModules requires a fresh require
    const runtime = require("../src/i18n/runtime") as typeof import("../src/i18n/runtime");
    const first = runtime.getActiveLocale();
    process.env.EXPO_PUBLIC_I18N_LOCALE = "hi";
    const second = runtime.getActiveLocale();
    delete process.env.EXPO_PUBLIC_I18N_LOCALE;
    expect(second).toBe(first);
  });
});

describe("resolveActiveStrings", () => {
  it("is safe to call at module-init time and never throws", () => {
    expect(() => {
      jest.resetModules();
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: resetModules requires a fresh require
      require("../src/strings");
    }).not.toThrow();
  });

  it("returns the pseudo-transformed tree when the override is en-XA", () => {
    process.env.EXPO_PUBLIC_I18N_LOCALE = "en-XA";
    jest.resetModules();
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: resetModules requires a fresh require to re-evaluate the env-read at module init
      const { strings } = require("../src/strings") as typeof import("../src/strings");
      expect(strings.tabs.home).not.toBe("Home");
      expect(strings.tabs.home).toContain("⟦");
    } finally {
      delete process.env.EXPO_PUBLIC_I18N_LOCALE;
      jest.resetModules();
    }
  });
});

describe("pseudoTree preserves function arity", () => {
  it("so the T097 detector collector keeps working", () => {
    const fn = (a: string, b: string) => `${a}-${b}`;
    const wrapped = pseudoTree({ fn }, (s) => `[${s}]`).fn;
    expect(wrapped.length).toBe(fn.length);
  });
});
