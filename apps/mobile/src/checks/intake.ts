import type { Answer, CategoryDef, QuestionDef } from "@pawcareright/types";

/**
 * Pure, framework-free helpers for the dynamic symptom-intake flow (T045
 * plan §"Interfaces"). No React, no I/O — consumed by `IntakeForm`.
 */

/**
 * Assembles the `CompletedIntake` candidate from the in-progress answers
 * map, preserving `categoryDef.questions` schema order. `freeText` is
 * included only when non-empty after trimming (trimmed). The result is a
 * plain candidate object for `parseIntake` to validate — it is NOT assumed
 * to be a valid `CompletedIntake` yet (plan Risk 6).
 */
export function buildIntakeCandidate(
  categoryDef: CategoryDef,
  answers: Record<string, Answer>,
  freeText: string,
): { category: CategoryDef["id"]; answers: Answer[]; freeText?: string } {
  const orderedAnswers: Answer[] = [];
  for (const question of categoryDef.questions) {
    const answer = answers[question.id];
    if (answer !== undefined) {
      orderedAnswers.push(answer);
    }
  }

  const trimmedFreeText = freeText.trim();

  return trimmedFreeText.length > 0
    ? { category: categoryDef.id, answers: orderedAnswers, freeText: trimmedFreeText }
    : { category: categoryDef.id, answers: orderedAnswers };
}

/**
 * Human-readable review summary for a single answer, driven entirely by
 * `question`'s option/label data — never raw values (plan Flow spec,
 * Review step).
 */
export function describeAnswer(question: QuestionDef, answer: Answer): string {
  if (question.type === "single" && answer.type === "single") {
    const option = question.options.find((candidate) => candidate.value === answer.value);
    return option?.label ?? answer.value;
  }

  if (question.type === "multi" && answer.type === "multi") {
    const labelByValue = new Map(question.options.map((option) => [option.value, option.label]));
    return answer.values.map((value) => labelByValue.get(value) ?? value).join(", ");
  }

  if (question.type === "scale" && answer.type === "scale") {
    return `${answer.value} / ${question.max}`;
  }

  if (question.type === "duration" && answer.type === "duration") {
    return `${answer.value} ${answer.unit}`;
  }

  if (question.type === "photoPrompt" && answer.type === "photoPrompt") {
    return `${answer.photoKeys.length}`;
  }

  return "";
}
