import type { Species } from "@pawcareright/types";
import { allBreeds } from "@pawcareright/data";

/**
 * A breed's typical adult weight range, in grams — neutral reference
 * information only (CLAUDE.md §7 / plan Safety statement: no interpretive
 * or judgmental copy is derived from this anywhere downstream).
 */
export interface WeightBand {
  minGrams: number;
  maxGrams: number;
  breedName: string;
}

const KG_TO_GRAMS = 1000;

/**
 * Resolves the typical-adult-weight band for a pet's breed (T022 data),
 * scoped by species so a slug collision across species can never leak the
 * wrong breed's range. Returns `null` when there is no `breedSlug`, or no
 * matching row exists (T065 plan decision 7).
 */
export function resolveBreedBand(species: Species, breedSlug: string | null): WeightBand | null {
  if (breedSlug === null) {
    return null;
  }

  const breed = allBreeds.find((row) => row.slug === breedSlug && row.species === species);
  if (breed === undefined) {
    return null;
  }

  return {
    minGrams: Math.round(breed.typicalAdultWeightKg.min * KG_TO_GRAMS),
    maxGrams: Math.round(breed.typicalAdultWeightKg.max * KG_TO_GRAMS),
    breedName: breed.name,
  };
}
