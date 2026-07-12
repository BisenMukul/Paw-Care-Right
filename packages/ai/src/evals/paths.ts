import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Locates the repo root by walking up from `startDir` (default:
 * `process.cwd()`) until `pnpm-workspace.yaml` is found.
 *
 * DEVIATION from the plan's "walk up from `import.meta.url`" note (plan
 * "R-entry"): `import.meta.url` is ESM-only syntax and this package's Jest
 * suite compiles specs via ts-jest under `tsconfig.spec.json`
 * (`module: "CommonJS"`, required so ts-jest/CJS-Jest can run them) — `tsc`
 * rejects `import.meta` under a CommonJS module target, so any file using it
 * would break `pnpm --filter @pawcareright/ai test`. `__dirname` is equally
 * unusable because tsup's ESM output (the artifact `test:ai-evals` actually
 * executes, `dist/evals/run.js`) has no `__dirname` binding (verified by
 * running the built artifact directly).
 *
 * `process.cwd()` is the robust common denominator: npm/pnpm/turbo all run
 * a package's `scripts.*` entry (and Jest, invoked the same way) with cwd
 * set to that package's directory (`packages/ai`) regardless of the
 * invoking shell's cwd — walking up two levels from there reaches the repo
 * root in every invocation path exercised by this task (`pnpm --filter
 * @pawcareright/ai test:ai-evals`, `pnpm test:ai-evals` via turbo from the
 * repo root, and Jest specs run the same way).
 */
export function findRepoRoot(startDir: string = process.cwd()): string {
  let dir = startDir;
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`findRepoRoot: could not locate pnpm-workspace.yaml walking up from "${startDir}"`);
    }
    dir = parent;
  }
}

/** `packages/ai/evals` — the sample-fixture directory the card mandates. */
export function evalsDir(repoRoot: string = findRepoRoot()): string {
  return join(repoRoot, "packages", "ai", "evals");
}

/** `loop/eval-reports` — where the harness writes its timestamped + `latest.md` reports. */
export function reportsDir(repoRoot: string = findRepoRoot()): string {
  return join(repoRoot, "loop", "eval-reports");
}
