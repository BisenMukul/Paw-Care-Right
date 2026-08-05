/**
 * Drift guard for `docs/qa/state-audit.md` (T094 plan step 1, AC1; R1).
 * The single biggest failure mode of an audit card is a checklist of green
 * ticks nobody can verify -- these three tests exist precisely so a
 * fabricated tick, a missing screen row, or a phantom row fails CI.
 *
 * This workspace has no `@types/node` (see `a11y-static-scan.test.ts`'s
 * header comment), so `node:fs`/`node:path` can't be `import`ed by name --
 * the Metro/Expo ambient `require` resolves them fine at Jest's real-Node
 * runtime. `__dirname` is likewise a real per-module CJS free variable with
 * no ambient type here. The empty `export {}` below keeps this file an
 * isolated module (it otherwise has no top-level import/export), so its own
 * `declare const __dirname` cannot collide with another test file's.
 */
export {};

declare const __dirname: string;

interface DirEntry {
  name: string;
  isDirectory(): boolean;
  isFile(): boolean;
}
interface NodeFs {
  readFileSync(path: string, encoding: string): string;
  readdirSync(path: string, options: { withFileTypes: true }): DirEntry[];
}
interface NodePath {
  join(...parts: string[]): string;
  relative(from: string, to: string): string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: locally-typed require avoids adding @types/node (a new dep is out of scope), mirrors a11y-static-scan.test.ts
const fs = require("node:fs") as NodeFs;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const path = require("node:path") as NodePath;

const APP_ROOT = path.join(__dirname, "..", "app");
const TESTS_ROOT = path.join(__dirname);
const DOC_PATH = path.join(__dirname, "..", "..", "..", "docs", "qa", "state-audit.md");

function listScreenFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listScreenFiles(full, base));
    } else if (entry.isFile() && entry.name.endsWith(".tsx") && entry.name !== "_layout.tsx") {
      out.push(path.relative(base, full));
    }
  }
  return out;
}

interface AuditRow {
  screen: string;
  cells: [string, string, string, string]; // loading, error, empty, offline
}

function readSection(markdown: string, startHeading: string, endHeading: string): string {
  const start = markdown.indexOf(startHeading);
  const end = markdown.indexOf(endHeading);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`could not locate section ${startHeading}..${endHeading} in state-audit.md`);
  }
  return markdown.slice(start, end);
}

function isSeparatorRow(line: string): boolean {
  const stripped = line.replace(/\|/g, "").trim();
  return stripped.length > 0 && /^[\s-]+$/.test(stripped);
}

function parseAuditRows(section: string): AuditRow[] {
  const rows: AuditRow[] = [];
  for (const rawLine of section.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("|") || isSeparatorRow(line)) {
      continue;
    }
    const cells = line
      .slice(1, line.endsWith("|") ? -1 : undefined)
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length !== 5 || cells[0] === "Screen") {
      continue;
    }
    const nameMatch = /^`([^`]+)`/.exec(cells[0]!);
    if (nameMatch === null) {
      continue;
    }
    rows.push({ screen: nameMatch[1]!, cells: [cells[1]!, cells[2]!, cells[3]!, cells[4]!] });
  }
  return rows;
}

function extractQuotedTitles(cell: string): string[] {
  const titles: string[] = [];
  const pattern = /"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(cell)) !== null) {
    titles.push(match[1]!);
  }
  return titles;
}

function isValidCellShape(cell: string): boolean {
  if (cell.length === 0) {
    return false;
  }
  if (cell.startsWith("N/A")) {
    return true;
  }
  if (cell.startsWith("GAP")) {
    return true;
  }
  // A citation cell must contain at least one quoted test title.
  return extractQuotedTitles(cell).length > 0;
}

/** Recursively greps every file under `apps/mobile/__tests__` for a literal (non-regex) substring. */
function existsVerbatimInTests(literal: string): boolean {
  const files = fs.readdirSync(TESTS_ROOT, { withFileTypes: true }).filter((e) => e.isFile());
  for (const file of files) {
    const content = fs.readFileSync(path.join(TESTS_ROOT, file.name), "utf8");
    if (content.includes(literal)) {
      return true;
    }
  }
  return false;
}

describe("docs/qa/state-audit.md", () => {
  const markdown = fs.readFileSync(DOC_PATH, "utf8");
  const section2 = readSection(markdown, "## §2", "## §3");
  const auditRows = parseAuditRows(section2);
  const realScreens = listScreenFiles(APP_ROOT).sort();

  it("every screen under apps/mobile/app has exactly one row in docs/qa/state-audit.md", () => {
    expect(auditRows.length).toBeGreaterThanOrEqual(45); // non-vacuity floor
    const documented = new Set(auditRows.map((row) => row.screen));
    const real = new Set(realScreens);

    const missingFromDoc = realScreens.filter((screen) => !documented.has(screen));
    const phantomInDoc = auditRows.map((row) => row.screen).filter((screen) => !real.has(screen));

    expect(missingFromDoc).toEqual([]);
    expect(phantomInDoc).toEqual([]);
    expect(documented.size).toBe(auditRows.length); // no duplicate screen rows
  });

  it("every state cell is a real test title, an N/A with a reason, or an explicit GAP", () => {
    for (const row of auditRows) {
      for (const cell of row.cells) {
        expect(isValidCellShape(cell)).toBe(true);
      }
      expect(row.cells.every((cell) => cell === "yes" || cell === "✓" || cell === "-")).toBe(false);
    }
  });

  it("every test title cited by the audit exists verbatim in apps/mobile/__tests__", () => {
    const citedTitles = new Set<string>();
    for (const row of auditRows) {
      for (const cell of row.cells) {
        for (const title of extractQuotedTitles(cell)) {
          citedTitles.add(title);
        }
      }
    }

    expect(citedTitles.size).toBeGreaterThanOrEqual(20); // non-vacuity floor

    const fabricated = [...citedTitles].filter((title) => !existsVerbatimInTests(title));
    expect(fabricated).toEqual([]);
  });
});
