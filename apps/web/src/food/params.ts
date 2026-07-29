// Static-param derivation for the programmatic food-safety pages (T085 D1/D3).
// The page count is derived from the toxin dataset's own length — never a
// literal — so it stays true as `packages/data` grows (plan decision D1).
import { toxins } from "@bombaypetcompany/data";

import { SPECIES_SEGMENTS, speciesBySegment, type SpeciesDescriptor } from "./species";

/** Every toxin row's `id`, in dataset order. */
export function foodItemIds(): string[] {
  return toxins.map((row) => row.id);
}

/** `generateStaticParams` input for one species segment, dataset order. */
export function staticParamsFor(segment: SpeciesDescriptor["segment"]): { item: string }[] {
  // Confirms the segment is a known one — an unknown segment yields no
  // params rather than silently emitting every item id under a bogus route.
  const descriptor = speciesBySegment(segment);
  if (!descriptor) {
    return [];
  }
  return foodItemIds().map((item) => ({ item }));
}

/** Every generated page path, dogs first then cats, dataset order (D2/D9). */
export function allFoodPagePaths(): string[] {
  const ids = foodItemIds();
  const paths: string[] = [];
  for (const segment of SPECIES_SEGMENTS) {
    for (const id of ids) {
      paths.push(`/${segment}/${id}`);
    }
  }
  return paths;
}

/** `toxins.length * SPECIES_SEGMENTS.length` — derived, never hardcoded (D1). */
export const FOOD_PAGE_COUNT: number = toxins.length * SPECIES_SEGMENTS.length;
