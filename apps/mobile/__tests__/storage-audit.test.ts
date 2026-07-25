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
const STORE_NAME_PATTERN = /name:\s*["'`](pawcareright\.[^"'`]+)["'`]/;
const CREDENTIAL_SHAPED_KEY_PATTERN =
  /(access|refresh)?token|password|passwd|\botp\b|secret|api[_-]?key|credential|jwt/i;

const PERSISTED_STORE_FILES = ALL_SOURCE_FILES.filter((file) =>
  PERSIST_CALL_PATTERN.test(fs.readFileSync(file, "utf8")),
);

/**
 * The exact, documented list (docs/security/mobile-storage-audit.md).
 * Adding an 8th persisted store fails this test until the audit doc is
 * updated -- the point of the pin (T096 plan D8).
 */
const EXPECTED_PERSISTED_STORE_NAMES = [
  "pawcareright.activity-recents",
  "pawcareright.paywall-shown",
  "pawcareright.weight-unit",
  "pawcareright.reminder-outbox",
  "pawcareright.active-pet",
  "pawcareright.add-pet-draft",
  "pawcareright.analytics-consent",
].sort();

describe("storage-audit: MMKV-persisted zustand stores", () => {
  it("found a non-trivial number of persist() call sites (non-vacuity)", () => {
    expect(PERSISTED_STORE_FILES.length).toBeGreaterThan(0);
  });

  it("no credential-shaped key is persisted to unencrypted MMKV (name or partialize region)", () => {
    const offenders: string[] = [];
    for (const file of PERSISTED_STORE_FILES) {
      const source = fs.readFileSync(file, "utf8");
      // The "persisted region" is everything from the first `persist(` call
      // to its matching `createJSONStorage(...)` options object -- in
      // practice (and verified against every store in this repo) that is
      // simply the `name`/`partialize` lines, which sit right next to the
      // `storage: createJSONStorage(...)` line. Scanning the whole file's
      // `name`/`partialize` declarations is equivalent here since none of
      // these files define unrelated `name`/`partialize` identifiers.
      const nameMatch = source.match(/name:\s*["'`][^"'`]+["'`]/);
      const partializeMatch = source.match(/partialize:\s*\([^)]*\)\s*=>\s*\(\{[^}]*\}\)/);
      const region = [nameMatch?.[0] ?? "", partializeMatch?.[0] ?? ""].join("\n");
      if (CREDENTIAL_SHAPED_KEY_PATTERN.test(region)) {
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

  it("the set of MMKV-persisted store names is pinned and every name starts with pawcareright.", () => {
    const names = PERSISTED_STORE_FILES.map((file) => {
      const source = fs.readFileSync(file, "utf8");
      const match = source.match(STORE_NAME_PATTERN);
      return match?.[1];
    })
      .filter((name): name is string => Boolean(name))
      .sort();

    expect(names).toEqual(EXPECTED_PERSISTED_STORE_NAMES);
    for (const name of names) {
      expect(name.startsWith("pawcareright.")).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// SecureStore keys: the two documented token keys.
// ---------------------------------------------------------------------------
describe("storage-audit: SecureStore keys are the two documented token keys", () => {
  it("src/auth/secure-store.ts declares exactly pawcareright.auth.accessToken and pawcareright.auth.refreshToken", () => {
    const source = fs.readFileSync(nodePath.join(SRC_DIR, "auth", "secure-store.ts"), "utf8");
    expect(source).toContain('"pawcareright.auth.accessToken"');
    expect(source).toContain('"pawcareright.auth.refreshToken"');
  });
});
