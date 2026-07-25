import { strings } from "../src/strings";

/**
 * T087 plan safety statement 4/5 — the two structural guards for this task:
 * (1) a source scan proving no app file imports the draft-inclusive
 * `allBreedGuides` export (mirrors T084's hand-off, `loop/plans/T084.plan.md`
 * R3), and (2) a tone scan over the new `strings.breedGuide` +
 * `strings.settings.breedGuides` copy (mirrors `chat-strings-tone.test.ts`).
 *
 * This workspace has no `@types/node` (see `no-pawsaathi-branding.test.ts`'s
 * header comment), so `node:fs`/`node:path` can't be `import`ed by name --
 * the Metro/Expo ambient `require` resolves them fine at Jest's real-Node
 * runtime (mirrors `dual-theme-contrast.test.ts`). `__dirname` is likewise a
 * real per-module CJS free variable with no ambient type here; declaring it
 * locally is a one-line, fully-typed fix, not an `any` escape hatch.
 */
declare const __dirname: string;

interface NodeFs {
  readdirSync(path: string, options: { withFileTypes: true }): Array<{ name: string; isDirectory(): boolean }>;
  readFileSync(path: string, encoding: string): string;
}
interface NodePath {
  join(...parts: string[]): string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: locally-typed require avoids adding @types/node (a new dep is out of scope) for this node-env source-scan test
const fs = require("node:fs") as NodeFs;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const nodePath = require("node:path") as NodePath;

const SRC_DIR = nodePath.join(__dirname, "..", "src");
const APP_DIR = nodePath.join(__dirname, "..", "app");
const SCANNABLE_EXTENSION_PATTERN = /\.(ts|tsx)$/;

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "__snapshots__") {
      continue;
    }
    const full = nodePath.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (SCANNABLE_EXTENSION_PATTERN.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

const ALL_BREED_GUIDES_PATTERN = /allBreedGuides/;

describe("breed-guide-safety: source scan bans allBreedGuides in app code", () => {
  const files = [...collectSourceFiles(SRC_DIR), ...collectSourceFiles(APP_DIR)];

  it("visited a non-trivial number of files (non-vacuity: the scan is not empty)", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no file under apps/mobile/src or apps/mobile/app imports or references allBreedGuides", () => {
    const offenders = files.filter((file) => ALL_BREED_GUIDES_PATTERN.test(fs.readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the regex genuinely matches a planted violating literal (non-vacuity proof)", () => {
    const plantedLine = 'import { allBreedGuides } from "@pawcareright/data";';
    expect(ALL_BREED_GUIDES_PATTERN.test(plantedLine)).toBe(true);
  });
});

type StringLeaf = string;

function flattenLeaves(node: unknown): StringLeaf[] {
  if (typeof node === "string") {
    return [node];
  }
  if (typeof node === "function") {
    const fn = node as (...args: string[]) => string;
    const sampleArgs = Array.from({ length: fn.length }, (_, i) => `sample-${i}`);
    return [fn(...sampleArgs)];
  }
  if (node !== null && typeof node === "object") {
    return Object.values(node as Record<string, unknown>).flatMap(flattenLeaves);
  }
  return [];
}

const BREED_GUIDE_STRINGS: StringLeaf[] = [
  ...flattenLeaves(strings.breedGuide),
  ...flattenLeaves(strings.settings.breedGuides),
];

const DIAGNOSIS_WORD_PATTERN = /diagnos/i;
const DOSING_PATTERN =
  /(\bmg\b|\bml\b|\bdose|dosage|milligram|per kg|administer|tablet|ibuprofen|paracetamol|acetaminophen|aspirin|benadryl|diphenhydramine|metacam|tramadol)/i;
const OUTCOME_HEALTH_CLAIM_PATTERN = /(healthy|healthier|cure|\btreat|improve|\bbetter\b|prevent)/i;
const STREAK_PRESSURE_PATTERN = /(streak|don'?t break|in a row|\d+\s*days?\s*straight|keep it going|chain)/i;
const CURRENCY_PATTERN = /[₹$€£]/;
const YEAR_LITERAL_PATTERN = /\b(19|20)\d\d\b/;

describe("breed-guide-safety: tone scan over strings.breedGuide", () => {
  it("collected a non-empty set of leaves (non-vacuous scan)", () => {
    expect(BREED_GUIDE_STRINGS.length).toBeGreaterThan(0);
  });

  it("contains no diagnosis/diagnose language", () => {
    for (const value of BREED_GUIDE_STRINGS) {
      expect(DIAGNOSIS_WORD_PATTERN.test(value)).toBe(false);
    }
  });

  it("contains no medication name/dosing/administration language", () => {
    for (const value of BREED_GUIDE_STRINGS) {
      expect(DOSING_PATTERN.test(value)).toBe(false);
    }
  });

  it("contains no outcome/health-claim language", () => {
    for (const value of BREED_GUIDE_STRINGS) {
      expect(OUTCOME_HEALTH_CLAIM_PATTERN.test(value)).toBe(false);
    }
  });

  it("contains no streak/pressure framing", () => {
    for (const value of BREED_GUIDE_STRINGS) {
      expect(STREAK_PRESSURE_PATTERN.test(value)).toBe(false);
    }
  });

  it("contains no currency symbol or bare year literal", () => {
    for (const value of BREED_GUIDE_STRINGS) {
      expect(CURRENCY_PATTERN.test(value)).toBe(false);
      expect(YEAR_LITERAL_PATTERN.test(value)).toBe(false);
    }
  });

  // Non-vacuity proof: each pattern must actually catch planted violating
  // copy, not just pass because nothing in BREED_GUIDE_STRINGS happens to match.
  it("the tone patterns catch planted violating copy (non-vacuity proof)", () => {
    expect(DIAGNOSIS_WORD_PATTERN.test("Here is your diagnosis")).toBe(true);
    expect(DOSING_PATTERN.test("Give 5mg of ibuprofen")).toBe(true);
    expect(OUTCOME_HEALTH_CLAIM_PATTERN.test("This will cure your pet and prevent illness")).toBe(true);
    expect(STREAK_PRESSURE_PATTERN.test("Don't break your streak!")).toBe(true);
    expect(CURRENCY_PATTERN.test("$5 per visit")).toBe(true);
    expect(YEAR_LITERAL_PATTERN.test("Reviewed in 2026")).toBe(true);
  });
});
