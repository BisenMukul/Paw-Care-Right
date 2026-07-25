/**
 * T095 plan step 14 -- hand-rolled base64-VLQ source-map decoder + per-source
 * generated-byte attribution + per-package grouping (D5: no new dependency;
 * `source-map-explorer` is not in the lockfile and `source-map` is only a
 * transitive dependency -- pnpm's strict layout would not resolve it from
 * `apps/mobile`). Pure module: no node, no RN imports, fully unit-tested.
 */

const BASE64_VLQ_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const CHAR_TO_VALUE = new Map<string, number>();
for (let i = 0; i < BASE64_VLQ_CHARS.length; i++) {
  CHAR_TO_VALUE.set(BASE64_VLQ_CHARS[i]!, i);
}

const VLQ_BASE_SHIFT = 5;
const VLQ_BASE_MASK = (1 << VLQ_BASE_SHIFT) - 1; // 31
const VLQ_CONTINUATION_BIT = 1 << VLQ_BASE_SHIFT; // 32

interface DecodePosition {
  index: number;
}

function decodeOneVlqValue(segment: string, pos: DecodePosition): number {
  let result = 0;
  let shift = 0;
  let continuation: boolean;
  do {
    const char = segment[pos.index];
    if (char === undefined) {
      throw new Error("decodeVlqMappings: unexpected end of segment while decoding a VLQ value");
    }
    const digit = CHAR_TO_VALUE.get(char);
    if (digit === undefined) {
      throw new Error(`decodeVlqMappings: invalid base64 VLQ character "${char}"`);
    }
    pos.index += 1;
    continuation = (digit & VLQ_CONTINUATION_BIT) !== 0;
    result += (digit & VLQ_BASE_MASK) << shift;
    shift += VLQ_BASE_SHIFT;
  } while (continuation);

  const shouldNegate = (result & 1) === 1;
  result >>= 1;
  return shouldNegate ? -result : result;
}

/**
 * Decodes a source map `mappings` string into `[line][segment][fields]`.
 * Each returned field array is the segment's raw decoded values, exactly as
 * encoded (generatedColumn delta, then -- for a mapped segment -- sourceIndex
 * delta, sourceLine delta, sourceColumn delta, and optionally a nameIndex
 * delta). This function does not resolve running/cumulative sums -- that is
 * `attributeBytes`'s job -- so it stays a pure, direct decode of the wire
 * format (sign bit + continuation bit + multi-group values for numbers that
 * don't fit in 5 bits).
 */
export function decodeVlqMappings(mappings: string): number[][][] {
  return mappings.split(";").map((lineStr) => {
    if (lineStr.length === 0) {
      return [];
    }
    return lineStr.split(",").map((segmentStr) => {
      const fields: number[] = [];
      const pos: DecodePosition = { index: 0 };
      while (pos.index < segmentStr.length) {
        fields.push(decodeOneVlqValue(segmentStr, pos));
      }
      return fields;
    });
  });
}

export interface SourceBytes {
  readonly source: string;
  readonly bytes: number;
}

/** Bucket label for generated spans that carry no source mapping at all. */
const UNMAPPED_SOURCE_LABEL = "(unmapped)";

/**
 * Attributes every byte of `generatedCode` to the source file responsible
 * for it, using the decoded mappings. A segment's span runs from its
 * generated column to the next segment's generated column on the same line,
 * or to the end of the line for the last segment (per T095 plan step 14).
 * Segments with no source reference are attributed to `(unmapped)` so the
 * Σ-bytes-equals-total invariant holds even when the mapping is partial.
 */
export function attributeBytes(args: {
  readonly mappings: string;
  readonly sources: readonly string[];
  readonly generatedCode: string;
}): SourceBytes[] {
  const { mappings, sources, generatedCode } = args;
  const generatedLines = generatedCode.split("\n");
  const decodedLines = decodeVlqMappings(mappings);

  const bytesBySource = new Map<string, number>();
  function addBytes(label: string, amount: number): void {
    if (amount <= 0) {
      return;
    }
    bytesBySource.set(label, (bytesBySource.get(label) ?? 0) + amount);
  }

  let runningSourceIndex = 0;

  for (let lineIndex = 0; lineIndex < decodedLines.length; lineIndex++) {
    const segments = decodedLines[lineIndex]!;
    const lineText = generatedLines[lineIndex] ?? "";

    let runningGeneratedColumn = 0;
    const resolved: Array<{ column: number; source: string | undefined }> = [];

    for (const fields of segments) {
      const generatedColumnDelta = fields[0] ?? 0;
      runningGeneratedColumn += generatedColumnDelta;

      let source: string | undefined;
      if (fields.length >= 4) {
        const sourceIndexDelta = fields[1]!;
        runningSourceIndex += sourceIndexDelta;
        source = sources[runningSourceIndex];
      }
      resolved.push({ column: runningGeneratedColumn, source });
    }

    for (let i = 0; i < resolved.length; i++) {
      const start = resolved[i]!.column;
      const end = i + 1 < resolved.length ? resolved[i + 1]!.column : lineText.length;
      const span = Math.max(0, end - start);
      addBytes(resolved[i]!.source ?? UNMAPPED_SOURCE_LABEL, span);
    }
  }

  return [...bytesBySource.entries()]
    .map(([source, bytes]) => ({ source, bytes }))
    .sort((a, b) => b.bytes - a.bytes);
}

const NODE_MODULES_SEGMENT = "node_modules/";
const PACKAGES_SEGMENT = "packages/";

/**
 * Buckets a single source path into a package/workspace label:
 * - `node_modules/<pkg>` (or the pnpm-nested `.pnpm/.../node_modules/<pkg>`
 *   shape actually observed in this repo's exported bundles) -> `<pkg>`
 *   (`@scope/name` kept together for scoped packages).
 * - `packages/<workspace>` -> `@pawcareright/<workspace>`.
 * - anything else (app-relative source) -> `apps/mobile`.
 */
function derivePackageLabel(sourcePath: string): string {
  const normalized = sourcePath.replaceAll("\\", "/");

  const lastNodeModulesIndex = normalized.lastIndexOf(NODE_MODULES_SEGMENT);
  if (lastNodeModulesIndex !== -1) {
    const afterNodeModules = normalized.slice(lastNodeModulesIndex + NODE_MODULES_SEGMENT.length);
    const parts = afterNodeModules.split("/").filter((part) => part.length > 0);
    if (parts.length === 0) {
      return "(unknown package)";
    }
    if (parts[0]!.startsWith("@") && parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return parts[0]!;
  }

  const packagesIndex = normalized.indexOf(PACKAGES_SEGMENT);
  if (packagesIndex !== -1) {
    const afterPackages = normalized.slice(packagesIndex + PACKAGES_SEGMENT.length);
    const workspaceName = afterPackages.split("/")[0];
    if (workspaceName !== undefined && workspaceName.length > 0) {
      return `@pawcareright/${workspaceName}`;
    }
  }

  return "apps/mobile";
}

/** Groups already-attributed per-source rows into per-package/workspace rows, descending by bytes. */
export function groupByPackage(rows: readonly SourceBytes[]): SourceBytes[] {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const label = derivePackageLabel(row.source);
    grouped.set(label, (grouped.get(label) ?? 0) + row.bytes);
  }
  return [...grouped.entries()].map(([source, bytes]) => ({ source, bytes })).sort((a, b) => b.bytes - a.bytes);
}
