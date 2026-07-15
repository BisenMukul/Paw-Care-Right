/**
 * Weight unit domain (T065 plan): pure conversions between the storage
 * source of truth (integer grams) and the two display units. No React, no
 * imports — every mobile weight surface (chart, form, unit store) is built
 * on top of this module.
 */
export type WeightUnit = "kg" | "lb";

/** Locale-default-to-imperial regions (T065 plan decision 4). */
export const IMPERIAL_REGIONS = ["US", "LR", "MM"] as const;

export const WEIGHT_MIN_GRAMS = 1;
export const WEIGHT_MAX_GRAMS = 200000;

const GRAMS_PER_KG = 1000;
const GRAMS_PER_LB = 453.592;

/** Resolves the default display unit for a device region code (`undefined` ⇒ metric). */
export function defaultUnitForRegion(regionCode: string | undefined): WeightUnit {
  if (regionCode !== undefined && (IMPERIAL_REGIONS as readonly string[]).includes(regionCode)) {
    return "lb";
  }
  return "kg";
}

/** Grams → the given display unit, rounded to 1 decimal place. */
export function gramsToDisplay(grams: number, unit: WeightUnit): number {
  const raw = unit === "kg" ? grams / GRAMS_PER_KG : grams / GRAMS_PER_LB;
  return Math.round(raw * 10) / 10;
}

/** Grams → a formatted, unit-suffixed string (e.g. `"25.0 kg"`). */
export function formatWeight(grams: number, unit: WeightUnit): string {
  return `${gramsToDisplay(grams, unit).toFixed(1)} ${unit}`;
}

export type ParseDisplayToGramsResult =
  | { ok: true; grams: number }
  | { ok: false; reason: "empty" | "nan" | "range" };

/**
 * Parses a user-entered display-unit string into storage-source-of-truth
 * grams. Trims whitespace, rejects empty input, rejects non-numeric input,
 * then converts and bounds-checks against `[WEIGHT_MIN_GRAMS,
 * WEIGHT_MAX_GRAMS]` — a non-positive or absurdly large value fails the
 * same bounds check ("range"), not a separate reason.
 */
export function parseDisplayToGrams(input: string, unit: WeightUnit): ParseDisplayToGramsResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const value = Number(trimmed);
  if (Number.isNaN(value)) {
    return { ok: false, reason: "nan" };
  }

  const grams = Math.round(unit === "kg" ? value * GRAMS_PER_KG : value * GRAMS_PER_LB);
  if (grams < WEIGHT_MIN_GRAMS || grams > WEIGHT_MAX_GRAMS) {
    return { ok: false, reason: "range" };
  }

  return { ok: true, grams };
}
