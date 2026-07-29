/**
 * T099 plan step 8b (AC2 proof): drift guard for `docs/release-runbook.md`.
 * House idiom copied from `state-audit-doc.test.ts` — see that file's header
 * comment for why `node:fs`/`node:path` are accessed via a locally-typed
 * `require` (no `@types/node` in this workspace) and why the lone
 * `export {}` is required.
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

const RUNBOOK_PATH = path.join(__dirname, "..", "..", "..", "docs", "release-runbook.md");
const EAS_JSON_PATH = path.join(__dirname, "..", "eas.json");

const runbook = fs.readFileSync(RUNBOOK_PATH, "utf8");
const easJson: { build: Record<string, { channel: string }> } = JSON.parse(
  fs.readFileSync(EAS_JSON_PATH, "utf8"),
);

const SECRET_PATTERNS: RegExp[] = [
  /AKIA[0-9A-Z]{16}/,
  new RegExp("\\bsk-" + "[A-Za-z0-9_-]{20,}"),
  new RegExp("AIza" + "[0-9A-Za-z_-]{35}"),
  /-----BEGIN/,
  new RegExp("eyJ" + "[A-Za-z0-9_-]{10,}\\."),
];

describe("docs/release-runbook.md (T099)", () => {
  it("contains the required sections", () => {
    const requiredHeadingWords = [
      "Identifiers",
      "Prerequisites",
      "Build profiles",
      "Environment variables",
      "Versioning",
      "Build",
      "OTA",
      "Verification",
      "Founder",
    ];
    for (const word of requiredHeadingWords) {
      const headingPattern = new RegExp(`^## \\d+\\. .*${word}`, "m");
      expect(headingPattern.test(runbook)).toBe(true);
    }
  });

  it("documents a build, a submit and an update command", () => {
    expect(runbook).toContain("eas-cli@latest build --profile preview");
    expect(runbook).toContain("build --profile production");
    expect(runbook).toContain("submit --profile production --platform ios");
    expect(runbook).toContain("submit --profile production --platform android");
    expect(runbook).toContain("update --branch preview");
  });

  it("documents every build profile defined in eas.json", () => {
    expect(Object.keys(easJson.build).length).toBeGreaterThanOrEqual(3); // non-vacuity floor
    for (const [name, profile] of Object.entries(easJson.build)) {
      expect(runbook).toContain(name);
      expect(runbook).toContain(profile.channel);
    }
  });

  it("delegates OTA policy to docs/OTA_UPDATES.md instead of restating it", () => {
    expect(runbook).toContain("docs/OTA_UPDATES.md");
    const hasDuplicatedRolloutLine = runbook
      .split("\n")
      .some((line) => line.includes("10%") && line.includes("50%"));
    expect(hasDuplicatedRolloutLine).toBe(false);
  });

  it("pins the Sentry release contract and the APP_VERSION mirror", () => {
    expect(runbook).toContain("bombaypetcompany@{version}+");
    expect(runbook).toContain("APP_VERSION");
  });

  it("states honestly that no eas command was executed in the build environment", () => {
    expect(runbook).toContain("EXPO_TOKEN");
    expect(runbook).toContain(
      "npx eas-cli@latest build --profile preview --platform ios --non-interactive",
    );
  });

  it("contains no secret-shaped value", () => {
    for (const pattern of SECRET_PATTERNS) {
      expect(pattern.test(runbook)).toBe(false);
    }
  });
});
