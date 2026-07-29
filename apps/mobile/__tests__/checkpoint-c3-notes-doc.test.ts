/**
 * T101 plan step 15 (§5 AC map): drift guard for `loop/checkpoint-C3-notes.md`
 * and `apps/mobile/scripts/internal-distribution.sh`. House idiom copied
 * verbatim from `release-runbook-doc.test.ts` (locally-typed `require` for
 * `node:fs`/`node:path`, `declare const __dirname`, lone `export {}`,
 * `SECRET_PATTERNS`) and `store-marketing-strings.test.ts` (`scanUnsafeText`
 * + `CLAIMS_PATTERNS`, positive controls).
 */
export {};

import { APP_DISPLAY_NAME } from "@bombaypetcompany/config";
import { scanUnsafeText } from "@bombaypetcompany/ai";

import { strings } from "../src/strings";

declare const __dirname: string;

interface NodeFs {
  readFileSync(path: string, encoding: string): string;
}
interface NodePath {
  join(...parts: string[]): string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: locally-typed require avoids adding @types/node (a new dep is out of scope), mirrors release-runbook-doc.test.ts
const fs = require("node:fs") as NodeFs;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const path = require("node:path") as NodePath;

const NOTES_PATH = path.join(__dirname, "..", "..", "..", "loop", "checkpoint-C3-notes.md");
const SCRIPT_PATH = path.join(__dirname, "..", "scripts", "internal-distribution.sh");
const EAS_JSON_PATH = path.join(__dirname, "..", "eas.json");
const PACKAGE_JSON_PATH = path.join(__dirname, "..", "package.json");

const notes = fs.readFileSync(NOTES_PATH, "utf8");
const script = fs.readFileSync(SCRIPT_PATH, "utf8");
const packageJson: { scripts: Record<string, string> } = JSON.parse(
  fs.readFileSync(PACKAGE_JSON_PATH, "utf8"),
);
const easJson: {
  submit: { preview: { android: { track: string } } };
} = JSON.parse(fs.readFileSync(EAS_JSON_PATH, "utf8"));

const SECRET_PATTERNS: RegExp[] = [
  /AKIA[0-9A-Z]{16}/,
  new RegExp("\\bsk-" + "[A-Za-z0-9_-]{20,}"),
  new RegExp("AIza" + "[0-9A-Za-z_-]{35}"),
  /-----BEGIN/,
  new RegExp("eyJ" + "[A-Za-z0-9_-]{10,}\\."),
];

// T100's forbidden-token tier (the T038 `scanUnsafeText` alone does not
// catch bare "dosage"/"mg"/"cure"/"clinically"/"guaranteed"/"vet-approved"/
// "treat your").
const CLAIMS_PATTERNS: readonly RegExp[] = [
  /prescri/i,
  /\bdosage\b/i,
  /\bdose\b/i,
  /\bmg\b/i,
  /\bcure\b/i,
  /treat your/i,
  /vet-approved/i,
  /clinically/i,
  /guaranteed/i,
];

const CLAIMS_POSITIVE_CONTROLS: readonly string[] = [
  "Get a prescription in minutes.",
  "Follow the exact dosage every time.",
  "Never miss a dose.",
  "Give 5 mg with food.",
  "This will cure your pet's condition.",
  "We treat your dog's illness.",
  "Vet-approved advice, always.",
  "Clinically shown to help.",
  "Guaranteed results in a week.",
];

function extractBetaNotesBlock(source: string): string {
  const startMarker = "<!-- beta-notes:start -->";
  const endMarker = "<!-- beta-notes:end -->";
  const startIndex = source.indexOf(startMarker);
  const endIndex = source.indexOf(endMarker);
  if (startIndex === -1 || endIndex === -1) {
    return "";
  }
  return source.slice(startIndex + startMarker.length, endIndex).trim();
}

describe("checkpoint-C3 notes (T101)", () => {
  it("contains the nine required numbered sections", () => {
    const requiredHeadingWords = [
      "Purpose",
      "Status",
      "Prerequisites",
      "Apple",
      "Play",
      "Beta",
      "Evidence",
      "Remaining",
      "Definition",
    ];
    for (const word of requiredHeadingWords) {
      const headingPattern = new RegExp(`^## \\d+\\. .*${word}`, "m");
      expect(headingPattern.test(notes)).toBe(true);
    }
  });

  it("documents build and submit commands for both platforms on the preview profile", () => {
    expect(notes).toContain("build --profile preview --platform ios");
    expect(notes).toContain("build --profile preview --platform android");
    expect(notes).toContain("submit --profile preview --platform ios");
    expect(notes).toContain("submit --profile preview --platform android");
  });

  it("every checklist line carries exactly one FOUNDER or AUTOMATED-READY tag", () => {
    const checklistLines = notes.split("\n").filter((line) => line.startsWith("- [ ] "));
    expect(checklistLines.length).toBeGreaterThanOrEqual(25);

    let founderCount = 0;
    let automatedReadyCount = 0;
    for (const line of checklistLines) {
      const hasFounder = line.includes("**[FOUNDER]**");
      const hasAutomatedReady = line.includes("**[AUTOMATED-READY]**");
      expect(hasFounder !== hasAutomatedReady).toBe(true); // exactly one, never both, never neither
      if (hasFounder) founderCount += 1;
      if (hasAutomatedReady) automatedReadyCount += 1;
    }
    expect(founderCount).toBeGreaterThanOrEqual(15);
    expect(automatedReadyCount).toBeGreaterThanOrEqual(4);
  });

  it("every AUTOMATED-READY step names a runnable command", () => {
    const automatedReadyLines = notes
      .split("\n")
      .filter((line) => line.startsWith("- [ ] ") && line.includes("**[AUTOMATED-READY]**"));
    expect(automatedReadyLines.length).toBeGreaterThanOrEqual(4);
    const runnableCommandPattern = /`[^`]*(eas-cli|expo |pnpm |sh scripts\/)[^`]*`/;
    for (const line of automatedReadyLines) {
      expect(runnableCommandPattern.test(line)).toBe(true);
    }
  });

  it("the automation script is POSIX-safe, dry-runnable and covers both platforms", () => {
    expect(script).toContain("#!/bin/sh");
    expect(script).toContain("set -eu");
    expect(script).toContain("--dry-run");
    expect(script).toContain("EXPO_TOKEN");
    expect(script).toContain("build --profile preview --platform ios");
    expect(script).toContain("build --profile preview --platform android");
    expect(script).toContain("submit --profile preview --platform ios");
    expect(script).toContain("submit --profile preview --platform android");
    expect(script).not.toContain("[[");
    expect(packageJson.scripts["dist:internal"]).toBe("sh scripts/internal-distribution.sh");
    expect(notes).toContain("dist:internal");
  });

  it("the beta release-notes block is safety-clean", () => {
    const block = extractBetaNotesBlock(notes);
    expect(block.length).toBeGreaterThanOrEqual(100);

    const findings = scanUnsafeText(block, "checkpoint-C3-notes.beta");
    expect(findings).toEqual([]);

    for (const pattern of CLAIMS_PATTERNS) {
      expect(pattern.test(block)).toBe(false);
    }

    expect(block).toContain(strings.check.result.disclaimer(APP_DISPLAY_NAME));

    // Positive controls (mutation-proof): planted unsafe copy IS flagged.
    expect(scanUnsafeText("This is a diagnosis of arthritis.").length).toBeGreaterThanOrEqual(1);
    expect(scanUnsafeText("Give 5mg twice daily.").length).toBeGreaterThanOrEqual(1);
    let atLeastOneClaimsMatch = false;
    for (let index = 0; index < CLAIMS_PATTERNS.length; index += 1) {
      if (CLAIMS_PATTERNS[index]!.test(CLAIMS_POSITIVE_CONTROLS[index]!)) {
        atLeastOneClaimsMatch = true;
      }
    }
    expect(atLeastOneClaimsMatch).toBe(true);
  });

  it("records honestly that no signed store artifact was produced in this environment", () => {
    expect(notes).toContain("EXPO_TOKEN");
    expect(notes).toContain(".ipa");
    expect(notes).toContain(".aab");
    const evidenceSectionPattern = /^## 7\. .*Evidence[\s\S]*?(?=^## 8\.)/m;
    const evidenceMatch = notes.match(evidenceSectionPattern);
    expect(evidenceMatch).not.toBeNull();
    const evidenceSection = evidenceMatch ? evidenceMatch[0] : "";
    expect(evidenceSection).toContain("expo export");
    expect(evidenceSection).toContain("--non-interactive");
  });

  it("invents no identifier and commits no secret-shaped value", () => {
    const idPattern =
      /(ascAppId|appleTeamId|serviceAccountKeyPath)\s*[:=]\s*"?[A-Za-z0-9][A-Za-z0-9._-]{5,}/;
    for (const pattern of SECRET_PATTERNS) {
      expect(pattern.test(notes)).toBe(false);
      expect(pattern.test(script)).toBe(false);
    }
    expect(idPattern.test(notes)).toBe(false);
    expect(idPattern.test(script)).toBe(false);
  });

  it("matches the submit configuration actually committed in eas.json", () => {
    expect(easJson.submit.preview.android.track).toBe("internal");
    const submitBlockText = JSON.stringify(easJson.submit);
    expect(submitBlockText).not.toContain("ascAppId");
    expect(submitBlockText).not.toContain("appleTeamId");
    expect(submitBlockText).not.toContain("serviceAccountKeyPath");
    expect(notes).toContain("internal");
  });
});
