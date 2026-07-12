import { FOOD_VERDICTS, type Species } from "@pawcareright/types";

import type { TextMessage } from "../providers/types";

/**
 * Static food-safety prompt version registry (T035). No `Date.now`/random —
 * fixed data only, embedded verbatim in the system prompt footer.
 */
export const FOOD_SAFETY_PROMPT_VERSION = "food-safety-v1";

/**
 * `FoodSafetyAnswer` rendered as model-facing text (mirrors
 * `../triage/schema-text.ts`). The verdict list is interpolated from
 * `FOOD_VERDICTS` so it cannot drift from `@pawcareright/types`; the rest is
 * static descriptive text. `parseFoodSafetyAnswer` remains the real
 * validation gate — this text is a teaching aid, not a schema serializer.
 */
const FOOD_SAFETY_SCHEMA_TEXT = `{
  "verdict": <one of: ${FOOD_VERDICTS.join(" | ")}>,
  "note": string (1-2 plain-language sentences, no numbers/units, no dosing amounts, plain descriptive language only)
}`;

/**
 * Static, deterministic system prompt for the food/toxin fallback answerer
 * (T035). Encodes the Safety Policy (PRODUCT_SPEC §5 / CLAUDE §7):
 * caution-biased on uncertainty, no dosing/diagnosis language, and a firm
 * instruction never to claim an unrecognized item is unambiguously safe.
 * Refers to "this pet-care guidance app" — no product display name is
 * embedded here (mirrors `../triage/system-prompt.ts` Decision R7).
 */
function buildSystemPrompt(): string {
  const roleSection =
    "You are the food-and-toxin safety answerer for a dog-and-cat pet-care guidance app. " +
    "A pet owner is asking whether a specific food, plant, chemical, medication, or other " +
    "substance is safe for their pet. You are not a veterinarian.";

  const cautionRulesSection = [
    "ABSOLUTE SAFETY RULES:",
    "- When you are not confident about an item, or evidence is mixed, choose the more cautious verdict rather than a more reassuring one. Never guess toward `safe`.",
    '- Only use "safe" when you are confident the item poses no real risk in typical amounts; if there is any meaningful doubt, use "caution" or higher instead.',
    "- Never give a dosing amount, a numeric quantity with a unit, or an amount-per-bodyweight figure of any kind.",
    '- Never use the words "diagnosis" or "diagnose".',
    "- Never recommend or name a drug to give, and never instruct the owner to administer any medication (human or otherwise) to their pet.",
    "- Keep `note` short, plain-language, and qualitative (for example: describe relative severity in words, not numbers).",
  ].join("\n");

  const outputContractSection = [
    "Return ONLY a single JSON object matching the schema below. No markdown, no code fences, no text before or after the JSON.",
    FOOD_SAFETY_SCHEMA_TEXT,
  ].join("\n\n");

  const footerSection = `Prompt version: ${FOOD_SAFETY_PROMPT_VERSION}`;

  return [roleSection, cautionRulesSection, outputContractSection, footerSection].join("\n\n");
}

export interface BuiltFoodSafetyPrompt {
  system: string;
  messages: TextMessage[];
  temperature: number;
  version: string;
}

/** Assembles the full food-safety prompt: static caution-biased system prompt + the current item question, at temperature 0. */
export function buildFoodSafetyPrompt(species: Species, item: string): BuiltFoodSafetyPrompt {
  const userMessage: TextMessage = {
    role: "user",
    content: `Species: ${species}. Is "${item}" safe for this pet to eat or be exposed to?`,
  };

  return {
    system: buildSystemPrompt(),
    messages: [userMessage],
    temperature: 0,
    version: FOOD_SAFETY_PROMPT_VERSION,
  };
}
