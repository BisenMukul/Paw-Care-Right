import { z } from "zod";

import { reminderTypeSchema } from "./reminder";
import { speciesSchema } from "./pet";

/**
 * Shared shapes for T059's care-plan setup wizard: the read-only
 * suggestions the server resolves from the care-template pack, and the
 * additive `selections` extension to the existing `from-template`
 * instantiation body (plan decisions 1-2).
 *
 * `lifeStage`/`group` are typed as `z.string()` rather than importing
 * `@pawcareright/data`'s `LifeStage`/`ProtocolGroup` enums, deliberately —
 * `packages/data` already depends on `@pawcareright/types` (see
 * `packages/data/src/care-templates/schema.ts`), so importing it back here
 * would introduce a `types` <-> `data` cycle (plan Risk 5).
 */

export const careTemplateSuggestionItemSchema = z.object({
  templateKey: z.string().min(1),
  title: z.string().min(1),
  note: z.string().min(1),
  reminderType: reminderTypeSchema,
  defaultStartAt: z.iso.datetime().nullable(),
  emphasis: z.boolean(),
  alreadyExists: z.boolean(),
});

export type CareTemplateSuggestionItem = z.infer<typeof careTemplateSuggestionItemSchema>;

export const careTemplateSuggestionsSchema = z.object({
  species: speciesSchema,
  lifeStage: z.string(),
  group: z.string(),
  items: z.array(careTemplateSuggestionItemSchema),
});

export type CareTemplateSuggestions = z.infer<typeof careTemplateSuggestionsSchema>;

export const templateSelectionSchema = z.object({
  templateKey: z.string().min(1),
  startAt: z.iso.datetime().optional(),
});

export type TemplateSelection = z.infer<typeof templateSelectionSchema>;

export const instantiateFromTemplateInputSchema = z.object({
  timezone: z.string().min(1),
  group: z.string().optional(),
  countryCode: z.string().optional(),
  selections: z.array(templateSelectionSchema).optional(),
});

export type InstantiateFromTemplateInput = z.infer<typeof instantiateFromTemplateInputSchema>;

/**
 * Narrow read projection of the api's `InstantiateTemplateResponse` (a
 * structural superset — the api's `created` rows carry more fields than
 * this schema requires).
 */
export const instantiateFromTemplateResultSchema = z.object({
  created: z.array(
    z.object({
      id: z.string(),
      templateKey: z.string().optional(),
      title: z.string(),
    }),
  ),
  skipped: z.number().int(),
});

export type InstantiateFromTemplateResult = z.infer<typeof instantiateFromTemplateResultSchema>;
