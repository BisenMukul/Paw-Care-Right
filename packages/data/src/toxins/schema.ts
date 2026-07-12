import { z } from "zod";
import { foodVerdictSchema } from "@pawcareright/types";

import { slugSchema } from "../breeds/schema";

export const TOXIN_CATEGORIES = [
  "human-food",
  "plant",
  "household-chemical",
  "human-med",
  "pest-bait",
  "other",
] as const;
export const toxinCategorySchema = z.enum(TOXIN_CATEGORIES);
export type ToxinCategory = z.infer<typeof toxinCategorySchema>;

/** Per-species verdict pair. Not `strictObject` per the plan's pinned contract. */
export const speciesVerdictsSchema = z.object({
  dog: foodVerdictSchema,
  cat: foodVerdictSchema,
});
export type SpeciesVerdicts = z.infer<typeof speciesVerdictsSchema>;

export const toxinRowSchema = z.strictObject({
  id: slugSchema, // kebab-case (from ../breeds/schema)
  name: z.string().min(1),
  category: toxinCategorySchema,
  verdicts: speciesVerdictsSchema,
  note: z.string().min(1).max(600), // qualitative, no dosing numbers
  quantityNuance: z.string().min(1).max(600).optional(),
  aliases: z.array(z.string().min(1)).default([]), // feeds the normalizer
});

/** Fully-resolved row shape, post-parse (`aliases` defaulted to `[]`). */
export type ToxinRow = z.infer<typeof toxinRowSchema>;

/** Authoring shape for the category data files (`aliases` may be omitted). */
export type ToxinRowInput = z.input<typeof toxinRowSchema>;
