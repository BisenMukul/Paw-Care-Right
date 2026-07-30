/**
 * T113 plan step 12 (AC1 + AC2's committed-wiring half). House idiom copied
 * from `eas-config.test.ts`: this workspace has no `@types/node`, so
 * `node:fs`/`node:path`/`node:child_process` are accessed via a
 * locally-typed `require`, and `__dirname` is declared locally as a real
 * per-module CJS free variable. The empty `export {}` keeps this file an
 * isolated module so its own `declare const __dirname` can't collide with
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
interface SpawnSyncResult {
  status: number | null;
  stdout: string;
  stderr: string;
}
interface NodeChildProcess {
  spawnSync(command: string, args: string[], options: { encoding: string; cwd: string }): SpawnSyncResult;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: locally-typed require avoids adding @types/node (a new dep is out of scope), mirrors eas-config.test.ts
const fs = require("node:fs") as NodeFs;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const path = require("node:path") as NodePath;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const childProcess = require("node:child_process") as NodeChildProcess;

const MOBILE_DIR = path.join(__dirname, "..");
const APP_CONFIG_PATH = path.join(MOBILE_DIR, "app.config.js");
const EAS_JSON_PATH = path.join(MOBILE_DIR, "eas.json");
const PACKAGE_JSON_PATH = path.join(MOBILE_DIR, "package.json");
const FINGERPRINT_SCRIPT_PATH = path.join(MOBILE_DIR, "scripts", "fingerprint-diff.sh");
const CI_YML_PATH = path.join(MOBILE_DIR, "..", "..", ".github", "workflows", "ci.yml");
const ENV_EXAMPLE_PATH = path.join(MOBILE_DIR, "..", "..", ".env.example");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Loads the evaluated Expo config object -- see `requireAppConfig` in
 * `eas-config.test.ts` for why a direct `require` of the real (not copied)
 * `app.config.js` is the correct approach here.
 */
function requireAppConfig(): unknown {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: loading the real Expo dynamic config file (CJS, not a TS module) to prove it evaluates and to cross-check its OTA fields
  return require(APP_CONFIG_PATH);
}

interface AppConfigShape {
  runtimeVersion: { policy: string };
  updates: { url: string; fallbackToCacheTimeout: number; checkAutomatically: string };
  extra: { eas: { projectId: string } };
}

function asAppConfig(value: unknown): AppConfigShape {
  if (!isRecord(value)) {
    throw new Error("app.config.js did not evaluate to an object");
  }
  return value as unknown as AppConfigShape;
}

interface EasProfile {
  channel: string;
  distribution: string;
}
interface EasJson {
  build: Record<string, EasProfile>;
}

function readEasJson(): EasJson {
  const raw = fs.readFileSync(EAS_JSON_PATH, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error("eas.json did not parse to an object");
  }
  return parsed as unknown as EasJson;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readPackageJson(): PackageJson {
  const raw = fs.readFileSync(PACKAGE_JSON_PATH, "utf8");
  return JSON.parse(raw) as PackageJson;
}

const appConfig = asAppConfig(requireAppConfig());
const easJson = readEasJson();
const packageJson = readPackageJson();
const appConfigSource = fs.readFileSync(APP_CONFIG_PATH, "utf8");
const envExampleSource = fs.readFileSync(ENV_EXAMPLE_PATH, "utf8");
const fingerprintScriptSource = fs.readFileSync(FINGERPRINT_SCRIPT_PATH, "utf8");
const ciYmlSource = fs.readFileSync(CI_YML_PATH, "utf8");

describe("OTA config (T113)", () => {
  it("evaluates app.config.js with a fingerprint runtimeVersion policy", () => {
    expect(appConfig.runtimeVersion).toEqual({ policy: "fingerprint" });
  });

  it("points updates.url at the EAS project referenced by extra.eas.projectId", () => {
    expect(appConfig.updates.url).toBe(`https://u.expo.dev/${appConfig.extra.eas.projectId}`);
    expect(appConfig.updates.url).toMatch(/^https:\/\/u\.expo\.dev\/[0-9a-f-]{36}$/);
  });

  it("keeps the cold-start check non-blocking (OTA_UPDATES §3)", () => {
    expect(appConfig.updates.fallbackToCacheTimeout).toBe(0);
    expect(appConfig.updates.checkAutomatically).toBe("ON_ERROR_RECOVERY");
  });

  it("resolves the preview profile to the preview channel", () => {
    const preview = easJson.build.preview!;
    expect(preview.channel).toBe("preview");
    expect(preview.distribution).toBe("internal");

    const profileNames = Object.keys(easJson.build);
    expect(profileNames.length).toBeGreaterThanOrEqual(3);
    for (const [name, profile] of Object.entries(easJson.build)) {
      expect(profile.channel).toBe(name);
    }
  });

  it("declares expo-updates at the SDK-matched version", () => {
    expect(packageJson.dependencies?.["expo-updates"]).toMatch(/^~57\.0\.\d+$/);
    expect(packageJson.devDependencies?.["expo-updates"]).toBeUndefined();
  });

  it("adds no new EXPO_PUBLIC_ variable", () => {
    const referenced = new Set<string>();
    const pattern = /EXPO_PUBLIC_[A-Z0-9_]+/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(appConfigSource)) !== null) {
      referenced.add(match[0]);
    }
    const missing = [...referenced].filter((key) => !new RegExp(`^${key}=`, "m").test(envExampleSource));
    expect(missing).toEqual([]);
  });

  it("wires a pull-request fingerprint job in ci.yml", () => {
    expect(ciYmlSource).toMatch(/\bmobile-fingerprint:/);
    expect(ciYmlSource).toContain("if: github.event_name == 'pull_request'");
    expect(ciYmlSource).toContain("github.event.pull_request.base.sha");
    expect(ciYmlSource).toContain("GITHUB_STEP_SUMMARY");
    expect(ciYmlSource).toContain("ota:fingerprint");
  });

  /**
   * Checker FINDING 1 (HIGH) regression pin: `pnpm ota:fingerprint --
   * --base …` forwards a literal `--` on pnpm 10.34.3 (the version this repo
   * and CI pin), which the script used to reject as an unknown argument --
   * the CI job silently produced no diff at all. Pins the exact invocation
   * text (no ` -- ` between the script name and its own flags) so this
   * regression cannot be reintroduced without going red here.
   */
  it("invokes the fingerprint script directly, with no masking -- separator, in both CI steps", () => {
    expect(ciYmlSource).toContain('pnpm ota:fingerprint --base "$GITHUB_WORKSPACE/base-android.json"');
    expect(ciYmlSource).toContain('pnpm ota:fingerprint --base "$GITHUB_WORKSPACE/base-ios.json"');
    expect(ciYmlSource).not.toMatch(/ota:fingerprint\s+--\s+--base/);
  });

  /**
   * Checker FINDING 2 (MEDIUM) regression pin: the default GitHub Actions
   * `bash -e {0}` run shell has no `pipefail`, so `cmd | tee -a
   * "$GITHUB_STEP_SUMMARY"` reports `tee`'s exit status (always 0),
   * masking a real fingerprint-diff.sh failure behind a green step.
   */
  it("enables pipefail in both CI fingerprint-diff steps so a real failure cannot be masked by tee", () => {
    const pipefailCount = (ciYmlSource.match(/set -o pipefail/g) ?? []).length;
    expect(pipefailCount).toBeGreaterThanOrEqual(2);
  });

  /**
   * Checker FINDING 1/5 regression pin, dynamic form: drives the EXACT
   * indirection the CI job uses (`pnpm ota:fingerprint <flags>`, not a
   * direct `sh scripts/fingerprint-diff.sh` call) so a future pnpm-version
   * change in how `--` is forwarded is caught here, not only in CI.
   */
  it("runs a dry-run plan through the pnpm script indirection CI actually uses", () => {
    const result = childProcess.spawnSync("pnpm", ["ota:fingerprint", "--dry-run", "--platform", "ios"], {
      encoding: "utf8",
      cwd: MOBILE_DIR,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("fingerprint-diff: ordered plan");
  });

  it("keeps the fingerprint script non-masking", () => {
    expect(fingerprintScriptSource).toContain("set -eu");
    expect(fingerprintScriptSource).toContain("UNCHANGED — OTA-eligible");
    expect(fingerprintScriptSource).toContain("CHANGED — store binary release required");
    expect(fingerprintScriptSource).toContain("fingerprint:diff");
    expect(fingerprintScriptSource).toContain('FINGERPRINT_VERSION="0.20.5"');
    expect(fingerprintScriptSource).not.toContain("@expo/fingerprint@latest");
    expect(fingerprintScriptSource).not.toContain("|| true");
  });

  it("runs a dry-run plan offline", () => {
    const result = childProcess.spawnSync("sh", [FINGERPRINT_SCRIPT_PATH, "--dry-run"], {
      encoding: "utf8",
      cwd: MOBILE_DIR,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("fingerprint-diff: ordered plan");
    expect(result.stdout).not.toContain("OTA-eligible");
    expect(result.stdout).not.toContain("store binary release required");
  });
});
