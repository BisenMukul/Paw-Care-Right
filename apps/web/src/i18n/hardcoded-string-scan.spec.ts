/**
 * T110 AC1.8 — web static source scan, the same shape as
 * `apps/mobile/__tests__/hardcoded-string-scan.test.ts` (see that file's
 * header for the pattern-precision rationale), scoped to `apps/web/app/**`.
 */
import fs from "node:fs";
import path from "node:path";

const APP_DIR = path.join(__dirname, "..", "..", "app");

function collectTsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTsxFiles(full, acc);
    } else if (entry.name.endsWith(".tsx")) {
      acc.push(full);
    }
  }
  return acc;
}

const ALL_FILES = collectTsxFiles(APP_DIR);

/** `<Tag ...>TEXT</Tag>` where TEXT has >= 3 consecutive Unicode letters and no `{`/`}`. */
const JSX_TEXT_PATTERN = /<([A-Za-z][\w.]*)\b[^<>]*>([^<>{}]*\p{L}{3,}[^<>{}]*)<\/\1>/gu;

interface Finding {
  readonly file: string;
  readonly text: string;
}

function scanFile(absolutePath: string): Finding[] {
  const source = fs.readFileSync(absolutePath, "utf8");
  const relative = path.relative(path.join(__dirname, "..", ".."), absolutePath).replaceAll("\\", "/");
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

interface Exemption {
  readonly file: string;
  readonly text: string;
  readonly why: string;
}

const EXEMPTIONS: readonly Exemption[] = [];
const EXPECTED_EXEMPTION_COUNT = 0;

const ALLOWLISTED = new Set(EXEMPTIONS.map((exemption) => `${exemption.file}::${exemption.text}`));

describe("hardcoded-string-scan (web, AC1.8)", () => {
  it("visited a non-trivial number of files (non-vacuity)", () => {
    expect(ALL_FILES.length).toBeGreaterThan(5);
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
    const planted = "function X() { return <p>Give 5mg twice daily</p>; }";
    const re = new RegExp(JSX_TEXT_PATTERN);
    const match = re.exec(planted);
    expect(match?.[2]).toBe("Give 5mg twice daily");
  });

  it("the scanner does NOT flag interpolated text (expressions are excluded by design)", () => {
    const interpolated = "function X() { return <p>{greeting} Ana</p>; }";
    const re = new RegExp(JSX_TEXT_PATTERN);
    expect(re.exec(interpolated)).toBeNull();
  });
});
