import type { RedFlagIntake, RedFlagSign } from "@pawcareright/ai";
import type { CompletedIntake, Sex, Species } from "@pawcareright/types";

/**
 * The fields the mapper reads off the resolved `Pet` (T042 plan, Mapper
 * spec). Deliberately narrower than `PetResponse` — pure, framework-free
 * (no Nest/Prisma imports), so this stays unit-testable like
 * `check-status.ts`.
 */
export interface PetProfileInput {
  species: Species;
  sex: Sex;
  ageEstimateMonths: number | null;
  birthDate: Date | null;
  weightGrams: number | null;
}

/**
 * `questionId` + matching `answer.value`(s) → `RedFlagSign`, verbatim from
 * `loop/plans/T032.plan.md` R2 (also transcribed in the T042 plan's Mapper
 * spec table). `category` is informational only — question ids are unique
 * within their category, so matching on `questionId` + `value` alone is
 * sufficient and avoids a second category-gate that would otherwise have to
 * be kept in lockstep with `packages/types` `INTAKE_CATEGORIES`.
 */
const SIGN_MAPPING: ReadonlyArray<{
  questionId: string;
  values: readonly string[];
  sign: RedFlagSign;
}> = [
  { questionId: "difficulty", values: ["straining", "cannot-urinate"], sign: "straining_to_urinate" },
  { questionId: "blood-in-urine", values: ["yes"], sign: "blood_in_urine" },
  { questionId: "character", values: ["labored", "open-mouth-cat", "gasping"], sign: "breathing_difficulty" },
  { questionId: "gum-color", values: ["pale-white", "blue-purple"], sign: "abnormal_gum_color" },
  { questionId: "what", values: ["hit-by-vehicle"], sign: "major_trauma" },
  { questionId: "bleeding", values: ["heavy"], sign: "uncontrolled_bleeding" },
  { questionId: "consciousness", values: ["unresponsive"], sign: "collapse_unresponsive" },
];

/** Whole months between `birthDate` and `now`, clamped to a minimum of 0. */
function monthsSince(birthDate: Date, now: Date): number {
  const months = (now.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 + (now.getUTCMonth() - birthDate.getUTCMonth());
  return Math.max(0, months);
}

function deriveAgeMonths(pet: PetProfileInput, now: Date): number | undefined {
  if (pet.ageEstimateMonths !== null) {
    return pet.ageEstimateMonths;
  }
  if (pet.birthDate !== null) {
    return monthsSince(pet.birthDate, now);
  }
  return undefined;
}

function deriveSigns(intake: CompletedIntake): Partial<Record<RedFlagSign, boolean>> {
  const signs: Partial<Record<RedFlagSign, boolean>> = {};

  for (const answer of intake.answers) {
    if (answer.type !== "single") continue;

    for (const mapping of SIGN_MAPPING) {
      if (answer.questionId === mapping.questionId && (mapping.values as readonly string[]).includes(answer.value)) {
        signs[mapping.sign] = true;
      }
    }
  }

  return signs;
}

/**
 * Maps a resolved pet profile + a validated `CompletedIntake` into the
 * `packages/ai` red-flag engine's input shape (T042 plan Mapper spec).
 * Pure, deterministic, never throws. `sizeClass` is intentionally omitted
 * (undefined) — not derivable from the `Pet` model (plan D8).
 */
export function buildRedFlagIntake(
  pet: PetProfileInput,
  intake: CompletedIntake,
  now: Date = new Date(),
): RedFlagIntake {
  const ageMonths = deriveAgeMonths(pet, now);
  const weightKg = pet.weightGrams != null ? pet.weightGrams / 1000 : undefined;
  const signs = deriveSigns(intake);

  return {
    species: pet.species,
    sex: pet.sex,
    ...(ageMonths !== undefined ? { ageMonths } : {}),
    ...(weightKg !== undefined ? { weightKg } : {}),
    ...(Object.keys(signs).length > 0 ? { signs } : {}),
    ...(intake.freeText !== undefined ? { freeText: intake.freeText } : {}),
  };
}
