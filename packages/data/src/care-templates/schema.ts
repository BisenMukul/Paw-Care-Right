import { z } from "zod";
import { rruleSchema, reminderTypeSchema, speciesSchema, type ReminderType } from "@pawcareright/types";

import { slugSchema } from "../breeds/schema";

/**
 * Care template schema (T054 plan). §5-adjacent veterinary content — see the
 * plan's "Safety statement" and CLAUDE.md §7. `careTemplateItemSchema`
 * structurally forbids shipping a note without the pinned
 * `VET_CONFIRM_SENTENCE` (Decision R4); there is no path that skips it.
 */

export const TEMPLATE_CATEGORIES = ["vaccine", "deworming", "flea-tick", "dental", "grooming"] as const;
export const templateCategorySchema = z.enum(TEMPLATE_CATEGORIES);
export type TemplateCategory = z.infer<typeof templateCategorySchema>;

export const TEMPLATE_ANCHORS = ["PET_AGE", "PLAN_START"] as const;
export const templateAnchorSchema = z.enum(TEMPLATE_ANCHORS);
export type TemplateAnchor = z.infer<typeof templateAnchorSchema>;

export const PROTOCOL_GROUPS = ["NA", "EU", "UK", "IN", "BR", "MENA", "SEA", "AU", "DEFAULT"] as const;
export const protocolGroupSchema = z.enum(PROTOCOL_GROUPS);
export type ProtocolGroup = z.infer<typeof protocolGroupSchema>;

export const LIFE_STAGES = ["PUPPY_KITTEN", "ADULT", "SENIOR"] as const;
export const lifeStageSchema = z.enum(LIFE_STAGES);
export type LifeStage = z.infer<typeof lifeStageSchema>;

/** Pinned user-facing sentence every item note MUST include (Decision R4). */
export const VET_CONFIRM_SENTENCE = "Confirm the right timing and products for your pet with your veterinarian.";

/**
 * Enforces R4 structurally: a note missing the pinned sentence fails to
 * parse. Exported for reuse by T059 snapshot tests (per the plan).
 */
export const noteWithVetConfirmSchema = z
  .string()
  .min(1)
  .max(600)
  .refine((value) => value.includes(VET_CONFIRM_SENTENCE), {
    message: "note must include VET_CONFIRM_SENTENCE",
  });

export const careTemplateItemSchema = z.strictObject({
  id: slugSchema, // unique within a resolved pack (asserted by the meta-test)
  category: templateCategorySchema,
  title: z.string().min(1).max(120), // plain language, no brand names, no dosing
  note: noteWithVetConfirmSchema,
  rrule: rruleSchema, // validated by parseRRule (@pawcareright/types)
  anchor: templateAnchorSchema,
  startOffsetDays: z.number().int().min(0),
  emphasis: z.boolean().default(false), // true = region strongly emphasizes (e.g. rabies in IN)
});

/** Fully-resolved item shape, post-parse (`emphasis` defaulted). */
export type CareTemplateItem = z.infer<typeof careTemplateItemSchema>;
/** Authoring shape for the data files (`emphasis` may be omitted). */
export type CareTemplateItemInput = z.input<typeof careTemplateItemSchema>;

export const CATEGORY_TO_REMINDER_TYPE: Record<TemplateCategory, ReminderType> = {
  vaccine: "VACCINE",
  deworming: "PARASITE",
  "flea-tick": "PARASITE",
  dental: "DENTAL",
  grooming: "GROOMING",
};

// Re-exported so callers of this module don't need a second import from
// `@pawcareright/types` just to type a `species`/`reminderType` field.
export { reminderTypeSchema, speciesSchema };
