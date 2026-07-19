import type { Species } from "@pawcareright/types";

import { daysAgo } from "../clock";
import { BUDDY_PET_ID, CLEO_PET_ID, DEMO_HOUSEHOLD_ID, LUNA_PET_ID } from "../constants";

/** Plain pet row input — matches `Pet`'s scalar columns exactly (plan #5). */
export interface DemoPetInput {
  id: string;
  householdId: string;
  species: Species;
  breedSlug: string;
  name: string;
  sex: "MALE" | "FEMALE" | "UNKNOWN";
  neutered: boolean;
  birthDate: Date;
  ageEstimateMonths: number;
  weightGrams: number;
}

const APPROX_DAYS_PER_MONTH = 30.44;

/** Pure age->birthDate conversion (no `Date.now()`; `now` is the sole injected clock). */
function birthDateForAgeMonths(now: Date, ageMonths: number): Date {
  return daysAgo(now, Math.round(ageMonths * APPROX_DAYS_PER_MONTH));
}

/**
 * The 3 demo pets — divergent data personalities (plan "Pets" table):
 * Buddy (adult dog, rich), Cleo (adult cat, moderate), Luna (kitten, sparse
 * — new arrival). Breed slugs are real rows in `packages/data`'s
 * `dogs.json`/`cats.json` (asserted by `demo-builders.spec.ts`).
 */
export function buildDemoPets(now: Date): DemoPetInput[] {
  const buddyAgeMonths = 48; // ~4y — ADULT
  const cleoAgeMonths = 72; // ~6y — ADULT
  const lunaAgeMonths = 4; // ~4mo — PUPPY_KITTEN

  return [
    {
      id: BUDDY_PET_ID,
      householdId: DEMO_HOUSEHOLD_ID,
      species: "DOG",
      breedSlug: "labrador-retriever",
      name: "Buddy",
      sex: "MALE",
      neutered: true,
      birthDate: birthDateForAgeMonths(now, buddyAgeMonths),
      ageEstimateMonths: buddyAgeMonths,
      weightGrams: 30000,
    },
    {
      id: CLEO_PET_ID,
      householdId: DEMO_HOUSEHOLD_ID,
      species: "CAT",
      breedSlug: "siamese",
      name: "Cleo",
      sex: "FEMALE",
      neutered: true,
      birthDate: birthDateForAgeMonths(now, cleoAgeMonths),
      ageEstimateMonths: cleoAgeMonths,
      weightGrams: 4200,
    },
    {
      id: LUNA_PET_ID,
      householdId: DEMO_HOUSEHOLD_ID,
      species: "CAT",
      breedSlug: "maine-coon",
      name: "Luna",
      sex: "FEMALE",
      neutered: false,
      birthDate: birthDateForAgeMonths(now, lunaAgeMonths),
      ageEstimateMonths: lunaAgeMonths,
      weightGrams: 1800,
    },
  ];
}
