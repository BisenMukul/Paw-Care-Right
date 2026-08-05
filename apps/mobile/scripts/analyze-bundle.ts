/**
 * T095 plan step 15 -- `tsx` entry point that reads an exported Metro
 * bundle + its source map, calls the pure `source-map-attribution` module,
 * and prints the top-N packages by attributed byte size plus the grand
 * total. Not wired into turbo or CI (`expo export` is minutes-long and the
 * card's CI gate is the web-perf-budget job, not this).
 *
 * Node access uses the locally-typed `require` house pattern -- this
 * workspace has no `@types/node` (adding it is out of scope and risks
 * colliding with RN's global types), mirroring the static-scan tests'
 * header idiom.
 */
import { attributeBytes, groupByPackage } from "../src/perf/source-map-attribution";

declare const __dirname: string;
declare const process: { argv: string[] };

interface NodeFs {
  readFileSync(path: string, encoding: string): string;
  existsSync(path: string): boolean;
  readdirSync(path: string): string[];
}
interface NodePath {
  join(...parts: string[]): string;
  dirname(path: string): string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: locally-typed require avoids adding @types/node (a new dep is out of scope) for this tsx CLI entry
const fs = require("node:fs") as NodeFs;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const nodePath = require("node:path") as NodePath;

const DEFAULT_MAP_DIR = nodePath.join(__dirname, "..", ".perf", "export", "_expo", "static", "js", "android");
const TOP_N = 20;
const RUN_INSTRUCTIONS =
  "run `npx expo export --platform android --dump-sourcemap --output-dir .perf/export` first";

function parseArgs(argv: string[]): { mapPath: string | undefined } {
  const mapArg = argv.find((arg) => arg.startsWith("--map="));
  return { mapPath: mapArg?.slice("--map=".length) };
}

function resolveMapPath(explicit: string | undefined): string {
  if (explicit !== undefined) {
    return explicit;
  }
  if (!fs.existsSync(DEFAULT_MAP_DIR)) {
    throw new Error(`analyze-bundle: no export found at ${DEFAULT_MAP_DIR} -- ${RUN_INSTRUCTIONS}`);
  }
  const candidates = fs.readdirSync(DEFAULT_MAP_DIR).filter((name) => name.endsWith(".map"));
  if (candidates.length === 0) {
    throw new Error(`analyze-bundle: no .map file found in ${DEFAULT_MAP_DIR} -- ${RUN_INSTRUCTIONS}`);
  }
  return nodePath.join(DEFAULT_MAP_DIR, candidates[0]!);
}

function main(): void {
  const { mapPath: explicitMapPath } = parseArgs(process.argv.slice(2));
  const mapPath = resolveMapPath(explicitMapPath);

  if (!fs.existsSync(mapPath)) {
    throw new Error(`analyze-bundle: map file not found at ${mapPath} -- ${RUN_INSTRUCTIONS}`);
  }

  const bundlePath = mapPath.endsWith(".map") ? mapPath.slice(0, -".map".length) : mapPath;
  if (!fs.existsSync(bundlePath)) {
    throw new Error(`analyze-bundle: sibling bundle not found at ${bundlePath} -- ${RUN_INSTRUCTIONS}`);
  }

  const map = JSON.parse(fs.readFileSync(mapPath, "utf8")) as { mappings: string; sources: string[] };
  const generatedCode = fs.readFileSync(bundlePath, "utf8");

  const perSource = attributeBytes({ mappings: map.mappings, sources: map.sources, generatedCode });
  const perPackage = groupByPackage(perSource);
  const total = perPackage.reduce((sum, row) => sum + row.bytes, 0);

  /* eslint-disable no-console -- JUSTIFIED: this is a CLI reporting entry point (`pnpm perf:bundle`), not app runtime code; its whole job is to print a human-readable byte table to stdout. */
  console.log(`analyze-bundle: ${bundlePath}`);
  console.log(`analyze-bundle: ${map.sources.length} sources, ${total} total attributed bytes\n`);
  console.log("package".padEnd(40), "bytes");
  for (const row of perPackage.slice(0, TOP_N)) {
    console.log(row.source.padEnd(40), row.bytes);
  }
  console.log(`\ntotal: ${total} bytes`);
  /* eslint-enable no-console */
}

main();
