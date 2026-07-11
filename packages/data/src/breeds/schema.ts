import { z } from "zod";

export const SIZE_CLASSES = ["TOY", "SMALL", "MEDIUM", "LARGE", "GIANT", "UNKNOWN"] as const;
export const sizeClassSchema = z.enum(SIZE_CLASSES);
export type SizeClass = z.infer<typeof sizeClassSchema>;

// Kept local to `packages/data` (a leaf package with no dependency on
// `packages/types`) even though the same two values also live as Prisma's
// `Species` enum and `packages/types`' `speciesSchema` — see plan risk #3.
export const BREED_SPECIES = ["DOG", "CAT"] as const;
export const breedSpeciesSchema = z.enum(BREED_SPECIES);
export type BreedSpecies = z.infer<typeof breedSpeciesSchema>;

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case");

/** Shape as stored in the JSON files — species is implied by the file, not repeated per row. */
export const breedRowSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1),
  sizeClass: sizeClassSchema,
  typicalAdultWeightKg: z
    .object({
      min: z.number().positive(),
      max: z.number().positive(),
    })
    .refine((w) => w.max >= w.min, { message: "max must be >= min" }),
});
export type BreedRow = z.infer<typeof breedRowSchema>;

/** Public, fully-resolved breed (species attached by the loader). */
export const breedSchema = breedRowSchema.extend({ species: breedSpeciesSchema });
export type Breed = z.infer<typeof breedSchema>;
