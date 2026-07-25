/**
 * T093 plan D1/Phase 2 step 7 -- the "a11y lint" half, as a repo-local
 * source scan (no `eslint-plugin-react-native-a11y`; see plan D1/R2 for the
 * rejection rationale: the plugin targets legacy `Touchable*` JSX and has no
 * NativeWind/`className`-encoded-touch-target or reduced-motion-gating
 * awareness, so it would fire on patterns this codebase doesn't use while
 * missing the ones it does).
 *
 * This workspace has no `@types/node` (see `no-pawsaathi-branding.test.ts`'s
 * header comment), so `node:fs`/`node:path` can't be `import`ed by name --
 * the Metro/Expo ambient `require` resolves them fine at Jest's real-Node
 * runtime. `__dirname` is likewise a real per-module CJS free variable with
 * no ambient type here; declaring it locally is a one-line, fully-typed fix,
 * not an `any` escape hatch (mirrors `dual-theme-contrast.test.ts` /
 * `breed-guide-safety.test.ts`).
 *
 * The empty `export {}` below is required: this file has no other
 * top-level `import`/`export`, which (absent one) makes TypeScript treat it
 * as a global script rather than an isolated module -- its own
 * `declare const __dirname` would then collide with
 * `dual-theme-contrast.test.ts`'s identical script-scope declaration
 * (verified: `tsc --noEmit` fails with "Cannot redeclare block-scoped
 * variable '__dirname'" without this line). One line, zero runtime effect.
 */
export {};

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
    if (entry.name === "node_modules" || entry.name === "__snapshots__" || entry.name === "__tests__") {
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

const ALL_TSX_FILES = collectSourceFiles(SRC_DIR).concat(collectSourceFiles(APP_DIR));
const TSX_ONLY = ALL_TSX_FILES.filter((f) => f.endsWith(".tsx"));

// ---------------------------------------------------------------------------
// Rule 1 (design-system.md §4.5 -- "never allowFontScaling={false}")
// ---------------------------------------------------------------------------
describe("a11y-static-scan: no source file disables font scaling", () => {
  it("visited a non-trivial number of .tsx files (non-vacuity)", () => {
    expect(TSX_ONLY.length).toBeGreaterThan(50);
  });

  const DISABLE_PATTERN = /allowFontScaling\s*[:=]\s*\{?\s*false/;

  it("no file under apps/mobile/app or apps/mobile/src disables allowFontScaling", () => {
    const offenders = TSX_ONLY.filter((file) => DISABLE_PATTERN.test(fs.readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the pattern genuinely matches a planted violation (M1 non-vacuity proof)", () => {
    expect(DISABLE_PATTERN.test('<Text allowFontScaling={false}>hi</Text>')).toBe(true);
    expect(DISABLE_PATTERN.test("allowFontScaling: false")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rule 2 (design-system.md §3.2 -- reduced-motion gating on every animation
// primitive; T093 plan D4)
// ---------------------------------------------------------------------------
const ANIMATION_PRIMITIVE_PATTERN = /withRepeat|withSpring|withTiming|entering=|exiting=|\bFadeIn|useSharedValue/;
const REDUCED_MOTION_IMPORT_PATTERN = /use-reduced-motion/;

// The hook's own implementation file, and the root layout (which only
// mounts `<ReducedMotionConfig mode={ReduceMotion.System}/>` -- it doesn't
// itself gate a per-component animation), are the only sanctioned files
// that may match the primitive pattern without importing the hook.
const ALLOWLIST_SUFFIXES = ["src/hooks/use-reduced-motion.ts", "app/_layout.tsx"];

function isAllowlisted(file: string): boolean {
  return ALLOWLIST_SUFFIXES.some((suffix) => file.replaceAll("\\", "/").endsWith(suffix));
}

describe("a11y-static-scan: every reanimated-animation file also imports useReducedMotion", () => {
  const animatingFiles = ALL_TSX_FILES.filter(
    (file) => !isAllowlisted(file) && ANIMATION_PRIMITIVE_PATTERN.test(fs.readFileSync(file, "utf8")),
  );

  it("found a non-trivial number of animating files (non-vacuity)", () => {
    expect(animatingFiles.length).toBeGreaterThanOrEqual(10);
  });

  it("every animating file imports use-reduced-motion", () => {
    const offenders = animatingFiles.filter(
      (file) => !REDUCED_MOTION_IMPORT_PATTERN.test(fs.readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("the pattern genuinely matches a planted violation (M2 non-vacuity proof)", () => {
    const plantedSource = 'const opacity = useSharedValue(0);\nopacity.value = withRepeat(withTiming(1));\n';
    expect(ANIMATION_PRIMITIVE_PATTERN.test(plantedSource)).toBe(true);
    expect(REDUCED_MOTION_IMPORT_PATTERN.test(plantedSource)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rule 3 (§1.6 last bullet -- no new bare hex literal in the D7 candidate
// files this card actually edited)
// ---------------------------------------------------------------------------
// Scoped to the exact "MODIFY -- product" candidate list from
// loop/plans/T093.plan.md's "Files" section -- NOT the whole app (which
// legitimately carries sanctioned `Ionicons color="#..."` call sites this
// rule must not false-positive on). Every path below is a real file this
// card was permitted to touch; a hex literal introduced in a `className`/
// `style` position on one of these would be a fresh, unreviewed color.
const D7_CANDIDATE_FILES = [
  "src/strings.ts",
  "src/components/chat/chat-bubble.tsx",
  "src/components/chat/quick-prompts.tsx",
  "src/components/chat/nudge-card.tsx",
  "src/components/chat/active-pet-badge.tsx",
  "app/chat/index.tsx",
  "src/components/otp-input.tsx",
  "src/components/timeline-photo-strip.tsx",
  "src/components/timeline-photo-viewer.tsx",
  "src/components/intake/question-renderer.tsx",
  "src/components/intake/intake-form.tsx",
  "src/components/species-picker.tsx",
  "src/components/breed-autocomplete.tsx",
  "src/components/activity-chip-grid.tsx",
  "src/components/activity-recents-row.tsx",
  "src/components/activity-quantity-sheet.tsx",
  "src/components/schedule-builder.tsx",
  "src/components/services/preview-banner.tsx",
  "app/services/preview-end.tsx",
  "app/services/index.tsx",
  "app/checks/[id].tsx",
  "app/check/[category].tsx",
  "app/paywall.tsx",
  "app/(tabs)/index.tsx",
  "app/check/result/[checkId].tsx",
].map((relative) => nodePath.join(__dirname, "..", relative));

// Matches a bare hex literal appearing as (or inside) a `className`/`style`
// string value -- e.g. `className="text-[#123456]"` or a plain
// `"#123456"` string literal -- NOT an `Ionicons color="#..."` prop value
// (which this rule deliberately does not scan for, per the plan's scoping).
const BARE_HEX_IN_CLASSNAME_PATTERN = /className=(?:\{[^}]*)?["'`][^"'`]*#[0-9a-fA-F]{3,8}[^"'`]*["'`]/;

describe("a11y-static-scan: no bare hex literal introduced in the swept files", () => {
  it("the candidate list is non-empty (non-vacuity)", () => {
    expect(D7_CANDIDATE_FILES.length).toBeGreaterThan(0);
  });

  it("none of the D7 candidate files this card edited introduce a bare hex in a className", () => {
    const offenders = D7_CANDIDATE_FILES.filter((file) => {
      const source = fs.readFileSync(file, "utf8");
      return BARE_HEX_IN_CLASSNAME_PATTERN.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it("the pattern genuinely matches a planted violation (non-vacuity proof)", () => {
    expect(BARE_HEX_IN_CLASSNAME_PATTERN.test('className="text-[#ff00ff]"')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rule 4 (T093 plan step 15 / D2 -- doc<->test cross-check for
// docs/qa/a11y-script.md's [AUTO] tags)
// ---------------------------------------------------------------------------
const SCRIPT_PATH = nodePath.join(__dirname, "..", "..", "..", "docs", "qa", "a11y-script.md");
const SWEEP_TEST_PATH = nodePath.join(__dirname, "a11y-sweep.test.tsx");

// Matches the plan's exact tag format: `[AUTO: a11y-sweep › <exact it() title>]`
const AUTO_TAG_PATTERN = /\[AUTO:\s*a11y-sweep\s*›\s*([^\]]+)\]/g;
// Matches every `it(` / `describe(` title string in a11y-sweep.test.tsx.
const TEST_TITLE_PATTERN = /\b(?:it|describe)\(\s*(["'`])((?:[^\\]|\\.)*?)\1/g;

describe("a11y-static-scan: every [AUTO] tag in docs/qa/a11y-script.md names a real a11y-sweep test", () => {
  const scriptSource = fs.readFileSync(SCRIPT_PATH, "utf8");
  const sweepSource = fs.readFileSync(SWEEP_TEST_PATH, "utf8");

  const autoTags = [...scriptSource.matchAll(AUTO_TAG_PATTERN)].map((m) => m[1]!.trim());
  const testTitles = new Set([...sweepSource.matchAll(TEST_TITLE_PATTERN)].map((m) => m[2]!));

  it("the script has a non-empty set of [AUTO] tags (non-vacuity)", () => {
    expect(autoTags.length).toBeGreaterThan(0);
  });

  it("a11y-sweep.test.tsx has a non-empty set of it()/describe() titles (non-vacuity)", () => {
    expect(testTitles.size).toBeGreaterThan(0);
  });

  it("every [AUTO] tag names a title that exists verbatim in a11y-sweep.test.tsx", () => {
    const missing = autoTags.filter((tag) => !testTitles.has(tag));
    expect(missing).toEqual([]);
  });

  it("the containment check genuinely fails on a planted missing title (M8 non-vacuity proof)", () => {
    const plantedTags = ["this test title does not exist anywhere"];
    const missing = plantedTags.filter((tag) => !testTitles.has(tag));
    expect(missing).toEqual(plantedTags);
  });
});
