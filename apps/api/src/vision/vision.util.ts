import type { CompletedIntake } from "@pawcareright/types";

/**
 * Flattens every `photoPrompt` answer's `photoKeys` across a completed
 * intake, in intake answer order then within-answer `photoKeys` order. Pure:
 * no fetch, no side effects, no sorting/dedup (keys are already validated
 * upstream by `completedIntakeSchema` — plan R8).
 */
export function collectPhotoKeys(intake: CompletedIntake): string[] {
  const keys: string[] = [];
  for (const answer of intake.answers) {
    if (answer.type === "photoPrompt") {
      keys.push(...answer.photoKeys);
    }
  }
  return keys;
}
