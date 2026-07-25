/**
 * T095 plan step 11 -- static scan pinning the image cache policy (D8) across
 * every `expo-image` call site. House pattern copied verbatim from
 * `a11y-static-scan.test.ts`'s header idiom: this workspace has no
 * `@types/node` (a new dep is out of scope), so `node:fs`/`node:path` are
 * accessed via a locally-typed `require`, and `__dirname` is declared
 * locally as a real per-module CJS free variable.
 *
 * The empty `export {}` below is required: this file has no other top-level
 * `import`/`export`, which (absent one) makes TypeScript treat it as a
 * global script rather than an isolated module -- its own
 * `declare const __dirname` would then collide with every other static-scan
 * test's identical script-scope declaration (verified: `tsc --noEmit` fails
 * with "Cannot redeclare block-scoped variable '__dirname'" without this
 * line). One line, zero runtime effect.
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

const ALL_SOURCE_FILES = collectSourceFiles(SRC_DIR).concat(collectSourceFiles(APP_DIR));

const EXPO_IMAGE_IMPORT_PATTERN = /from\s+["']expo-image["']/;
const IMPORTS_IMAGE_FROM_EXPO_IMAGE_PATTERN = /import\s*\{[^}]*\bImage\b[^}]*\}\s*from\s*["']expo-image["']/;
const CACHE_POLICY_PROP_PATTERN = /cachePolicy=/;
const BARE_STRING_CACHE_POLICY_PATTERN = /cachePolicy=\{?\s*["'`](memory-disk|memory|disk|none)["'`]/;
const CACHE_POLICY_CONSTANT_IMPORT_PATTERN = /from\s+["'][^"']*\/perf\/image-cache-policy["']/;
const CORE_RN_IMAGE_IMPORT_PATTERN = /import\s*\{[^}]*\bImage\b[^}]*\}\s*from\s*["']react-native["']/;

const EXPO_IMAGE_FILES = ALL_SOURCE_FILES.filter((file) =>
  IMPORTS_IMAGE_FROM_EXPO_IMAGE_PATTERN.test(fs.readFileSync(file, "utf8")),
);

describe("image-cache-policy-scan: every expo-image call site sets cachePolicy from the shared constant", () => {
  it("found at least 6 files that import Image from expo-image (non-vacuity)", () => {
    expect(EXPO_IMAGE_FILES.length).toBeGreaterThanOrEqual(6);
  });

  it("the expo-image import pattern genuinely matches (non-vacuity proof)", () => {
    expect(EXPO_IMAGE_IMPORT_PATTERN.test('import { Image } from "expo-image";')).toBe(true);
  });

  it("every file importing Image from expo-image sets cachePolicy somewhere in the file", () => {
    const offenders = EXPO_IMAGE_FILES.filter((file) => !CACHE_POLICY_PROP_PATTERN.test(fs.readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("no file passes a bare cachePolicy string literal -- it must reference the shared constant", () => {
    const offenders = EXPO_IMAGE_FILES.filter((file) => {
      const source = fs.readFileSync(file, "utf8");
      return BARE_STRING_CACHE_POLICY_PATTERN.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it("the bare-string pattern genuinely matches a planted violation (non-vacuity proof)", () => {
    expect(BARE_STRING_CACHE_POLICY_PATTERN.test('<Image cachePolicy="memory-disk" />')).toBe(true);
  });

  it("every file that sets cachePolicy imports it from the shared perf/image-cache-policy module", () => {
    const offenders = EXPO_IMAGE_FILES.filter((file) => {
      const source = fs.readFileSync(file, "utf8");
      return CACHE_POLICY_PROP_PATTERN.test(source) && !CACHE_POLICY_CONSTANT_IMPORT_PATTERN.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it("the constants module exports exactly the two documented values", () => {
    const source = fs.readFileSync(nodePath.join(SRC_DIR, "perf", "image-cache-policy.ts"), "utf8");
    expect(source).toMatch(/export const REMOTE_IMAGE_CACHE_POLICY = "memory-disk" as const;/);
    expect(source).toMatch(/export const LOCAL_IMAGE_CACHE_POLICY = "memory" as const;/);
  });
});

describe("image-cache-policy-scan: no React Native core <Image> is used for content images", () => {
  it("no app/ or src/ file imports Image from react-native (verified true before asserting zero)", () => {
    const offenders = ALL_SOURCE_FILES.filter((file) =>
      CORE_RN_IMAGE_IMPORT_PATTERN.test(fs.readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("the core-Image import pattern genuinely matches a planted violation (non-vacuity proof)", () => {
    expect(CORE_RN_IMAGE_IMPORT_PATTERN.test('import { Image, View } from "react-native";')).toBe(true);
  });
});
