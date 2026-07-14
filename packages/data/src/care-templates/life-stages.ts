import type { Species } from "@pawcareright/types";

import type { LifeStage } from "./schema";

/**
 * Life-stage boundaries (Decision R3), collapsed from the finer AAHA/AAFP
 * life-stage guideline tiers to three stages for this product. Sources
 * consulted (names only — no copied prose): AAHA canine life-stage
 * guidelines; AAHA/AAFP feline life-stage guidelines. Boundary-inclusive at
 * the lower edge (12mo = ADULT). Giant-breed dogs age faster than these
 * boundaries assume — handled via a vet-confirm note in the content, not
 * per-breed logic.
 */
const SENIOR_START_MONTHS: Record<Species, number> = {
  DOG: 84, // >= 7 years
  CAT: 120, // >= 10 years
};

/** Both species share the same PUPPY_KITTEN upper bound: 0-11 months. */
const PUPPY_KITTEN_MAX_MONTHS = 11;

export function lifeStageForAgeMonths(species: Species, ageMonths: number): LifeStage {
  if (ageMonths <= PUPPY_KITTEN_MAX_MONTHS) {
    return "PUPPY_KITTEN";
  }
  if (ageMonths >= SENIOR_START_MONTHS[species]) {
    return "SENIOR";
  }
  return "ADULT";
}

/**
 * Absent/unknown age -> `ADULT` baseline, NOT the juvenile pack (Decision
 * R6). Scheduling an intensive juvenile vaccine series onto an
 * unknown-age (possibly adult) animal risks harmful over-vaccination, so
 * CLAUDE.md §5 "animal safety beats every goal" overrides a naive
 * "more reminders = safer" reading. Every resulting item note still directs
 * the owner to confirm the true life stage with their vet.
 */
export function resolveLifeStage(species: Species, ageMonths?: number | null): LifeStage {
  if (ageMonths === null || ageMonths === undefined) {
    return "ADULT";
  }
  return lifeStageForAgeMonths(species, ageMonths);
}
