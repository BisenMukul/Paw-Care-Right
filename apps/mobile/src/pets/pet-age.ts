import type { Pet } from "@pawcareright/types";

import { strings } from "../strings";

const { age } = strings.petHome;

/**
 * Derives a short, human-readable age label for the pet header card
 * (T025 plan). Composes labels from `strings.petHome.age.*` tokens only —
 * no hardcoded user-facing text here (CLAUDE.md §6).
 *
 * - `birthDate` set: whole calendar months between `birthDate` and `now`,
 *   clamped to never go negative (a future birth date reads "0 mo").
 * - Else `ageEstimateMonths` set: an approximate "~" label (residual months
 *   dropped once >=12, plan R6).
 * - Else: "Age unknown".
 */
export function derivePetAgeLabel(
  pet: Pick<Pet, "birthDate" | "ageEstimateMonths">,
  now: Date = new Date(),
): string {
  if (pet.birthDate) {
    const birth = new Date(pet.birthDate);
    let totalMonths =
      (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (now.getDate() < birth.getDate()) {
      totalMonths -= 1;
    }
    totalMonths = Math.max(0, totalMonths);

    if (totalMonths < 12) {
      return `${totalMonths} ${age.mo}`;
    }
    const years = Math.floor(totalMonths / 12);
    const remainderMonths = totalMonths % 12;
    return remainderMonths === 0
      ? `${years} ${age.yr}`
      : `${years} ${age.yr} ${remainderMonths} ${age.mo}`;
  }

  if (pet.ageEstimateMonths != null) {
    const months = pet.ageEstimateMonths;
    return months < 12
      ? `${age.approx}${months} ${age.mo}`
      : `${age.approx}${Math.floor(months / 12)} ${age.yr}`;
  }

  return age.unknown;
}
