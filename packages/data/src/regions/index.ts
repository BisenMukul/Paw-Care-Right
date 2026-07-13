import { REGION_HOTLINE_ROWS } from "./data";
import { regionHotlineSchema, type RegionHotlineRow } from "./schema";

// Parsing at module load is the runtime validation layer; `regions.spec.ts`
// is the build/test-time layer that additionally asserts counts/uniqueness
// (mirrors packages/data/src/toxins/index.ts).
export const REGION_HOTLINES: readonly RegionHotlineRow[] = Object.freeze(
  REGION_HOTLINE_ROWS.map((row) => regionHotlineSchema.parse(row)),
);

export const regionHotlineByCode: ReadonlyMap<string, RegionHotlineRow> = new Map(
  REGION_HOTLINES.map((row) => [row.regionCode, row]),
);

/** Public, fully-resolved shape — never carries the internal `source` citation field. */
export interface ResolvedRegionHotline {
  known: boolean;
  regionCode: string; // the matched code, or "DEFAULT" for the fallback
  poisonHotlineName: string | null;
  displayNumber: string | null;
  dialNumber: string | null;
  feeNote: string | null;
}

/** Fail-safe fallback: NO fabricated number (T049 plan §5 rule 2 / R7). */
export const FALLBACK_REGION_HOTLINE: ResolvedRegionHotline = Object.freeze({
  known: false,
  regionCode: "DEFAULT",
  poisonHotlineName: null,
  displayNumber: null,
  dialNumber: null,
  feeNote: null,
});

/**
 * Resolves a device region code to its poison-hotline row, or the
 * no-number fallback when the region is missing or unrecognized.
 * Case-insensitive on input; lookup keys are always uppercase.
 */
export function resolveRegionHotline(regionCode?: string): ResolvedRegionHotline {
  if (!regionCode) {
    return FALLBACK_REGION_HOTLINE;
  }
  const row = regionHotlineByCode.get(regionCode.toUpperCase());
  if (!row) {
    return FALLBACK_REGION_HOTLINE;
  }
  return {
    known: true,
    regionCode: row.regionCode,
    poisonHotlineName: row.poisonHotlineName,
    displayNumber: row.displayNumber,
    dialNumber: row.dialNumber,
    feeNote: row.feeNote,
  };
}
