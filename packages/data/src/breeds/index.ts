import catsRaw from "./cats.json";
import dogsRaw from "./dogs.json";
import { breedSchema, type Breed } from "./schema";

// Parsing at module load is the runtime validation layer; `dataset.spec.ts`
// is the build/test-time layer that additionally asserts counts/uniqueness.
export const dogBreeds: readonly Breed[] = Object.freeze(
  dogsRaw.map((row) => breedSchema.parse({ ...row, species: "DOG" })),
);
export const catBreeds: readonly Breed[] = Object.freeze(
  catsRaw.map((row) => breedSchema.parse({ ...row, species: "CAT" })),
);
export const allBreeds: readonly Breed[] = Object.freeze([...dogBreeds, ...catBreeds]);
