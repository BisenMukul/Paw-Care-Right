/**
 * T097 plan AC2 (mobile half) — static source scan pinning which screens
 * must render `<VetDisclaimer/>` (CLAUDE §7 rule 3). Mirrors
 * `a11y-static-scan.test.ts`'s repo-local `node:fs`/`node:path` source-scan
 * pattern (this workspace has no `@types/node`; see that file's header
 * comment and `no-pawsaathi-branding.test.ts` for the same justified
 * `require` pattern).
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

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "__snapshots__" || entry.name === "__tests__") {
      continue;
    }
    const full = nodePath.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (entry.name.endsWith(".tsx")) {
      acc.push(full);
    }
  }
  return acc;
}

const ALL_APP_TSX_FILES = collectSourceFiles(APP_DIR);

// Pinned inventory (T097 plan step 10) — every `app/**/*.tsx` screen that
// today imports AND renders the shared `<VetDisclaimer/>`. Growing or
// shrinking this list requires editing this file, which the checker will
// see: a placement can never silently disappear or drift.
const REQUIRED_DISCLAIMER_SCREENS = [
  "app/check/result/[checkId].tsx",
  "app/chat/index.tsx",
  "app/breeds/[species]/[slug].tsx",
].map((relative) => nodePath.join(__dirname, "..", relative));

const IMPORT_PATTERN = /import\s*\{[^}]*\bVetDisclaimer\b[^}]*\}\s*from\s*["'][^"']*vet-disclaimer["']/;
// Requires at least one whitespace char before the closing `/>` -- every
// real JSX call site in this codebase is written `<VetDisclaimer />` (with
// a space), while every prose mention explaining WHY a screen does NOT
// render it is written `` `<VetDisclaimer/>` `` (no space, backtick-quoted),
// e.g. `app/services/index.tsx`'s "guidance surface, so no
// `<VetDisclaimer/>`." This distinguishes a real render from a comment
// mention without needing a full JSX/AST parser.
const JSX_RENDER_PATTERN = /<VetDisclaimer\s+\/>/;

describe("disclaimer-placement-scan: pinned inventory of screens that render <VetDisclaimer/>", () => {
  it("visited a non-trivial number of app/**/*.tsx files (non-vacuity)", () => {
    expect(ALL_APP_TSX_FILES.length).toBeGreaterThan(20);
  });

  it("every pinned required screen both imports and renders <VetDisclaimer/>", () => {
    for (const file of REQUIRED_DISCLAIMER_SCREENS) {
      const source = fs.readFileSync(file, "utf8");
      expect(IMPORT_PATTERN.test(source)).toBe(true);
      expect(JSX_RENDER_PATTERN.test(source)).toBe(true);
    }
  });

  it("no screen outside the pinned list renders <VetDisclaimer/> (the rendering set equals exactly the pinned list)", () => {
    const renderingFiles = ALL_APP_TSX_FILES.filter((file) => JSX_RENDER_PATTERN.test(fs.readFileSync(file, "utf8")));
    const normalize = (file: string): string => file.replaceAll("\\", "/");
    expect(new Set(renderingFiles.map(normalize))).toEqual(
      new Set(REQUIRED_DISCLAIMER_SCREENS.map(normalize)),
    );
  });

  it("the JSX-render pattern genuinely matches a planted usage and does not match a mere comment mention (non-vacuity proof)", () => {
    expect(JSX_RENDER_PATTERN.test("        <VetDisclaimer />\n")).toBe(true);
    expect(JSX_RENDER_PATTERN.test("// this screen never renders `<VetDisclaimer/>`-style output")).toBe(false);
    expect(JSX_RENDER_PATTERN.test("no `<VetDisclaimer/>`/emergency surface")).toBe(false);
  });
});
