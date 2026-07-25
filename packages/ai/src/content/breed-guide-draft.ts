import {
  breedGuideRowSchema,
  VET_PROMPT_PREFIX,
  type Breed,
  type BreedGuideRow,
  type ExerciseLevel,
  type SizeClass,
} from "@pawcareright/data";

import { scanUnsafeText } from "../evals/detector";
import type { TextProvider } from "../providers/types";
import { extractJsonCandidate } from "../triage/extract-json";

import { buildBreedGuideSystemPrompt, buildBreedGuideUserPrompt } from "./breed-guide-prompt";

/**
 * Pure breed-guide drafting logic (T084 plan D10): `buildTemplateDraft`
 * (deterministic, offline), `parseProviderDraft` (extract-json -> Zod ->
 * detector gate -> forced `reviewed:false` provenance), `draftBreedGuideRow`
 * (the per-breed orchestration the CLI calls, provider-injected so it is
 * testable with `FakeTextProvider` — plan "generator" test "a provider that
 * throws is not fatal"), and `mergeBreedGuides` (reviewed-protection,
 * idempotent). No `fs`, no direct network call (the `TextProvider` is
 * dependency-injected, never constructed here), never throws.
 */

// ---- buildTemplateDraft -------------------------------------------------

const DOG_EXERCISE_LEVEL_BY_SIZE: Record<SizeClass, ExerciseLevel> = {
  TOY: "MODERATE",
  SMALL: "MODERATE",
  MEDIUM: "HIGH",
  LARGE: "HIGH",
  GIANT: "MODERATE",
  UNKNOWN: "MODERATE",
};

function templateExerciseLevel(breed: Breed): ExerciseLevel {
  return breed.species === "CAT" ? "MODERATE" : DOG_EXERCISE_LEVEL_BY_SIZE[breed.sizeClass];
}

/**
 * Deterministic, offline template draft (plan pinned mapping). Always a
 * `reviewed: false`, `generatedBy: "TEMPLATE"` row. Prose is deliberately
 * breed-agnostic (true of any individual of that species/size band) — no
 * fabricated breed-specific condition claim (plan D5/R2).
 */
export function buildTemplateDraft(breed: Breed): BreedGuideRow {
  const row: BreedGuideRow = {
    slug: breed.slug,
    temperament:
      "Temperament varies far more between individuals than between breed labels; early socialisation, " +
      "consistent handling and a predictable daily routine matter most for how any dog or cat actually " +
      "behaves at home. Meeting the parents or prior owner, when possible, tells you more than the label.",
    exerciseNeeds: {
      level: templateExerciseLevel(breed),
      narrative:
        "Daily activity needs depend on this individual pet's age, health and energy, not the breed label " +
        "alone. Build up any new activity gradually and let a vet guide the right plan for this pet.",
    },
    commonConditionAwareness: [
      {
        topic: "Routine wellness checks",
        prompt: `${VET_PROMPT_PREFIX}which routine wellness checks suit this pet's age, size and lifestyle.`,
      },
      {
        topic: "Weight and body condition",
        prompt: `${VET_PROMPT_PREFIX}a healthy weight range and body condition scoring for this individual pet.`,
      },
    ],
    groomingCadence: {
      frequency: "WEEKLY",
      narrative:
        "A weekly coat check and brushing session helps you notice changes early. Ask a groomer or vet " +
        "about the right routine and tools for this individual pet's coat type.",
    },
    reviewed: false,
    provenance: { generatedBy: "TEMPLATE" },
  };

  return row;
}

// ---- parseProviderDraft --------------------------------------------------

export type ProviderDraftOutcome =
  | { ok: true; row: BreedGuideRow }
  | { ok: false; reason: "unparsable" | "schema" | "unsafe"; findings?: string[] };

/** The four free-text fields a guide row exposes, walked by both the detector gate here and the AC3 lint. */
function collectRowFields(row: BreedGuideRow): { path: string; value: string }[] {
  const fields: { path: string; value: string }[] = [
    { path: "temperament", value: row.temperament },
    { path: "exerciseNeeds.narrative", value: row.exerciseNeeds.narrative },
    { path: "groomingCadence.narrative", value: row.groomingCadence.narrative },
  ];

  row.commonConditionAwareness.forEach((item, index) => {
    fields.push({ path: `commonConditionAwareness[${index}].topic`, value: item.topic });
    fields.push({ path: `commonConditionAwareness[${index}].prompt`, value: item.prompt });
  });

  return fields;
}

/**
 * Parses one raw provider response into a schema-valid, detector-clean,
 * `reviewed: false` row — or a structured rejection. Forces `slug` to the
 * requested breed and `provenance` to `{ generatedBy: "PROVIDER", model }`,
 * discarding any `reviewed`/`provenance` the model emitted (plan safety
 * statement 6 — a model may never mark its own output reviewed).
 */
export function parseProviderDraft(raw: string, breed: Breed, model: string): ProviderDraftOutcome {
  const candidateText = extractJsonCandidate(raw);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(candidateText);
  } catch {
    return { ok: false, reason: "unparsable" };
  }

  const candidateObject =
    typeof parsedJson === "object" && parsedJson !== null ? (parsedJson as Record<string, unknown>) : {};

  const forced = {
    ...candidateObject,
    slug: breed.slug,
    reviewed: false,
    provenance: { generatedBy: "PROVIDER" as const, model },
  };

  const parsed = breedGuideRowSchema.safeParse(forced);
  if (!parsed.success) {
    return { ok: false, reason: "schema" };
  }

  const row = parsed.data;
  const findings = collectRowFields(row).flatMap((field) => scanUnsafeText(field.value, field.path));
  if (findings.length > 0) {
    return { ok: false, reason: "unsafe", findings };
  }

  return { ok: true, row };
}

// ---- draftBreedGuideRow ---------------------------------------------------

export interface DraftBreedGuideRowResult {
  row: BreedGuideRow;
  source: "template" | "provider";
  /** Present only when a provider draft was attempted and rejected/failed (CLI's "provider-rejected" count). */
  rejectedReason?: Extract<ProviderDraftOutcome, { ok: false }>["reason"] | "provider_error";
}

/**
 * Per-breed orchestration the CLI calls once per pinned slug (plan "CLI
 * behaviour"): with no provider, always the template draft; with a
 * provider, attempts one provider draft and falls back to the template on
 * ANY non-`ok` outcome or thrown error — never partially accepted, never
 * retried into a guess (plan safety statement 8). The provider is
 * dependency-injected (never constructed here), so this stays testable with
 * `FakeTextProvider` and never performs its own network/file I/O.
 */
export async function draftBreedGuideRow(
  breed: Breed,
  provider: TextProvider | undefined,
  model: string,
): Promise<DraftBreedGuideRowResult> {
  if (!provider) {
    return { row: buildTemplateDraft(breed), source: "template" };
  }

  try {
    const result = await provider.generate({
      system: buildBreedGuideSystemPrompt(),
      prompt: buildBreedGuideUserPrompt(breed),
      temperature: 0,
    });

    const outcome = parseProviderDraft(result.text, breed, model);
    if (outcome.ok) {
      return { row: outcome.row, source: "provider" };
    }
    return { row: buildTemplateDraft(breed), source: "template", rejectedReason: outcome.reason };
  } catch {
    return { row: buildTemplateDraft(breed), source: "template", rejectedReason: "provider_error" };
  }
}

// ---- mergeBreedGuides -----------------------------------------------------

/**
 * Merges `drafts` into `existing`, keyed by `slug` within one species file.
 * Never overwrites a row whose EXISTING entry has `reviewed === true` (plan
 * safety statement 8 / M3). Output order: `existing`'s current order, then
 * any brand-new draft slugs appended in draft order — so a first run
 * (`existing = []`) yields exactly the pinned draft order, and later runs
 * preserve it. Idempotent: `merge(merge(a, b), b)` deep-equals `merge(a, b)`.
 */
export function mergeBreedGuides(
  existing: readonly BreedGuideRow[],
  drafts: readonly BreedGuideRow[],
): BreedGuideRow[] {
  const bySlug = new Map<string, BreedGuideRow>();
  const order: string[] = [];

  for (const row of existing) {
    bySlug.set(row.slug, row);
    order.push(row.slug);
  }

  for (const draft of drafts) {
    if (!bySlug.has(draft.slug)) {
      order.push(draft.slug);
    }

    const current = bySlug.get(draft.slug);
    if (current && current.reviewed === true) {
      continue;
    }
    bySlug.set(draft.slug, draft);
  }

  const merged: BreedGuideRow[] = [];
  for (const slug of order) {
    const row = bySlug.get(slug);
    if (row) {
      merged.push(row);
    }
  }
  return merged;
}
