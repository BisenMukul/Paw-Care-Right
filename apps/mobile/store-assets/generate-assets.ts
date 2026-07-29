/**
 * T100 plan step 5 -- `tsx` entry point (`pnpm --filter mobile
 * assets:generate`) that walks `ASSET_MANIFEST`, renders every entry via
 * `renderMark`, encodes it via `encodePng`, and writes it to its
 * repo-relative path. Deterministic: the same manifest always produces the
 * same bytes (no randomness, no `Date` -- see `raster.ts`).
 *
 * `--check` renders every entry in memory and diffs it against the on-disk
 * file instead of writing (reserved for a future CI drift-check job; not
 * wired into turbo/CI by this task, mirrors `scripts/analyze-bundle.ts`'s
 * deliberately-standalone status).
 *
 * Node access uses the locally-typed `require` house pattern -- this
 * workspace has no `@types/node` (adding it is out of scope), mirroring
 * `scripts/analyze-bundle.ts`'s header idiom.
 */
import { ASSET_MANIFEST } from "./tools/asset-manifest";
import { encodePng } from "./tools/png-encode";
import { renderMark } from "./tools/raster";

declare const __dirname: string;
declare const process: { argv: string[]; exit(code: number): never };

interface NodeFs {
  writeFileSync(path: string, data: Uint8Array): void;
  readFileSync(path: string): Uint8Array;
  existsSync(path: string): boolean;
  mkdirSync(path: string, options: { recursive: boolean }): void;
}
interface NodePath {
  join(...parts: string[]): string;
  dirname(path: string): string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: locally-typed require avoids adding @types/node (a new dep is out of scope) for this tsx CLI entry
const fs = require("node:fs") as NodeFs;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const nodePath = require("node:path") as NodePath;

const REPO_ROOT = nodePath.join(__dirname, "..", "..", "..");

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function main(): void {
  const checkOnly = process.argv.includes("--check");
  let drift = false;
  const rows: { path: string; width: number; height: number; bytes: number }[] = [];

  for (const entry of ASSET_MANIFEST) {
    const rgba = renderMark({
      width: entry.width,
      height: entry.height,
      background: entry.render.background,
      mark: entry.render.mark,
      markScale: entry.render.markScale,
      cornerRadiusRatio: entry.render.cornerRadiusRatio,
    });
    const png = encodePng(rgba, entry.width, entry.height, { alpha: entry.alpha });
    const fullPath = nodePath.join(REPO_ROOT, entry.path);

    if (checkOnly) {
      if (!fs.existsSync(fullPath) || !bytesEqual(fs.readFileSync(fullPath), png)) {
        drift = true;
        rows.push({ path: `DRIFT ${entry.path}`, width: entry.width, height: entry.height, bytes: png.length });
        continue;
      }
      rows.push({ path: entry.path, width: entry.width, height: entry.height, bytes: png.length });
      continue;
    }

    fs.mkdirSync(nodePath.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, png);
    rows.push({ path: entry.path, width: entry.width, height: entry.height, bytes: png.length });
  }

  /* eslint-disable no-console -- JUSTIFIED: this is a CLI reporting entry point (`pnpm --filter mobile assets:generate`), not app runtime code; its whole job is to print a human-readable byte table to stdout, mirrors scripts/analyze-bundle.ts */
  for (const row of rows) {
    console.log(row.path.padEnd(70), `${row.width}x${row.height}`.padEnd(12), `${row.bytes} bytes`);
  }
  /* eslint-enable no-console */

  if (checkOnly && drift) {
    process.exit(1);
  }
}

main();
