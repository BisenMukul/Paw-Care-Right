/**
 * T112 (final Phase 11 card): drift/honesty guard for `docs/BACKLOG.md`.
 * House idiom copied verbatim from `release-runbook-doc.test.ts` (T099) and
 * `store-listing-doc.test.ts` (T102): lone `export {}`, `declare const
 * __dirname`, locally-typed `require("node:fs")`/`require("node:path")` (no
 * `@types/node` in this workspace), `sliceSection`/`LEVEL_2_HEADING`,
 * row-parsing via lead-cell/split-on-`|` extraction, `SECRET_PATTERNS`, and
 * the real `scanUnsafeText` detector imported from `@bombaypetcompany/ai`
 * (already a mobile dependency — no new dep, never re-implemented, never
 * loosened).
 */
export {};

import { scanUnsafeText } from "@bombaypetcompany/ai";

declare const __dirname: string;

interface NodeFs {
  readFileSync(path: string, encoding: string): string;
}
interface NodePath {
  join(...parts: string[]): string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: locally-typed require avoids adding @types/node (a new dep is out of scope), mirrors release-runbook-doc.test.ts / store-listing-doc.test.ts
const fs = require("node:fs") as NodeFs;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const path = require("node:path") as NodePath;

const DOC_PATH = path.join(__dirname, "..", "..", "..", "docs", "BACKLOG.md");
const SPEC_PATH = path.join(__dirname, "..", "..", "..", "docs", "PRODUCT_SPEC.md");

const doc = fs.readFileSync(DOC_PATH, "utf8");
const spec = fs.readFileSync(SPEC_PATH, "utf8");

const SECRET_PATTERNS: RegExp[] = [
  /AKIA[0-9A-Z]{16}/,
  new RegExp("\\bsk-" + "[A-Za-z0-9_-]{20,}"),
  new RegExp("AIza" + "[0-9A-Za-z_-]{35}"),
  /-----BEGIN/,
  new RegExp("eyJ" + "[A-Za-z0-9_-]{10,}\\."),
];

// ---- heading-level slicing helper (T099/T102 house idiom, verbatim) -----
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

const section1 = sliceSection(doc, /^## 1\. /, LEVEL_2_HEADING);
const section3 = sliceSection(doc, /^## 3\. /, LEVEL_2_HEADING);
const section4 = sliceSection(doc, /^## 4\. /, LEVEL_2_HEADING);
const section5 = sliceSection(doc, /^## 5\. /, LEVEL_2_HEADING);
const section6 = sliceSection(doc, /^## 6\. /, LEVEL_2_HEADING);

// ---- §3 row parsing (plan §4 "Parse helper") -----------------------------

interface BacklogRow {
  id: string;
  title: string;
  category: string;
  source: string;
  i: number;
  c: number;
  e: number;
  ice: number;
  notes: string;
}

const TABLE_HEADER = "| ID | Title | Category | Source | I | C | E | ICE | Notes |";

function isSeparatorRow(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function parseBacklogRows(section: string): BacklogRow[] {
  const rows: BacklogRow[] = [];
  for (const rawLine of section.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("|") || !line.endsWith("|")) continue;
    if (line === TABLE_HEADER) continue;
    if (isSeparatorRow(line)) continue;
    // Strip the leading/trailing pipe, then split on the remaining pipes.
    const cells = line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length !== 9) continue;
    const [id, title, category, source, iRaw, cRaw, eRaw, iceRaw, notes] = cells as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    rows.push({
      id,
      title,
      category,
      source,
      i: Number(iRaw),
      c: Number(cRaw),
      e: Number(eRaw),
      ice: Number(iceRaw),
      notes,
    });
  }
  return rows;
}

const backlogRows = parseBacklogRows(section3);

// ---- §10 PRODUCT_SPEC deferral phrase parsing (T-06) ---------------------

function parseSpecDeferralPhrases(specDoc: string): string[] {
  const start = specDoc.indexOf("## 10. Out of scope for v1");
  if (start === -1) return [];
  const nextHeadingIndex = specDoc.indexOf("\n## ", start + 1);
  const end = nextHeadingIndex === -1 ? specDoc.length : nextHeadingIndex;
  const section = specDoc.slice(start, end);
  // The deferral line is the first non-empty, non-heading line in the section.
  const line = section
    .split("\n")
    .find((candidate) => candidate.trim().length > 0 && !candidate.trim().startsWith("#"));
  if (!line) return [];
  return line
    .split("·") // "·"
    .map((fragment) =>
      fragment
        .replace(/\([^)]*\)/g, "")
        .trim()
        .replace(/\.$/, "")
        .toLowerCase(),
    )
    .filter((fragment) => fragment.length > 0);
}

const specDeferralPhrases = parseSpecDeferralPhrases(spec);

// ---- Invented user/metrics-attribution scan (T-13/T-14) ------------------

const INVENTED_METRICS_PATTERNS: readonly RegExp[] = [
  /users? (reported|requested|complained|asked for)/i,
  /\d+(\.\d+)?\s*%\s*of\s*(users|owners|testers|beta)/i,
  /(beta feedback|metrics|analytics|telemetry)\s+(show|shows|showed|indicate|indicates|suggest|suggests)/i,
  /according to (the )?beta/i,
];

const INVENTED_METRICS_POSITIVE_CONTROLS: readonly string[] = [
  "Users reported this was confusing.",
  "42% of users asked for a vet chat.",
  "Beta feedback shows this is the top request.",
  "According to the beta, retention improved.",
];

describe("docs/BACKLOG.md (T112)", () => {
  it("T-01: exists and has sections 1-7 with the required heading words", () => {
    const requiredHeadingWords = [
      "Honesty",
      "rubric",
      "backlog",
      "Founder",
      "next two phases",
      "Safety",
      "Re-scor",
    ];
    for (const word of requiredHeadingWords) {
      const headingPattern = new RegExp(`^## \\d+\\. .*${word}`, "im");
      expect(headingPattern.test(doc)).toBe(true);
    }
  });

  it("T-02: the scored table has at least 15 rows (>= 30 regression floor)", () => {
    expect(backlogRows.length).toBeGreaterThanOrEqual(15);
    expect(backlogRows.length).toBeGreaterThanOrEqual(30);
  });

  it("T-03: every row has a unique ID matching B-nn or P-nn", () => {
    expect(backlogRows.length).toBeGreaterThan(0);
    const idPattern = /^(B|P)-\d{2}$/;
    for (const row of backlogRows) {
      expect(idPattern.test(row.id)).toBe(true);
    }
    const ids = backlogRows.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("T-04: every I/C/E is an integer 1-10 and ICE === I*C*E", () => {
    expect(backlogRows.length).toBeGreaterThan(0);
    for (const row of backlogRows) {
      for (const value of [row.i, row.c, row.e]) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
      }
      expect(row.ice).toBe(row.i * row.c * row.e);
    }
  });

  it("T-05: the table is sorted by ICE descending, ties by ID ascending", () => {
    expect(backlogRows.length).toBeGreaterThan(0);
    const expected = [...backlogRows].sort((a, b) => {
      if (b.ice !== a.ice) return b.ice - a.ice;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    expect(backlogRows.map((row) => row.id)).toEqual(expected.map((row) => row.id));
  });

  it("T-06: every PRODUCT_SPEC §10 deferral appears as a scored row", () => {
    expect(specDeferralPhrases.length).toBeGreaterThanOrEqual(8); // non-vacuity floor
    const lowerSection3 = section3.toLowerCase();
    for (const phrase of specDeferralPhrases) {
      expect(lowerSection3).toContain(phrase);
    }
    const pRowCount = backlogRows.filter((row) => row.id.startsWith("P-")).length;
    expect(pRowCount).toBeGreaterThanOrEqual(10);
  });

  it("T-07: every Source cell cites a real artifact (>= 15 cite loop/journal.md)", () => {
    expect(backlogRows.length).toBeGreaterThan(0);
    const sourcePatterns = [
      /loop\/journal\.md:\d+/,
      /loop\/(reviews|plans)\/T\d+\.(review|plan)\.md/,
      /docs\/[\w./-]+\.md/,
    ];
    let journalCiteCount = 0;
    for (const row of backlogRows) {
      const matchesAny = sourcePatterns.some((pattern) => pattern.test(row.source));
      expect(matchesAny).toBe(true);
      if (/loop\/journal\.md:\d+/.test(row.source)) journalCiteCount += 1;
    }
    expect(journalCiteCount).toBeGreaterThanOrEqual(15);
  });

  it("T-08: product-deferral rows score Confidence <= 5 (Rule C)", () => {
    const productRows = backlogRows.filter((row) => row.id.startsWith("P-"));
    expect(productRows.length).toBeGreaterThan(0);
    for (const row of productRows) {
      expect(row.c).toBeLessThanOrEqual(5);
    }
  });

  it("T-09: the founder section carries no scored rows", () => {
    expect(section4.length).toBeGreaterThan(0);
    const scoredRowPattern = /^\|\s*(B|P)-\d/m;
    expect(scoredRowPattern.test(section4)).toBe(false);
  });

  it("T-10: the founder section lists the vet queues, the open decisions and the ops queue", () => {
    for (const literal of [
      "[VET]",
      "docs/release-runbook.md",
      "loop/checkpoint-C3-notes.md",
      "UNVERIFIED",
      "trademark",
    ]) {
      expect(section4).toContain(literal);
    }
  });

  it("T-11: the whole document is clean under the real scanUnsafeText detector", () => {
    expect(scanUnsafeText(doc, "docs/BACKLOG.md")).toEqual([]);
  });

  it("T-12: the detector scan is non-vacuous (positive controls)", () => {
    expect(scanUnsafeText(`${doc}\nGive your dog 5mg of ibuprofen.`, "docs/BACKLOG.md").length).toBeGreaterThan(
      0,
    );
    expect(scanUnsafeText(`${doc}\nThis is a diagnosis.`, "docs/BACKLOG.md").length).toBeGreaterThan(0);
  });

  it("T-13: no invented user feedback or metrics claims", () => {
    for (const pattern of INVENTED_METRICS_PATTERNS) {
      expect(pattern.test(doc)).toBe(false);
    }
  });

  it("T-14: the invented-metrics scan is non-vacuous (positive controls)", () => {
    expect(INVENTED_METRICS_PATTERNS.length).toBe(INVENTED_METRICS_POSITIVE_CONTROLS.length);
    for (let index = 0; index < INVENTED_METRICS_PATTERNS.length; index += 1) {
      expect(INVENTED_METRICS_PATTERNS[index]!.test(INVENTED_METRICS_POSITIVE_CONTROLS[index]!)).toBe(true);
    }
  });

  it("T-15: §1 states the beta-feedback and metrics inputs are empty", () => {
    expect(section1.length).toBeGreaterThan(0);
    expect(section1).toContain("PostHog");
    expect(section1).toContain("FeedbackReport");
    expect(/no (user )?feedback/i.test(section1)).toBe(true);
    expect(/no (product )?metrics/i.test(section1)).toBe(true);
  });

  it("T-16: §5 is marked draft and not committed, and references only real IDs", () => {
    expect(section5.length).toBeGreaterThan(0);
    for (const literal of ["DRAFT", "for founder review", "not committed", "docs/PHASES.md"]) {
      expect(section5).toContain(literal);
    }
    const draftPhaseHeadingCount = (section5.match(/^### Draft Phase/gm) ?? []).length;
    expect(draftPhaseHeadingCount).toBe(2);

    const idSet = new Set(backlogRows.map((row) => row.id));
    const referencedIds = Array.from(new Set(section5.match(/\b(B|P)-\d{2}\b/g) ?? []));
    expect(referencedIds.length).toBeGreaterThanOrEqual(6);
    for (const id of referencedIds) {
      expect(idSet.has(id)).toBe(true);
    }
  });

  it("T-17: §6 names all four safety surfaces", () => {
    expect(section6.length).toBeGreaterThan(0);
    expect(section6).toContain("<VetDisclaimer/>");
    expect(/Emergency interstitial/i.test(section6)).toBe(true);
    expect(/hotline/i.test(section6)).toBe(true);
    expect(/fail[- ]upward/i.test(section6)).toBe(true);
    expect(/dosing/i.test(section6)).toBe(true);
  });

  it("T-18: no backlog row proposes weakening a safety surface", () => {
    expect(backlogRows.length).toBeGreaterThan(0);
    const weakeningPattern = /(remove|drop|dismiss|disable|hide|bypass|soften)[^|]*(disclaimer|emergency|interstitial|hotline)/i;
    for (const row of backlogRows) {
      expect(weakeningPattern.test(row.title)).toBe(false);
    }
  });

  it("T-19: the document contains no secret-shaped value", () => {
    for (const pattern of SECRET_PATTERNS) {
      expect(pattern.test(doc)).toBe(false);
    }
  });
});
