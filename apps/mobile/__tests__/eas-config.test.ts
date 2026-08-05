/**
 * T099 plan step 8a (AC1 proof): `eas build --profile preview` cannot be
 * exercised for real in this environment (no `EXPO_TOKEN`, no EAS project
 * access, no vendored `eas-cli` — see D1/D2 in `loop/plans/T099.plan.md`).
 * This is the repo-owned, offline, deterministic stand-in: it parses
 * `eas.json` as JSON (proving it's valid), validates it against the
 * documented EAS build-schema constraints this task commits to, and
 * cross-checks it against `app.config.js` and `.env.example`.
 *
 * House idiom copied from `state-audit-doc.test.ts` / `image-cache-policy-scan.test.ts`:
 * this workspace has no `@types/node`, so `node:fs`/`node:path` are accessed
 * via a locally-typed `require`, and `__dirname` is declared locally as a
 * real per-module CJS free variable. The empty `export {}` keeps this file
 * an isolated module so its own `declare const __dirname` can't collide with
 * another test file's.
 */
export {};

declare const __dirname: string;

interface NodeFs {
  readFileSync(path: string, encoding: string): string;
}
interface NodePath {
  join(...parts: string[]): string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: locally-typed require avoids adding @types/node (a new dep is out of scope), mirrors state-audit-doc.test.ts
const fs = require("node:fs") as NodeFs;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const path = require("node:path") as NodePath;

const EAS_JSON_PATH = path.join(__dirname, "..", "eas.json");
const ENV_EXAMPLE_PATH = path.join(__dirname, "..", "..", "..", ".env.example");
const APP_CONFIG_PATH = path.join(__dirname, "..", "app.config.js");

interface Profile {
  developmentClient?: boolean;
  distribution: string;
  channel: string;
  environment: string;
  autoIncrement?: boolean;
  credentialsSource?: string;
  env?: Record<string, string>;
  ios?: { simulator?: boolean };
  android?: { buildType: string };
}
interface EasJson {
  cli: { version: string; appVersionSource: string; requireCommit: boolean };
  build: Record<string, Profile>;
  submit: Record<string, { android: { track: string } }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readEasJson(): EasJson {
  const raw = fs.readFileSync(EAS_JSON_PATH, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error("eas.json did not parse to an object");
  }
  return parsed as unknown as EasJson;
}

/**
 * Loads the evaluated Expo config object. `app.config.js` is plain CommonJS
 * with no workspace-specific transpilation needs at require-time (see its
 * own header comment), so a direct `require` resolves the built
 * `@bombaypetcompany/config` package under Jest just as it does under Node/EAS.
 */
function requireAppConfig(): unknown {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: loading the real Expo dynamic config file (CJS, not a TS module) to prove it evaluates and to cross-check its values against eas.json
  return require(APP_CONFIG_PATH);
}

interface AppConfigShape {
  name: string;
  slug: string;
  scheme: string;
  version: string;
  ios: { bundleIdentifier: string; buildNumber?: number };
  android: { package: string; versionCode?: number };
  extra: {
    eas: { projectId: string };
    gitSha: string;
  };
}

function asAppConfig(value: unknown): AppConfigShape {
  if (!isRecord(value)) {
    throw new Error("app.config.js did not evaluate to an object");
  }
  return value as unknown as AppConfigShape;
}

const SECRET_PATTERNS: RegExp[] = [
  /AKIA[0-9A-Z]{16}/,
  new RegExp("\\bsk-" + "[A-Za-z0-9_-]{20,}"),
  new RegExp("AIza" + "[0-9A-Za-z_-]{35}"),
  /-----BEGIN/,
  new RegExp("eyJ" + "[A-Za-z0-9_-]{10,}\\."),
];

function collectStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === "string") {
    acc.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, acc);
    }
  } else if (isRecord(value)) {
    for (const key of Object.keys(value)) {
      acc.push(key);
      collectStrings(value[key], acc);
    }
  }
  return acc;
}

const easJson = readEasJson();
const appConfig = asAppConfig(requireAppConfig());
const envExampleSource = fs.readFileSync(ENV_EXAMPLE_PATH, "utf8");
const appConfigSource = fs.readFileSync(APP_CONFIG_PATH, "utf8");

describe("eas.json (T099)", () => {
  it("is valid JSON and declares a remote appVersionSource with a pinned cli version", () => {
    expect(easJson.cli.appVersionSource).toBe("remote");
    expect(easJson.cli.version).toMatch(/^>=\s*\d+\.\d+\.\d+$/);
    expect(easJson.cli.requireCommit).toBe(true);
  });

  it("declares exactly the development, preview and production build profiles", () => {
    expect(Object.keys(easJson.build).sort()).toEqual(["development", "preview", "production"]);
  });

  it("gives the preview profile an internal distribution and the preview channel", () => {
    const preview = easJson.build.preview!;
    expect(preview.distribution).toBe("internal");
    expect(preview.channel).toBe("preview");
    expect(preview.environment).toBe("preview");
    expect(preview.autoIncrement).toBe(true);
    expect(preview.credentialsSource).toBe("remote");
    expect(preview.android?.buildType).toBe("app-bundle");
  });

  it("uses each profile's own name as its EAS Update channel and environment", () => {
    for (const [name, profile] of Object.entries(easJson.build)) {
      expect(profile.channel).toBe(name);
      expect(profile.environment).toBe(name);
    }
  });

  it("accepts only documented values for every profile field", () => {
    const validDistributions = new Set(["internal", "store"]);
    const validNames = new Set(["development", "preview", "production"]);
    const validBuildTypes = new Set(["apk", "app-bundle"]);

    expect(Object.keys(easJson).sort()).toEqual(["build", "cli", "submit"]);

    for (const profile of Object.values(easJson.build)) {
      expect(validDistributions.has(profile.distribution)).toBe(true);
      expect(validNames.has(profile.channel)).toBe(true);
      expect(validNames.has(profile.environment)).toBe(true);
      if (profile.android !== undefined) {
        expect(validBuildTypes.has(profile.android.buildType)).toBe(true);
      }
      if (profile.autoIncrement !== undefined) {
        expect(typeof profile.autoIncrement).toBe("boolean");
      }
      for (const value of Object.values(profile.env ?? {})) {
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it("never pins iOS buildNumber or Android versionCode in app.config (remote version source owns them)", () => {
    expect(appConfig.ios.buildNumber).toBeUndefined();
    expect(appConfig.android.versionCode).toBeUndefined();
  });

  it("commits no secret-shaped value", () => {
    const easStrings = collectStrings(easJson as unknown);
    for (const value of easStrings) {
      for (const pattern of SECRET_PATTERNS) {
        expect(pattern.test(value)).toBe(false);
      }
    }
    const secretKeyNames = [
      "EXPO_PUBLIC_RC_IOS_KEY",
      "EXPO_PUBLIC_RC_ANDROID_KEY",
      "EXPO_PUBLIC_POSTHOG_KEY",
      "EXPO_PUBLIC_SENTRY_DSN",
      "SENTRY_AUTH_TOKEN",
    ];
    for (const profile of Object.values(easJson.build)) {
      const envKeys = Object.keys(profile.env ?? {});
      for (const secretKey of secretKeyNames) {
        expect(envKeys.includes(secretKey)).toBe(false);
      }
    }
  });

  it("keeps app.config identifiers on the §1a naming table", () => {
    expect(appConfig.slug).toBe("bombaypetcompany");
    expect(appConfig.ios.bundleIdentifier).toBe("com.bombaypetcompany.app");
    expect(appConfig.android.package).toBe("com.bombaypetcompany.app");
    expect(appConfig.scheme).toBe("bombaypetcompany");
    expect(appConfig.name).toBe("Bombay Pet Company");
  });

  it("carries a submittable marketing version", () => {
    expect(appConfig.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(appConfig.version).not.toBe("0.0.0");
  });

  it("keeps an eas.projectId placeholder that is a real UUID shape", () => {
    // Founder to-do (see docs/release-runbook.md §9 item 1): the UUID below
    // points at the pre-REBRAND-1 EAS project and must be swapped for the
    // real `bombaypetcompany`-slugged project's server-assigned id. This
    // test pins only the UUID *shape* so that swap needs no test change.
    expect(appConfig.extra.eas.projectId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("derives gitSha from EXPO_PUBLIC_GIT_SHA then EAS_BUILD_GIT_COMMIT_HASH then dev", () => {
    const originalGitSha = process.env.EXPO_PUBLIC_GIT_SHA;
    const originalBuildSha = process.env.EAS_BUILD_GIT_COMMIT_HASH;
    try {
      jest.resetModules();
      process.env.EXPO_PUBLIC_GIT_SHA = "sha-a";
      process.env.EAS_BUILD_GIT_COMMIT_HASH = "sha-b";
      expect(asAppConfig(requireAppConfig()).extra.gitSha).toBe("sha-a");

      jest.resetModules();
      delete process.env.EXPO_PUBLIC_GIT_SHA;
      process.env.EAS_BUILD_GIT_COMMIT_HASH = "sha-b";
      expect(asAppConfig(requireAppConfig()).extra.gitSha).toBe("sha-b");

      jest.resetModules();
      delete process.env.EXPO_PUBLIC_GIT_SHA;
      delete process.env.EAS_BUILD_GIT_COMMIT_HASH;
      expect(asAppConfig(requireAppConfig()).extra.gitSha).toBe("dev");
    } finally {
      jest.resetModules();
      if (originalGitSha === undefined) {
        delete process.env.EXPO_PUBLIC_GIT_SHA;
      } else {
        process.env.EXPO_PUBLIC_GIT_SHA = originalGitSha;
      }
      if (originalBuildSha === undefined) {
        delete process.env.EAS_BUILD_GIT_COMMIT_HASH;
      } else {
        process.env.EAS_BUILD_GIT_COMMIT_HASH = originalBuildSha;
      }
    }
  });

  it("documents every EXPO_PUBLIC_ variable app.config reads in .env.example", () => {
    const referenced = new Set<string>();
    const pattern = /EXPO_PUBLIC_[A-Z0-9_]+/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(appConfigSource)) !== null) {
      referenced.add(match[0]);
    }
    expect(referenced.size).toBeGreaterThanOrEqual(6); // non-vacuity floor

    const missing = [...referenced].filter(
      (key) => !new RegExp(`^${key}=`, "m").test(envExampleSource),
    );
    expect(missing).toEqual([]);
  });
});
