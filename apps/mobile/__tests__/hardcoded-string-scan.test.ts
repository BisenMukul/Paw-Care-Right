/**
 * T110 AC1.5/AC1.6 — mobile static source scan (the "CI breadth check"
 * companion to the rendered `pseudo-locale-leak.test.tsx`). Mirrors
 * `disclaimer-placement-scan.test.ts`'s repo-local `node:fs`/`node:path`
 * source-scan pattern (this workspace has no `@types/node`; same JUSTIFIED
 * `require` idiom).
 *
 * Scope (plan §2.7): `apps/mobile/app/**` + `apps/mobile/src/components/**`.
 * Pattern precision note (honest limitation, like
 * `disclaimer-placement-scan.test.ts`'s header): this is a source-text
 * pattern match, not a full JSX/AST parse. It matches `<Tag ...>TEXT</Tag>`
 * pairs where `TEXT` contains no `{`/`}` (so any interpolated expression
 * anywhere in the text node excludes it -- deliberately conservative, since
 * a false NEGATIVE here is caught by the rendered leak test instead, while a
 * false POSITIVE would force an unwanted allowlist entry) and requires the
 * SAME tag name to close, which is what keeps ternaries/generics/comments
 * (all of which use bare `>`/`<`) from matching at all (verified empirically
 * against this repo: those produce zero matches with this pattern, versus
 * dozens of false positives from a naive `>...<` scan).
 *
 * T110 may not change any rendered copy to clear a finding (plan §8) --
 * every finding is either allowlisted with a reason or reported to the
 * founder (plan step 19: >25 findings means stop and narrow scope, never
 * bulk-allowlist).
 */
export {};

declare const __dirname: string;

interface NodeFs {
  readdirSync(path: string, options: { withFileTypes: true }): Array<{ name: string; isDirectory(): boolean }>;
  readFileSync(path: string, encoding: string): string;
}
interface NodePath {
  join(...parts: string[]): string;
  relative(from: string, to: string): string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: locally-typed require avoids adding @types/node (a new dep is out of scope) for this node-env source-scan test
const fs = require("node:fs") as NodeFs;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const nodePath = require("node:path") as NodePath;

const APP_DIR = nodePath.join(__dirname, "..", "app");
const COMPONENTS_DIR = nodePath.join(__dirname, "..", "src", "components");

function collectTsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "__snapshots__" || entry.name === "__tests__") {
      continue;
    }
    const full = nodePath.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTsxFiles(full, acc);
    } else if (entry.name.endsWith(".tsx")) {
      acc.push(full);
    }
  }
  return acc;
}

const ALL_FILES = [...collectTsxFiles(APP_DIR), ...collectTsxFiles(COMPONENTS_DIR)];

/** `<Tag ...>TEXT</Tag>` where TEXT has >= 3 consecutive Unicode letters and no `{`/`}`. */
const JSX_TEXT_PATTERN = /<([A-Za-z][\w.]*)\b[^<>]*>([^<>{}]*\p{L}{3,}[^<>{}]*)<\/\1>/gu;

interface Finding {
  readonly file: string;
  readonly text: string;
}

function scanFile(absolutePath: string): Finding[] {
  const source = fs.readFileSync(absolutePath, "utf8");
  const relative = nodePath.relative(nodePath.join(__dirname, ".."), absolutePath).replaceAll("\\", "/");
  const findings: Finding[] = [];
  const re = new RegExp(JSX_TEXT_PATTERN);
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const text = match[2]!.trim();
    if (!text || !/\p{L}{3,}/u.test(text)) continue;
    findings.push({ file: relative, text });
  }
  return findings;
}

const ALL_FINDINGS: Finding[] = ALL_FILES.flatMap(scanFile);

/**
 * Exact-match allowlist (T097 `EXEMPTIONS` shape): `{ file, text, why }`,
 * pinned count. Empty today -- the pattern above finds zero genuine JSX
 * text-literal leaves under `app/**`/`src/components/**` (every rendered
 * string in this codebase already flows through the `strings` tree).
 */
interface Exemption {
  readonly file: string;
  readonly text: string;
  readonly why: string;
}

const EXEMPTIONS: readonly Exemption[] = [];
const EXPECTED_EXEMPTION_COUNT = 0;

const ALLOWLISTED = new Set(EXEMPTIONS.map((exemption) => `${exemption.file}::${exemption.text}`));

describe("hardcoded-string-scan (mobile, AC1.5/AC1.6)", () => {
  it("visited a non-trivial number of files (non-vacuity)", () => {
    expect(ALL_FILES.length).toBeGreaterThan(50);
  });

  it("the allowlist is exact-match with a pinned count", () => {
    expect(EXEMPTIONS.length).toBe(EXPECTED_EXEMPTION_COUNT);
  });

  it("no JSX text literal outside the allowlist", () => {
    const unlisted = ALL_FINDINGS.filter(
      (finding) => !ALLOWLISTED.has(`${finding.file}::${finding.text}`),
    );
    expect(unlisted).toEqual([]);
  });

  it("the scanner catches a planted literal (positive control)", () => {
    const planted = 'function X() { return <Text>Give 5mg twice daily</Text>; }';
    const re = new RegExp(JSX_TEXT_PATTERN);
    const match = re.exec(planted);
    expect(match?.[2]).toBe("Give 5mg twice daily");
  });

  it("the scanner does NOT flag interpolated text (expressions are excluded by design)", () => {
    const interpolated = "function X() { return <Text>{greeting} Ana</Text>; }";
    const re = new RegExp(JSX_TEXT_PATTERN);
    expect(re.exec(interpolated)).toBeNull();
  });
});
