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
   *
   * T114 F7 fix: the ORIGINAL version of this test counted
   * `/set -o pipefail/g` across the WHOLE `ci.yml` text and asserted
   * `>= 2`. `ci.yml`'s own explanatory comment (a few lines above the two
   * real steps, describing WHY `set -o pipefail` is needed) contains that
   * exact string too, making the real count 3 for only 2 real steps --
   * deleting one real `set -o pipefail` line would still leave the count at
   * 2, and the old assertion would stay green over a real regression. This
   * version instead parses the two named `Fingerprint diff (android|ios)`
   * steps' OWN `run:` block bodies (not the surrounding file text) and
   * requires a non-comment line in EACH body that is exactly
   * `set -o pipefail` once trimmed.
   */
  const FINGERPRINT_STEP_NAMES = ["Fingerprint diff (android)", "Fingerprint diff (ios)"] as const;

  /** Extracts the literal lines of a `- name: <stepName>` step's `run: |` block, by indentation, starting after the `run: |` line and stopping at the first line indented at or above the `run:` key itself. */
  function extractStepRunBody(source: string, stepName: string): string[] | null {
    const nameIndex = source.indexOf(`- name: ${stepName}`);
    if (nameIndex === -1) {
      return null;
    }
    const runKeyIndex = source.indexOf("run: |", nameIndex);
    if (runKeyIndex === -1) {
      return null;
    }
    const runLineStart = source.lastIndexOf("\n", runKeyIndex) + 1;
    const runIndent = runKeyIndex - runLineStart;
    const bodyStart = source.indexOf("\n", runKeyIndex) + 1;
    const lines: string[] = [];
    for (const line of source.slice(bodyStart).split("\n")) {
      if (line.trim() === "") {
        lines.push(line);
        continue;
      }
      const indent = line.length - line.trimStart().length;
      if (indent <= runIndent) {
        break;
      }
      lines.push(line);
    }
    return lines;
  }

  it("both Fingerprint diff steps set pipefail in their own run body (not in a comment)", () => {
    const stepsWithPipefail = FINGERPRINT_STEP_NAMES.filter((stepName) => {
      const body = extractStepRunBody(ciYmlSource, stepName);
      return body !== null && body.some((line) => line.trim() === "set -o pipefail");
    });

    // Non-vacuity: both named steps must actually have been found (parseable).
    expect(
      FINGERPRINT_STEP_NAMES.filter((stepName) => extractStepRunBody(ciYmlSource, stepName) !== null),
    ).toEqual([...FINGERPRINT_STEP_NAMES]);

    expect(stepsWithPipefail).toEqual([...FINGERPRINT_STEP_NAMES]);
  });

  it("the run-body extraction genuinely distinguishes a comment mention from a real body line (mutation-proof)", () => {
    const withCommentOnly = `
      - name: Fingerprint diff (android)
        run: |
          # set -o pipefail (mentioned in a comment only)
          echo hi
      - name: next step
        run: echo done
    `;
    const body = extractStepRunBody(withCommentOnly, "Fingerprint diff (android)");
    expect(body).not.toBeNull();
    expect(body?.some((line) => line.trim() === "set -o pipefail")).toBe(false);
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

  /**
   * T113 carry-forward F8: the script's `--)` shift-skip case (defense in
   * depth for a forwarded literal `--`, see the script's own comment) had no
   * test driving it -- every existing dry-run invocation omits `--` entirely.
   * This pins BOTH halves: a forwarded `--` is tolerated (the branch is
   * exercised, not merely present), and an actually-unknown flag is still
   * rejected (proving the branch was not loosened into a catch-all that
   * swallows every argument).
   */
  it("tolerates a forwarded `--` and still rejects unknown flags", () => {
    const withDoubleDash = childProcess.spawnSync("sh", [FINGERPRINT_SCRIPT_PATH, "--", "--dry-run"], {
      encoding: "utf8",
      cwd: MOBILE_DIR,
    });
    expect(withDoubleDash.status).toBe(0);
    expect(withDoubleDash.stdout).toContain("fingerprint-diff: ordered plan");

    const withUnknownFlag = childProcess.spawnSync("sh", [FINGERPRINT_SCRIPT_PATH, "--nope"], {
      encoding: "utf8",
      cwd: MOBILE_DIR,
    });
    expect(withUnknownFlag.status).not.toBe(0);
    expect(withUnknownFlag.stderr).toContain("unknown argument");
  });
});
