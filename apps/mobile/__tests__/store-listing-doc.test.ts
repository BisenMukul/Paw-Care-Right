/**
 * T102 plan step 12 (§7 AC map): drift guard for `docs/store-listing.md`.
 * House idiom copied verbatim from `release-runbook-doc.test.ts` (T099) and
 * `checkpoint-c3-notes-doc.test.ts` (T101) -- lone `export {}`, `declare
 * const __dirname`, locally-typed `require("node:fs")`/`require("node:path")`
 * (no `@types/node` in this workspace), `SECRET_PATTERNS`, the
 * `^## \d+\. .*Word` heading regex, and `<!-- marker:start -->`/
 * `<!-- marker:end -->` block extraction -- plus `store-marketing-strings.test.ts`'s
 * (T100) verbatim 10-entry `CLAIMS_PATTERNS` + positive controls and the
 * real `scanUnsafeText` detector (never re-implemented, never loosened).
 */
export {};

import { APP_DISPLAY_NAME } from "@bombaypetcompany/config";
import { scanUnsafeText } from "@bombaypetcompany/ai";
import { vetDisclaimerLine } from "@bombaypetcompany/types";

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

const DOC_PATH = path.join(__dirname, "..", "..", "..", "docs", "store-listing.md");
const NOTES_PATH = path.join(__dirname, "..", "..", "..", "loop", "checkpoint-C3-notes.md");

const doc = fs.readFileSync(DOC_PATH, "utf8");
const notes = fs.readFileSync(NOTES_PATH, "utf8");

const SECRET_PATTERNS: RegExp[] = [
  /AKIA[0-9A-Z]{16}/,
  new RegExp("\\bsk-" + "[A-Za-z0-9_-]{20,}"),
  new RegExp("AIza" + "[0-9A-Za-z_-]{35}"),
  /-----BEGIN/,
  new RegExp("eyJ" + "[A-Za-z0-9_-]{10,}\\."),
];

// T100's forbidden-token tier, copied verbatim from
// `store-marketing-strings.test.ts:37-61` -- `scanUnsafeText` alone does not
// catch bare "dosage"/"mg"/"cure"/"clinically"/"guaranteed"/"vet-approved"/
// "emergency care replacement"/"treat your" (its DOSING patterns require a
// leading digit; its only lexical rule is "diagnos").
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
  /emergency care replacement/i,
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
  "An emergency care replacement in your pocket.",
];

// ---- heading-level slicing helpers -------------------------------------

/** Matches a markdown heading of exactly 2 or 3 `#` (never 4+, so `#### Mitigation plan` is never treated as a section boundary). */
const LEVEL_2_OR_3_HEADING = /^#{2,3}(?!#)\s/;
/** Matches a markdown heading of exactly 2 `#` only (a top-level `## N. Title` section start). */
const LEVEL_2_HEADING = /^##(?!#)\s/;

function sliceSection(source: string, startLineTest: RegExp, boundaryTest: RegExp): string {
  const lines = source.split("\n");
  const startIndex = lines.findIndex((line) => startLineTest.test(line));
  if (startIndex === -1) return "";
  let endIndex = lines.length;
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    if (boundaryTest.test(lines[i]!)) {
      endIndex = i;
      break;
    }
  }
  return lines.slice(startIndex, endIndex).join("\n");
}

function extractBlock(source: string, field: string): string {
  const startMarker = `<!-- listing:${field}:start -->`;
  const endMarker = `<!-- listing:${field}:end -->`;
  const startIndex = source.indexOf(startMarker);
  const endIndex = source.indexOf(endMarker);
  if (startIndex === -1 || endIndex === -1) return "";
  return source.slice(startIndex + startMarker.length, endIndex).trim();
}

const section3 = sliceSection(doc, /^## 3\. /, LEVEL_2_HEADING);
const section4 = sliceSection(doc, /^## 4\. /, LEVEL_2_HEADING);
const section6 = sliceSection(doc, /^## 6\. /, LEVEL_2_HEADING);
const r1 = sliceSection(doc, /^### R1 —/, LEVEL_2_OR_3_HEADING);
const r2 = sliceSection(doc, /^### R2 —/, LEVEL_2_OR_3_HEADING);
const r3 = sliceSection(doc, /^### R3 —/, LEVEL_2_OR_3_HEADING);

interface Block {
  readonly path: string;
  readonly value: string;
}

const BLOCKS: Block[] = [
  { path: "listing.title", value: extractBlock(doc, "title") },
  { path: "listing.subtitle", value: extractBlock(doc, "subtitle") },
  { path: "listing.keywords", value: extractBlock(doc, "keywords") },
  { path: "listing.short-description", value: extractBlock(doc, "short-description") },
  { path: "listing.long-description", value: extractBlock(doc, "long-description") },
];

const title = extractBlock(doc, "title");
const subtitle = extractBlock(doc, "subtitle");
const keywords = extractBlock(doc, "keywords");
const shortDescription = extractBlock(doc, "short-description");
const longDescription = extractBlock(doc, "long-description");

const NOT_VERIFIED_OR_BLOCKED = /NOT-VERIFIED|BLOCKED/;
const URL_PATTERN = /https?:\/\//;

/** Header/separator lines that are structural, not data, and are excluded from the per-row evidence check. */
const TABLE_STRUCTURAL_LINES = new Set<string>([
  "| Channel | Verdict | Source (URL) | UTC date |",
  "| Field | Limit used | Verified vs. assumed |",
  "| Field | Characters | Limit |",
]);

function isSeparatorRow(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function isTableDataRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return false;
  if (isSeparatorRow(trimmed)) return false;
  if (TABLE_STRUCTURAL_LINES.has(trimmed)) return false;
  return true;
}

describe("docs/store-listing.md (T102)", () => {
  it("has the seven required numbered sections and no secret-shaped value", () => {
    const requiredHeadingWords = [
      "Purpose",
      "Honesty",
      "Evidence",
      "Risk",
      "Listing",
      "C3",
      "Re-verification",
    ];
    for (const word of requiredHeadingWords) {
      const headingPattern = new RegExp(`^## \\d+\\. .*${word}`, "m");
      expect(headingPattern.test(doc)).toBe(true);
    }
    for (const pattern of SECRET_PATTERNS) {
      expect(pattern.test(doc)).toBe(false);
    }
  });

  it("has an evidence section for the primary name and at least four fallback candidates", () => {
    expect(section3.length).toBeGreaterThan(0);
    for (const name of ["Bombay Pet Company", "Nuzzo", "Snoutly", "Tailwise", "Pawnest"]) {
      expect(section3).toContain(name);
    }
    const candidateSubsectionCount = (section3.match(/^### /gm) ?? []).length;
    expect(candidateSubsectionCount).toBeGreaterThanOrEqual(5);
    for (const sourceName of ["Apple", "Google Play", "USPTO", "EUIPO", "India"]) {
      expect(section3).toContain(sourceName);
    }
    expect(section3).toContain("verified fallback");

    const dataRowCount = section3.split("\n").filter(isTableDataRow).length;
    expect(dataRowCount).toBeGreaterThanOrEqual(25); // non-vacuity floor
  });

  it("every evidence row carries a source URL or an explicit NOT-VERIFIED marker", () => {
    const dataRows = section3.split("\n").filter(isTableDataRow);
    expect(dataRows.length).toBeGreaterThanOrEqual(25); // guarantees the loop body below actually runs
    let sawUrlRow = false;
    let sawMarkerRow = false;
    for (const row of dataRows) {
      const hasUrl = URL_PATTERN.test(row);
      const hasMarker = NOT_VERIFIED_OR_BLOCKED.test(row);
      expect(hasUrl || hasMarker).toBe(true);
      if (hasUrl) sawUrlRow = true;
      if (hasMarker) sawMarkerRow = true;
    }
    expect(sawUrlRow).toBe(true);
    expect(sawMarkerRow).toBe(true);
  });

  it("states class 44 (veterinary services) is deliberately out of the filing intent", () => {
    expect(section3).toContain("class 44");
    expect(section3.toLowerCase()).toContain("veterinary services");
  });

  it("records exactly three risk assessments, each with an Apple and a Google Play verdict", () => {
    const r1HeadingCount = (section4.match(/^### R1 —/gm) ?? []).length;
    const r2HeadingCount = (section4.match(/^### R2 —/gm) ?? []).length;
    const r3HeadingCount = (section4.match(/^### R3 —/gm) ?? []).length;
    expect(r1HeadingCount).toBe(1);
    expect(r2HeadingCount).toBe(1);
    expect(r3HeadingCount).toBe(1);

    const appleVerdict = /^- Apple App Store: (GO|CONDITIONAL|NO-GO) — .+/m;
    const playVerdict = /^- Google Play: (GO|CONDITIONAL|NO-GO) — .+/m;

    for (const slice of [r1, r2, r3]) {
      expect(slice.length).toBeGreaterThan(0);
      expect(appleVerdict.test(slice)).toBe(true);
      expect(playVerdict.test(slice)).toBe(true);
    }

    expect(r1).toContain("Bombay");
    expect(r2).toContain("geographic");
    expect(/generic|descriptive/i.test(r3)).toBe(true);
  });

  it("records the two orchestrator-level substitutions for founder review", () => {
    expect(doc).toContain("Algeria");
    expect(doc).toContain("India IP");
    expect(/\+.{0,40}(moot|superseded)|(moot|superseded).{0,40}\+/is.test(doc)).toBe(true);
    expect(section6).toContain("S1");
    expect(section6).toContain("S2");
  });

  it("the geographic-name risk section contains an actionable mitigation plan", () => {
    expect(r2).toContain("#### Mitigation plan");
    const mitigationStart = r2.indexOf("#### Mitigation plan");
    const mitigationSlice = r2.slice(mitigationStart);
    const optionBulletCount = (mitigationSlice.match(/^\d+\. \*\*/gm) ?? []).length;
    expect(optionBulletCount).toBeGreaterThanOrEqual(4);
    for (const literal of [
      "APP_DISPLAY_NAME",
      "bombaypetcompany",
      "com.bombaypetcompany.app",
      "bombaypetcompany://",
      "Sentry release",
    ]) {
      expect(mitigationSlice).toContain(literal);
    }
    expect(r2).toContain("C3");
  });

  it("every listing copy block is clean under the real scanUnsafeText detector", () => {
    for (const block of BLOCKS) {
      expect(block.value.length).toBeGreaterThan(0);
    }
    const findings = BLOCKS.flatMap((block) => scanUnsafeText(block.value, block.path));
    expect(findings).toEqual([]);
  });

  it("no listing copy block contains affirmative-claim or medical-claim language", () => {
    for (const block of BLOCKS) {
      for (const pattern of CLAIMS_PATTERNS) {
        expect(pattern.test(block.value)).toBe(false);
      }
    }
  });

  it("positive controls: planted diagnosis/dosing/claim copy IS flagged", () => {
    expect(scanUnsafeText("This is a diagnosis of arthritis.").length).toBeGreaterThanOrEqual(1);
    expect(scanUnsafeText("Give 5mg twice daily.").length).toBeGreaterThanOrEqual(1);
    expect(
      scanUnsafeText("Give your dog ibuprofen for the pain.").length,
    ).toBeGreaterThanOrEqual(1);
    for (let index = 0; index < CLAIMS_PATTERNS.length; index += 1) {
      expect(CLAIMS_PATTERNS[index]!.test(CLAIMS_POSITIVE_CONTROLS[index]!)).toBe(true);
    }
  });

  it("listing copy respects the store character limits", () => {
    expect(title.length).toBeLessThanOrEqual(30);
    expect(subtitle.length).toBeLessThanOrEqual(30);
    expect(keywords.length).toBeLessThanOrEqual(100);
    expect(shortDescription.length).toBeLessThanOrEqual(80);
    expect(longDescription.length).toBeLessThanOrEqual(4000);
    expect(longDescription.length).toBeGreaterThan(400); // non-vacuity floor
    expect(title).toBe(APP_DISPLAY_NAME);
  });

  it("the subtitle states guidance, not a veterinarian", () => {
    expect(subtitle).toMatch(/guidance/i);
    expect(subtitle).toMatch(/not a vet\b|not a veterinarian\b/i);
  });

  it("the long description carries the frozen vet disclaimer byte-identically", () => {
    expect(longDescription).toContain(vetDisclaimerLine(APP_DISPLAY_NAME));
    expect(longDescription).toContain(
      "Bombay Pet Company offers general pet-care guidance, not veterinary care or treatment. Always consult a licensed veterinarian.",
    );
  });

  it("copy uses the locked display name and no banned literal", () => {
    for (const block of BLOCKS) {
      expect(block.value).not.toMatch(/pawsaathi/i);
      expect(block.value).not.toMatch(/made in india/i);
      expect(block.value).not.toMatch(/Paw Care Right/i);
      expect(block.value).not.toMatch(/\bdiagnos/i);
    }
    expect(title).toBe(APP_DISPLAY_NAME);
  });

  it("flags the final name and bundle id for C3 founder approval", () => {
    expect(section6.length).toBeGreaterThan(0);
    for (const literal of [
      "com.bombaypetcompany.app",
      "bombaypetcompany",
      "Bombay Pet Company",
      "C3",
    ]) {
      expect(section6).toContain(literal);
    }
    const founderLineCount = (section6.match(/^- \[ \] \*\*\[FOUNDER\]\*\*/gm) ?? []).length;
    expect(founderLineCount).toBeGreaterThanOrEqual(3);
    expect(notes).toContain("docs/store-listing.md");
  });

  it("states plainly that this is a preliminary, non-legal screen", () => {
    const section2 = sliceSection(doc, /^## 2\. /, LEVEL_2_HEADING);
    expect(section2.length).toBeGreaterThan(0);
    for (const literal of ["not legal advice", "preliminary", "point-in-time", "[FOUNDER]", "legal review"]) {
      expect(section2).toContain(literal);
    }
    const hasNotVerified = doc.includes("NOT-VERIFIED");
    const hasNoBlockedStatement = /no lookup was blocked/i.test(doc);
    expect(hasNotVerified || hasNoBlockedStatement).toBe(true);
  });
});
