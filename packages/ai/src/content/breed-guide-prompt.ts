import type { Breed } from "@pawcareright/data";

import { VET_PROMPT_PREFIX } from "@pawcareright/data";

/**
 * Provider-mode prompt for drafting one breed guide row (T084 plan D4/D10).
 * Drafting assistance only: every response still goes through Zod +
 * `scanUnsafeText` + forced `reviewed: false` in `parseProviderDraft` — this
 * prompt cannot itself make unsafe output ship, but it exists to make an
 * unsafe response *less likely* in the first place.
 */

const RESPONSE_SHAPE = `{
  "slug": "<the exact slug you were given>",
  "temperament": "<40-400 chars>",
  "exerciseNeeds": { "level": "LOW|MODERATE|HIGH|VERY_HIGH", "narrative": "<40-400 chars>" },
  "commonConditionAwareness": [
    { "topic": "<3-60 chars, a body system or life-stage topic>", "prompt": "<must start with the exact string '${VET_PROMPT_PREFIX}'>" }
  ],
  "groomingCadence": { "frequency": "DAILY|SEVERAL_TIMES_WEEKLY|WEEKLY|MONTHLY", "narrative": "<40-400 chars>" }
}`;

/** Static system segment: the schema contract + every content constraint (plan safety statement 4/5). */
export function buildBreedGuideSystemPrompt(): string {
  return [
    "You are drafting factual, breed-general pet-care reference copy for a pet-care app.",
    "This copy is read by pet owners between vet visits. It must never resemble medical advice.",
    "",
    "Reply with ONLY one JSON object matching exactly this shape (no prose, no markdown fence):",
    RESPONSE_SHAPE,
    "",
    "Hard rules, no exceptions:",
    `- Every "commonConditionAwareness[].prompt" MUST start with the exact string "${VET_PROMPT_PREFIX}" and`,
    "  must be phrased as a question to bring to a vet conversation — never a claim about any specific pet,",
    "  never a likelihood/prevalence statement, never a test or treatment instruction, never a prognosis.",
    "- Never use the word \"diagnosis\" or \"diagnose\" or any variant.",
    "- Never name a drug, medication, or supplement brand, and never recommend administering anything.",
    "- Never write a number followed by a unit of mass/volume (e.g. mg, ml, mcg, g, kg, iu, tsp, tbsp),",
    "  and never write a dosing frequency (e.g. \"every N hours\").",
    "- Never mention declawing, ear cropping, tail docking, sedation, euthanasia, or fighting/conditioning.",
    "- Grooming and exercise content is husbandry only (coat, brushing, nail/ear checks, activity), never",
    "  a product recommendation and never a medical procedure.",
    "- Do not include a \"reviewed\" or \"provenance\" field; those are set by the app, not by you.",
  ].join("\n");
}

/** User turn: the one breed this draft is for. */
export function buildBreedGuideUserPrompt(breed: Breed): string {
  return [
    `Breed: ${breed.name}`,
    `Species: ${breed.species}`,
    `Size class: ${breed.sizeClass}`,
    `Typical adult weight: ${breed.typicalAdultWeightKg.min}-${breed.typicalAdultWeightKg.max} kg`,
    `Slug (use exactly this in your "slug" field): ${breed.slug}`,
    "",
    "Draft the JSON object now.",
  ].join("\n");
}
