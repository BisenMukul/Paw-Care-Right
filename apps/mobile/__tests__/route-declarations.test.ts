/**
 * Route-declaration guard (T094 plan step 6.3, folded item 2 / T083 F8
 * hand-off). Reads `app/_layout.tsx` as text and the route filesystem via
 * `fs` -- no rendering, a pure static scan (T093 static-scan precedent).
 * Verdict recorded in `docs/qa/state-audit.md` §3: a bare `<Stack.Screen
 * name="x"/>` configures nothing under expo-router's file-based routing;
 * this guard exists so a stale/typo'd declaration, or a silent removal of
 * one of the 4 options-bearing declarations, fails CI -- NOT to require
 * every route be declared.
 *
 * This workspace has no `@types/node` (see `a11y-static-scan.test.ts`'s
 * header comment / `no-pawsaathi-branding.test.ts`), so `node:fs`/`node:path`
 * can't be `import`ed by name -- the Metro/Expo ambient `require` resolves
 * them fine at Jest's real-Node runtime. `__dirname` is likewise a real
 * per-module CJS free variable with no ambient type here.
 *
 * The empty `export {}` below is required: this file otherwise has no
 * top-level `import`/`export`, which would make TypeScript treat it as a
 * global script rather than an isolated module -- its own
 * `declare const __dirname` would then collide with every other test
 * file's identical script-scope declaration.
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
  existsSync(path: string): boolean;
  statSync(path: string): { isDirectory(): boolean };
}
interface NodePath {
  join(...parts: string[]): string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: locally-typed require avoids adding @types/node (a new dep is out of scope), mirrors a11y-static-scan.test.ts
const fs = require("node:fs") as NodeFs;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const path = require("node:path") as NodePath;

const APP_ROOT = path.join(__dirname, "..", "app");
const LAYOUT_PATH = path.join(APP_ROOT, "_layout.tsx");

interface Declaration {
  name: string;
  optionsSnippet: string | null;
}

function readLayoutSource(): string {
  return fs.readFileSync(LAYOUT_PATH, "utf8");
}

/** Parses every `<Stack.Screen name="X" .../>` in `_layout.tsx`'s source text, capturing any inline `options={{...}}` on the same tag. */
function parseDeclarations(source: string): Declaration[] {
  const declarations: Declaration[] = [];
  // Non-greedy up to the first `/>` -- attribute VALUES (e.g. `name="pets/[id]"`)
  // legitimately contain `/`, so excluding `/` from the tag body (as a naive
  // `[^/]*?` would) truncates the match before the real closing tag.
  const tagPattern = /<Stack\.Screen\s+([\s\S]*?)\/>/g;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(source)) !== null) {
    const tagBody = match[1] ?? "";
    const nameMatch = /name="([^"]+)"/.exec(tagBody);
    if (nameMatch === null) {
      continue;
    }
    const optionsMatch = /options=\{\{([^}]*)\}\}/.exec(tagBody);
    declarations.push({ name: nameMatch[1]!, optionsSnippet: optionsMatch ? optionsMatch[1]!.trim() : null });
  }
  return declarations;
}

/**
 * Resolves a declared `name` to a real file/group on disk: `X.tsx`,
 * `X/index.tsx`, or a directory `X` (a route group -- `(auth)`/`(tabs)`
 * already carry their own parens in the declared `name`; a nested-layout
 * group like `add-pet` is a plain directory name).
 */
function resolvesToRealRoute(name: string): boolean {
  const direct = path.join(APP_ROOT, `${name}.tsx`);
  if (fs.existsSync(direct)) {
    return true;
  }
  const indexFile = path.join(APP_ROOT, name, "index.tsx");
  if (fs.existsSync(indexFile)) {
    return true;
  }
  const asDirectory = path.join(APP_ROOT, name);
  if (fs.existsSync(asDirectory) && fs.statSync(asDirectory).isDirectory()) {
    return true;
  }
  return false;
}

function listRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listRouteFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("route declarations (app/_layout.tsx) vs the filesystem", () => {
  const source = readLayoutSource();
  const declarations = parseDeclarations(source);
  const routeFiles = listRouteFiles(APP_ROOT);

  it("the parser sees at least 17 declarations and at least 45 route files", () => {
    // Non-vacuity floor (T093 static-scan precedent) -- the parse must
    // never silently degrade to zero.
    expect(declarations.length).toBeGreaterThanOrEqual(17);
    expect(routeFiles.length).toBeGreaterThanOrEqual(45);
  });

  it("every declared Stack.Screen name resolves to a real route file", () => {
    for (const declaration of declarations) {
      expect(resolvesToRealRoute(declaration.name)).toBe(true);
    }
  });

  it("the four options-bearing routes keep their options (emergency stays gestureEnabled:false)", () => {
    const byName = new Map(declarations.map((d) => [d.name, d.optionsSnippet]));

    expect(byName.get("add-pet")).toEqual(expect.stringContaining('presentation: "modal"'));
    expect(byName.get("reminders/edit")).toEqual(expect.stringContaining('presentation: "modal"'));
    expect(byName.get("paywall")).toEqual(expect.stringContaining('presentation: "modal"'));
    expect(byName.get("check/emergency/[checkId]")).toEqual(expect.stringContaining("gestureEnabled: false"));
  });
});
