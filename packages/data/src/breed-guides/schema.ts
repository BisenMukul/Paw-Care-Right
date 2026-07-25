import { z } from "zod";

import { breedSpeciesSchema, slugSchema } from "../breeds/schema";

/**
 * Breed hub content schema (T084 plan D1/D6). The dataset is static, curated
 * prose read in-app (T087), never an AI runtime output — its only safety
 * weight is what the words say, enforced structurally below plus the T038
 * detector lint over the full dataset (`breed-guides-safety.spec.ts`).
 */

/** Every awareness item's `prompt` must start with this exact string (plan safety statement 3). */
export const VET_PROMPT_PREFIX = "Talk to your vet about ";

export const EXERCISE_LEVELS = ["LOW", "MODERATE", "HIGH", "VERY_HIGH"] as const;
export const exerciseLevelSchema = z.enum(EXERCISE_LEVELS);
export type ExerciseLevel = z.infer<typeof exerciseLevelSchema>;

export const GROOMING_FREQUENCIES = ["DAILY", "SEVERAL_TIMES_WEEKLY", "WEEKLY", "MONTHLY"] as const;
export const groomingFrequencySchema = z.enum(GROOMING_FREQUENCIES);
export type GroomingFrequency = z.infer<typeof groomingFrequencySchema>;

/** Who/what produced a draft (plan safety statement 6/8). A model may never mark itself `HUMAN`. */
export const GENERATED_BY = ["TEMPLATE", "PROVIDER", "HUMAN"] as const;
export const generatedBySchema = z.enum(GENERATED_BY);
export type GeneratedBy = z.infer<typeof generatedBySchema>;

/**
 * A vet-conversation prompt, never a claim about the reader's pet. Enforced
 * structurally (not just by convention) so a schema-level mutation test
 * (AC1 "schema rejects an awareness prompt without the vet prefix") is
 * possible even though every shipped row already complies (plan M8 note).
 */
export const vetAwarenessPromptSchema = z
  .string()
  .min(VET_PROMPT_PREFIX.length + 10)
  .max(220)
  .refine((s) => s.startsWith(VET_PROMPT_PREFIX), { message: "must start with VET_PROMPT_PREFIX" });

// Base object kept separate from the cross-field `.refine` below so both
// `breedGuideRowSchema` (row shape) and `breedGuideSchema` (row + species,
// via `.extend`) can each apply the same invariant — `.extend` is not
// available on the `ZodEffects` a `.refine` call produces.
const breedGuideBaseRowSchema = z.strictObject({
  slug: slugSchema,
  temperament: z.string().min(40).max(400),
  exerciseNeeds: z.strictObject({
    level: exerciseLevelSchema,
    narrative: z.string().min(40).max(400),
  }),
  commonConditionAwareness: z
    .array(z.strictObject({ topic: z.string().min(3).max(60), prompt: vetAwarenessPromptSchema }))
    .min(2)
    .max(6),
  groomingCadence: z.strictObject({
    frequency: groomingFrequencySchema,
    narrative: z.string().min(40).max(400),
  }),
  reviewed: z.boolean(),
  provenance: z.strictObject({
    generatedBy: generatedBySchema,
    model: z.string().min(1).optional(),
    reviewedBy: z.string().min(1).optional(),
    reviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
});

/** reviewed === true  <=>  reviewedBy AND reviewedAt are both present (both directions). */
function reviewedImpliesProvenance(g: {
  reviewed: boolean;
  provenance: { reviewedBy?: string | undefined; reviewedAt?: string | undefined };
}): boolean {
  return g.reviewed === (g.provenance.reviewedBy !== undefined && g.provenance.reviewedAt !== undefined);
}
const reviewedProvenanceRefinement = {
  message: "reviewed must be true iff reviewedBy and reviewedAt are both present",
} as const;

export const breedGuideRowSchema = breedGuideBaseRowSchema.refine(
  reviewedImpliesProvenance,
  reviewedProvenanceRefinement,
);
export type BreedGuideRow = z.infer<typeof breedGuideRowSchema>;

/** Public, fully-resolved guide (species attached by the loader, mirrors `breedSchema`). */
export const breedGuideSchema = breedGuideBaseRowSchema
  .extend({ species: breedSpeciesSchema })
  .refine(reviewedImpliesProvenance, reviewedProvenanceRefinement);
export type BreedGuide = z.infer<typeof breedGuideSchema>;
