// T110 group R (web mirror): the `strings` identity fast-path + locale
// selection contract. No jsdom/render here (F7) -- these are pure-module
// assertions, mirroring `apps/mobile/__tests__/i18n-runtime.test.ts`'s first
// three cases plus the web-specific override env var.
import { resolveStrings } from "@bombaypetcompany/config";

describe("strings identity fast-path (plan §2.1)", () => {
  it("strings is reference-identical to enStrings under en", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: fresh require to assert reference identity, mirrors the mobile group-R test and eas-config.test.ts's resetModules idiom
    const { strings, enStrings } = require("../strings") as typeof import("../strings");
    expect(strings).toBe(enStrings);
  });
});

describe("resolveStrings (re-exported contract)", () => {
  it("an override merges without mutating the English tree", () => {
    const en = { footer: { homeLabel: "Home" } } as const;
    const before = JSON.stringify(en);
    const merged = resolveStrings(en, { footer: { homeLabel: "Inicio" } });
    expect(merged.footer.homeLabel).toBe("Inicio");
    expect(JSON.stringify(en)).toBe(before);
  });

  it("an unknown or garbage locale falls back to en", () => {
    process.env.NEXT_PUBLIC_I18N_LOCALE = "zz-not-a-locale";
    jest.resetModules();
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: resetModules requires a fresh require to re-evaluate the env-read at module init
      const { strings, enStrings } = require("../strings") as typeof import("../strings");
      expect(strings).toBe(enStrings);
    } finally {
      delete process.env.NEXT_PUBLIC_I18N_LOCALE;
      jest.resetModules();
    }
  });
});

describe("getActiveLocale / getActiveDirection", () => {
  it("resolve to en/ltr with no override", () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: resetModules requires a fresh require
    const { getActiveLocale, getActiveDirection } = require("./runtime") as typeof import("./runtime");
    expect(getActiveLocale()).toBe("en");
    expect(getActiveDirection()).toBe("ltr");
  });

  it("the dev override selects the requested locale (non-production)", () => {
    process.env.NEXT_PUBLIC_I18N_LOCALE = "en-XA";
    jest.resetModules();
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: resetModules requires a fresh require to re-evaluate the env-read at module init
      const { getActiveLocale, getActiveDirection } = require("./runtime") as typeof import("./runtime");
      expect(getActiveLocale()).toBe("en-XA");
      expect(getActiveDirection()).toBe("ltr");
    } finally {
      delete process.env.NEXT_PUBLIC_I18N_LOCALE;
      jest.resetModules();
    }
  });

  it("the dev override is ignored when NODE_ENV is production", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NEXT_PUBLIC_I18N_LOCALE = "en-XA";
    (process.env as Record<string, string>).NODE_ENV = "production";
    jest.resetModules();
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: resetModules requires a fresh require to re-evaluate the env-read at module init
      const { getActiveLocale } = require("./runtime") as typeof import("./runtime");
      expect(getActiveLocale()).toBe("en");
    } finally {
      delete process.env.NEXT_PUBLIC_I18N_LOCALE;
      (process.env as Record<string, string>).NODE_ENV = originalNodeEnv ?? "test";
      jest.resetModules();
    }
  });
});

describe("resolveActiveStrings", () => {
  it("is safe to call at module-init time and never throws", () => {
    expect(() => {
      jest.resetModules();
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: resetModules requires a fresh require
      require("../strings");
    }).not.toThrow();
  });

  it("returns the pseudo-transformed tree when the override is en-XA", () => {
    process.env.NEXT_PUBLIC_I18N_LOCALE = "en-XA";
    jest.resetModules();
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: resetModules requires a fresh require to re-evaluate the env-read at module init
      const { strings } = require("../strings") as typeof import("../strings");
      expect(strings.footer.homeLabel).not.toBe("Home");
      expect(strings.footer.homeLabel).toContain("⟦");
    } finally {
      delete process.env.NEXT_PUBLIC_I18N_LOCALE;
      jest.resetModules();
    }
  });
});
