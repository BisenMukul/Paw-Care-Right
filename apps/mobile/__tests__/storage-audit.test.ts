/**
 * T096 Phase E: the SecureStore/MMKV usage audit as a repo-local static
 * scan, mirroring `a11y-static-scan.test.ts`'s header idiom exactly (this
 * workspace has no `@types/node`, so `node:fs`/`node:path` can't be
 * `import`ed by name -- the Metro/Expo ambient `require` resolves them fine
 * at Jest's real-Node runtime; `__dirname` is a real per-module CJS free
 * variable with no ambient type here).
 *
 * The empty `export {}` below is required for the same reason documented in
 * `a11y-static-scan.test.ts`: this file has no other top-level
 * `import`/`export`, which (absent one) would make TypeScript treat it as a
 * global script rather than an isolated module, and its own
 * `declare const __dirname` would then collide with the other files' own
 * script-scope declarations.
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

function relativePath(file: string): string {
  return file.replaceAll("\\", "/").replace(`${nodePath.join(__dirname, "..").replaceAll("\\", "/")}/`, "");
}

// ---------------------------------------------------------------------------
// expo-secure-store: the single credential surface (docs/security/mobile-storage-audit.md)
// ---------------------------------------------------------------------------
describe("storage-audit: expo-secure-store is imported by exactly one module", () => {
  const SECURE_STORE_IMPORT_PATTERN = /from\s+["']expo-secure-store["']/;

  it("visited a non-trivial number of source files (non-vacuity)", () => {
    expect(ALL_SOURCE_FILES.length).toBeGreaterThan(50);
  });

  it("the set of importing files is non-empty and is exactly src/auth/secure-store.ts", () => {
    const importers = ALL_SOURCE_FILES.filter((file) =>
      SECURE_STORE_IMPORT_PATTERN.test(fs.readFileSync(file, "utf8")),
    ).map(relativePath);

    expect(importers.length).toBeGreaterThan(0);
    expect(importers).toEqual(["src/auth/secure-store.ts"]);
  });
});

// ---------------------------------------------------------------------------
// AsyncStorage ban (CLAUDE.md §6: tokens/PII live in SecureStore, never
// AsyncStorage). Complements token-storage.test.ts's "not installed" proof
// with a "not referenced anywhere" proof.
// ---------------------------------------------------------------------------
describe("storage-audit: no source file references AsyncStorage", () => {
  const ASYNC_STORAGE_PATTERN = /@react-native-async-storage\/async-storage/;

  it("no file imports @react-native-async-storage/async-storage", () => {
    const offenders = ALL_SOURCE_FILES.filter((file) =>
      ASYNC_STORAGE_PATTERN.test(fs.readFileSync(file, "utf8")),
    ).map(relativePath);
    expect(offenders).toEqual([]);
  });

  it("the pattern genuinely matches a planted violation (non-vacuity proof)", () => {
    expect(ASYNC_STORAGE_PATTERN.test('import AsyncStorage from "@react-native-async-storage/async-storage";')).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// MMKV-persisted zustand stores: pinned set + no credential-shaped key.
// ---------------------------------------------------------------------------
const PERSIST_CALL_PATTERN = /createJSONStorage\(/;
const STORE_NAME_PATTERN = /name:\s*["'`](bombaypetcompany\.[^"'`]+)["'`]/g;
const NAME_DECLARATION_PATTERN = /name:\s*["'`][^"'`]+["'`]/g;
const PARTIALIZE_DECLARATION_PATTERN = /partialize:\s*\([^)]*\)\s*=>\s*\(\{[^}]*\}\)/g;
const CREDENTIAL_SHAPED_KEY_PATTERN =
  /(access|refresh)?token|password|passwd|\botp\b|secret|api[_-]?key|credential|jwt/i;

const PERSISTED_STORE_FILES = ALL_SOURCE_FILES.filter((file) =>
  PERSIST_CALL_PATTERN.test(fs.readFileSync(file, "utf8")),
);

/**
 * T098 docket 3 (T096 review nit): every `name:` declaration AND every
 * `partialize:` declaration in `source`, scanned with `matchAll` (not the
 * first `match()` of each) -- a file with two persisted stores has two of
 * each, and a credential-shaped key hiding in the *second* store's
 * `partialize` must not be able to hide behind the first store's clean one.
 */
function persistedRegions(source: string): string[] {
  const names = [...source.matchAll(NAME_DECLARATION_PATTERN)].map((match) => match[0]);
  const partializes = [...source.matchAll(PARTIALIZE_DECLARATION_PATTERN)].map((match) => match[0]);
  return [...names, ...partializes];
}

/** Every `bombaypetcompany.*` persisted store name declared anywhere in `source`. */
function persistedStoreNames(source: string): string[] {
  return [...source.matchAll(STORE_NAME_PATTERN)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined);
}

/**
 * The exact, documented list (docs/security/mobile-storage-audit.md).
 * Adding an 8th persisted store fails this test until the audit doc is
 * updated -- the point of the pin (T096 plan D8).
 */
const EXPECTED_PERSISTED_STORE_NAMES = [
  "bombaypetcompany.activity-recents",
  "bombaypetcompany.paywall-shown",
  "bombaypetcompany.weight-unit",
  "bombaypetcompany.reminder-outbox",
  "bombaypetcompany.active-pet",
  "bombaypetcompany.add-pet-draft",
  "bombaypetcompany.analytics-consent",
].sort();

describe("storage-audit: MMKV-persisted zustand stores", () => {
  it("found a non-trivial number of persist() call sites (non-vacuity)", () => {
    expect(PERSISTED_STORE_FILES.length).toBeGreaterThan(0);
  });

  it("no credential-shaped key is persisted to unencrypted MMKV (name or partialize region)", () => {
    // The "persisted region" is every `name:`/`partialize:` declaration in
    // the file -- scanned with `matchAll` (via `persistedRegions()`) so a
    // *second* persisted store in the same file (its own `name`/`partialize`
    // pair) is scanned too, not just the first `match()` hit.
    const offenders: string[] = [];
    for (const file of PERSISTED_STORE_FILES) {
      const source = fs.readFileSync(file, "utf8");
      const regions = persistedRegions(source);
      if (regions.some((region) => CREDENTIAL_SHAPED_KEY_PATTERN.test(region))) {
        offenders.push(relativePath(file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the credential-shaped pattern genuinely matches a planted violation (non-vacuity proof)", () => {
    expect(CREDENTIAL_SHAPED_KEY_PATTERN.test("partialize: (state) => ({ refreshToken: state.refreshToken })")).toBe(
      true,
    );
  });

  it("a second persisted store in the same file is detected (T096 review nit)", () => {
    // Synthetic two-store source, inline -- no file is planted on disk. The
    // first store is clean; the credential-shaped key hides in the SECOND
    // store's `partialize`, which a `match()`-based (first-hit-only) scan
    // would never see.
    const synthetic = `
      const useStoreA = create(
        persist((set) => ({ shown: false, setShown: (v) => set({ shown: v }) }), {
          name: "bombaypetcompany.synthetic-store-a",
          storage: createJSONStorage(() => mmkvStorage),
        }),
      );
      const useStoreB = create(
        persist((set) => ({ refreshToken: null }), {
          name: "bombaypetcompany.synthetic-store-b",
          partialize: (state) => ({ refreshToken: state.refreshToken }),
          storage: createJSONStorage(() => mmkvStorage),
        }),
      );
    `;

    const names = persistedStoreNames(synthetic);
    expect(names).toEqual(["bombaypetcompany.synthetic-store-a", "bombaypetcompany.synthetic-store-b"]);

    const regions = persistedRegions(synthetic);
    const partializeRegions = regions.filter((region) => region.startsWith("partialize"));
    expect(partializeRegions).toHaveLength(1);
    expect(CREDENTIAL_SHAPED_KEY_PATTERN.test(partializeRegions[0]!)).toBe(true);
  });

  it("the set of MMKV-persisted store names is pinned and every name starts with bombaypetcompany.", () => {
    const names = PERSISTED_STORE_FILES.flatMap((file) =>
      persistedStoreNames(fs.readFileSync(file, "utf8")),
    ).sort();

    expect(names).toEqual(EXPECTED_PERSISTED_STORE_NAMES);
    for (const name of names) {
      expect(name.startsWith("bombaypetcompany.")).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// SecureStore keys: the two documented token keys.
// ---------------------------------------------------------------------------
describe("storage-audit: SecureStore keys are the two documented token keys", () => {
  it("src/auth/secure-store.ts declares exactly bombaypetcompany.auth.accessToken and bombaypetcompany.auth.refreshToken", () => {
    const source = fs.readFileSync(nodePath.join(SRC_DIR, "auth", "secure-store.ts"), "utf8");
    expect(source).toContain('"bombaypetcompany.auth.accessToken"');
    expect(source).toContain('"bombaypetcompany.auth.refreshToken"');
  });
});
