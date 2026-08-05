/* eslint-disable no-console -- CLI entrypoint: stdout summary is the legitimate UI here, matching packages/ai/src/content/generate-breed-guides.ts:1. */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { computeDatasetAudit, renderDatasetAuditDoc } from "./dataset-audit";

/**
 * Locates the repo root by walking up from `startDir` (default:
 * `process.cwd()`) until `pnpm-workspace.yaml` is found.
 *
 * `__dirname` and `import.meta.url` are both unusable here: this package's
 * built artifact ships as both ESM and CJS (`packages/data/tsup.config.ts`),
 * and `import.meta` is rejected by `tsc` when compiling under the
 * CommonJS `tsconfig.spec.json` this package's Jest suite uses, while
 * `__dirname` has no binding in the ESM build actually executed by
 * `qa:dataset-audit` (`tsup && node dist/qa/generate-dataset-audit.js`).
 * `process.cwd()` is the common denominator: pnpm/turbo run a package's
 * `scripts.*` entry with cwd set to that package's directory regardless of
 * the invoking shell's cwd (mirrors `packages/ai/src/evals/paths.ts:26-38`).
 */
function findRepoRoot(startDir: string = process.cwd()): string {
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

/**
 * Writes exactly one file (`docs/qa/dataset-audit.md`) and nothing else —
 * never touches any dataset row.
 */
export function main(): void {
  const repoRoot = findRepoRoot();
  const qaDir = join(repoRoot, "docs", "qa");
  const docPath = join(qaDir, "dataset-audit.md");

  const audit = computeDatasetAudit();
  const doc = renderDatasetAuditDoc(audit);

  mkdirSync(qaDir, { recursive: true });
  writeFileSync(docPath, doc, "utf8");

  console.log(
    `dataset-audit: wrote docs/qa/dataset-audit.md (${String(audit.counts.toxins.total)} toxins, ${String(audit.counts.breeds.total)} breeds, ${String(audit.counts.breedGuides.total)} guides, ${String(audit.counts.hotlineRegions)} hotline regions — all hotlines UNVERIFIED)`,
  );
}

try {
  main();
} catch (err: unknown) {
  console.error("generate-dataset-audit crashed:", err);
  process.exit(1);
}
