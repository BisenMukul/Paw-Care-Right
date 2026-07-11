import { z } from "zod";

import { petIdSchema } from "./branded-ids";

export const SPECIES = ["DOG", "CAT"] as const;
export const speciesSchema = z.enum(SPECIES);
export type Species = z.infer<typeof speciesSchema>;

export const SEX = ["MALE", "FEMALE", "UNKNOWN"] as const;
export const sexSchema = z.enum(SEX);
export type Sex = z.infer<typeof sexSchema>;

/**
 * Shared field shape for create/update. Kept as a plain `ZodObject` (no
 * refinements attached) so `.partial()` can be derived from it for
 * `updatePetSchema` — zod v4 forbids calling `.partial()` on an object that
 * already carries a `.superRefine()` (see the XOR refinement below, applied
 * separately to each of `createPetSchema`/`updatePetSchema`).
 */
const petFieldsSchema = z.object({
  species: speciesSchema,
  name: z.string().min(1),
  sex: sexSchema.optional(),
  neutered: z.boolean().optional(),
  breedSlug: z.string().min(1).nullable().optional(),
  photoKey: z.string().min(1).nullable().optional(),
  birthDate: z.iso.datetime().nullable().optional(),
  ageEstimateMonths: z.number().int().min(0).nullable().optional(),
  weightGrams: z.number().int().min(0).nullable().optional(),
});

/**
 * Client-side UX guard mirroring the server-authoritative check
 * (`PetsService.assertAgeXor`): a pet's age is expressed as either a known
 * `birthDate` or a rough `ageEstimateMonths`, never both. The server remains
 * the source of truth — see plan Risk R3.
 */
function rejectBirthDateAndAgeBothSet(
  data: { birthDate?: string | null | undefined; ageEstimateMonths?: number | null | undefined },
  ctx: z.RefinementCtx,
): void {
  if (data.birthDate != null && data.ageEstimateMonths != null) {
    ctx.addIssue({
      code: "custom",
      message: "birthDate and ageEstimateMonths cannot both be set",
      path: ["ageEstimateMonths"],
    });
  }
}

export const createPetSchema = petFieldsSchema.superRefine(rejectBirthDateAndAgeBothSet);
export type CreatePetInput = z.infer<typeof createPetSchema>;

export const updatePetSchema = petFieldsSchema.partial().superRefine(rejectBirthDateAndAgeBothSet);
export type UpdatePetInput = z.infer<typeof updatePetSchema>;

/** Public resource shape returned by the API. No `deletedAt` — internal only. */
export const petSchema = z.object({
  id: petIdSchema,
  householdId: z.string().uuid(),
  species: speciesSchema,
  sex: sexSchema,
  name: z.string(),
  neutered: z.boolean(),
  breedSlug: z.string().nullable(),
  birthDate: z.iso.datetime().nullable(),
  ageEstimateMonths: z.number().int().nullable(),
  weightGrams: z.number().int().nullable(),
  photoKey: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Pet = z.infer<typeof petSchema>;
