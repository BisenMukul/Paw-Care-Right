import { getCategoryDef, type Answer, type CategoryDef, type Sex, type Species } from "@pawcareright/types";

import type { TriagePetContext, TriagePromptInput } from "./types";

/**
 * Deterministic, label-based, plain-text user-turn serialization (T033).
 * Serializes ONLY whitelisted `TriagePetContext` fields plus the completed
 * intake (via `getCategoryDef` question/option labels) and a photo-count
 * placeholder — never raw option values, never PII beyond pet context.
 */

function speciesLabel(species: Species): string {
  return species === "DOG" ? "Dog" : "Cat";
}

function sexLabel(sex: Sex | undefined): string {
  if (sex === "MALE") return "Male";
  if (sex === "FEMALE") return "Female";
  return "Unknown";
}

/**
 * Defensive fallback (belt-and-suspenders): the completed intake is already
 * validated by `parseIntake`, so this branch should be unreachable in
 * practice — it only guards against a question/option label that cannot be
 * resolved, falling back to the raw answer value rather than throwing.
 */
function renderRawAnswer(answer: Answer): string {
  switch (answer.type) {
    case "single":
      return `- ${answer.questionId}: ${answer.value}`;
    case "multi":
      return `- ${answer.questionId}: ${answer.values.join(", ")}`;
    case "scale":
      return `- ${answer.questionId}: ${answer.value}`;
    case "duration":
      return `- ${answer.questionId}: ${answer.value} ${answer.unit}`;
    case "photoPrompt":
      return `- ${answer.questionId}`;
  }
}

/** Renders one INTAKE line for a single answer; `undefined` for `photoPrompt` answers (count-only). */
function renderAnswerLine(answer: Answer, categoryDef: CategoryDef | undefined): string | undefined {
  if (answer.type === "photoPrompt") {
    return undefined;
  }

  const question = categoryDef?.questions.find((candidate) => candidate.id === answer.questionId);
  if (!question) {
    return renderRawAnswer(answer);
  }

  if (answer.type === "single") {
    if (question.type !== "single") return renderRawAnswer(answer);
    const option = question.options.find((candidate) => candidate.value === answer.value);
    return `- ${question.prompt}: ${option?.label ?? answer.value}`;
  }

  if (answer.type === "multi") {
    if (question.type !== "multi") return renderRawAnswer(answer);
    const labels = answer.values.map((value) => {
      const option = question.options.find((candidate) => candidate.value === value);
      return option?.label ?? value;
    });
    return `- ${question.prompt}: ${labels.join(", ")}`;
  }

  if (answer.type === "scale") {
    if (question.type !== "scale") return renderRawAnswer(answer);
    return `- ${question.prompt}: ${answer.value} of ${question.max} (${question.min} = ${question.minLabel}, ${question.max} = ${question.maxLabel})`;
  }

  // answer.type === "duration"
  if (question.type !== "duration") return renderRawAnswer(answer);
  return `- ${question.prompt}: ${answer.value} ${answer.unit}`;
}

function countPhotos(answers: readonly Answer[]): number {
  return answers.reduce((total, answer) => (answer.type === "photoPrompt" ? total + answer.photoKeys.length : total), 0);
}

function buildPetLines(pet: TriagePetContext): string[] {
  const lines = [
    "PET",
    `- Name: ${pet.name}`,
    `- Species: ${speciesLabel(pet.species)}`,
    `- Breed: ${pet.breedLabel ?? "Unknown / mixed"}`,
    `- Sex: ${sexLabel(pet.sex)}${pet.neutered === true ? ", neutered" : ""}`,
  ];

  if (pet.ageMonths !== undefined) {
    lines.push(`- Age: ${pet.ageMonths} months`);
  }
  if (pet.weightKg !== undefined) {
    lines.push(`- Weight: ${pet.weightKg} kg`);
  }

  return lines;
}

/** Serializes a `TriagePromptInput` into the deterministic user-turn text (T033). */
export function buildUserTurn(input: TriagePromptInput): string {
  const { pet, intake } = input;
  const categoryDef = getCategoryDef(intake.category);

  const lines: string[] = [...buildPetLines(pet), "", `REPORTED PROBLEM: ${categoryDef?.label ?? intake.category}`, "", "INTAKE"];

  const answerLines = intake.answers
    .map((answer) => renderAnswerLine(answer, categoryDef))
    .filter((line): line is string => line !== undefined);
  lines.push(...answerLines);

  if (intake.freeText !== undefined) {
    lines.push("", `OWNER'S DESCRIPTION: ${intake.freeText}`);
  }

  lines.push("", `PHOTOS ATTACHED: ${countPhotos(intake.answers)}`);
  lines.push("", "Return only JSON matching the schema. No text outside the JSON.");

  return lines.join("\n");
}
