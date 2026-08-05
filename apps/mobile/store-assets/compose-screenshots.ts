/**
 * T100 plan step 11 -- `tsx` entry point (`pnpm --filter mobile
 * store:screenshots`) that drives `composeShotSet` over real captures on
 * disk. `--input` (default `store-assets/raw`), `--output` (default
 * `store-assets/out`), `--profile` (repeatable, default all four). Fails
 * loudly with the capture checklist when the input dir is empty -- this
 * kit never silently skips a missing shot (plan D5: no real capture is
 * possible in this build environment; a founder runs this against a real
 * staging build).
 *
 * Node access uses the locally-typed `require` house pattern -- this
 * workspace has no `@types/node`, mirrors `scripts/analyze-bundle.ts`.
 */
import { decodePng } from "./tools/png-decode";
import { encodePng } from "./tools/png-encode";
import { DEVICE_PROFILES, SHOT_SET } from "./tools/screenshot-profiles";
import { composeShotSet } from "./tools/compose";
import { storeMarketing } from "./marketing-strings";

declare const __dirname: string;
declare const process: { argv: string[]; exit(code: number): never };

interface DirEntry {
  isFile(): boolean;
}
interface NodeFs {
  existsSync(path: string): boolean;
  readFileSync(path: string): Uint8Array;
  writeFileSync(path: string, data: Uint8Array | string): void;
  mkdirSync(path: string, options: { recursive: boolean }): void;
  readdirSync(path: string, options: { withFileTypes: true }): DirEntry[];
}
interface NodePath {
  join(...parts: string[]): string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: locally-typed require avoids adding @types/node (a new dep is out of scope) for this tsx CLI entry
const fs = require("node:fs") as NodeFs;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const nodePath = require("node:path") as NodePath;

const REPO_ROOT = nodePath.join(__dirname, "..", "..", "..");
const DEFAULT_INPUT = nodePath.join(REPO_ROOT, "apps", "mobile", "store-assets", "raw");
const DEFAULT_OUTPUT = nodePath.join(REPO_ROOT, "apps", "mobile", "store-assets", "out");

function parseArgs(argv: string[]): { input: string; output: string; profileIds: string[] } {
  let input = DEFAULT_INPUT;
  let output = DEFAULT_OUTPUT;
  const profileIds: string[] = [];
  for (const arg of argv) {
    if (arg.startsWith("--input=")) {
      input = arg.slice("--input=".length);
    } else if (arg.startsWith("--output=")) {
      output = arg.slice("--output=".length);
    } else if (arg.startsWith("--profile=")) {
      profileIds.push(arg.slice("--profile=".length));
    }
  }
  return { input, output, profileIds };
}

function captureChecklist(inputDir: string): string {
  const lines = [
    `store:screenshots: no captures found in ${inputDir}`,
    "Capture each shot from a preview/staging build (see store-assets/README.md §6), then save it as:",
    ...SHOT_SET.map((shot) => `  ${inputDir}/${shot.id}.png  (${shot.captureNotes})`),
    "Then re-run: pnpm --filter mobile store:screenshots",
  ];
  return lines.join("\n");
}

function main(): void {
  const { input, output, profileIds } = parseArgs(process.argv.slice(2));
  const profiles = profileIds.length === 0 ? DEVICE_PROFILES : DEVICE_PROFILES.filter((p) => profileIds.includes(p.id));

  const hasCaptures = fs.existsSync(input) && fs.readdirSync(input, { withFileTypes: true }).some((e) => e.isFile());
  if (!hasCaptures) {
    /* eslint-disable no-console -- JUSTIFIED: CLI reporting entry point (`pnpm --filter mobile store:screenshots`), mirrors scripts/analyze-bundle.ts */
    console.log(captureChecklist(input));
    /* eslint-enable no-console */
    process.exit(1);
  }

  const written = composeShotSet({
    inputDir: input,
    outputDir: output,
    profiles,
    shots: SHOT_SET,
    marketing: storeMarketing,
    fs,
    decodePng,
    encodePng,
    joinPath: (...parts) => nodePath.join(...parts),
  });

  /* eslint-disable no-console -- JUSTIFIED: same as above */
  for (const path of written) {
    console.log(path);
  }
  console.log(`\n${written.length} files written across ${profiles.length} profile(s).`);
  /* eslint-enable no-console */
}

main();
