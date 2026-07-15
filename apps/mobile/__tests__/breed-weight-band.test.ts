import { resolveBreedBand } from "../src/weight/breed-weight-band";

// T065 plan — pure band-mapping AC, exercised against the real T022
// `@pawcareright/data` breed dataset (no fixture duplication).
describe("resolveBreedBand", () => {
  it("resolves a real dog breed's typical range to grams", () => {
    expect(resolveBreedBand("DOG", "labrador-retriever")).toEqual({
      minGrams: 25000,
      maxGrams: 36000,
      breedName: "Labrador Retriever",
    });
  });

  it("returns null when breedSlug is null", () => {
    expect(resolveBreedBand("DOG", null)).toBeNull();
  });

  it("returns null for an unknown slug", () => {
    expect(resolveBreedBand("DOG", "not-a-real-breed")).toBeNull();
  });

  it("returns null on a species mismatch (dog slug queried as CAT)", () => {
    expect(resolveBreedBand("CAT", "labrador-retriever")).toBeNull();
  });
});
