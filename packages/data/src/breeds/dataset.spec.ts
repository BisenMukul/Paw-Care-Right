import { breedSchema } from "./schema";
import { allBreeds, catBreeds, dogBreeds } from "./index";

describe("breed dataset — counts", () => {
  it("has at least 300 dog breeds (target ~340)", () => {
    expect(dogBreeds.length).toBeGreaterThanOrEqual(300);
  });

  it("has at least 60 cat breeds (target ~70)", () => {
    expect(catBreeds.length).toBeGreaterThanOrEqual(60);
  });

  it("allBreeds is the concatenation of dogBreeds and catBreeds", () => {
    expect(allBreeds.length).toBe(dogBreeds.length + catBreeds.length);
  });
});

describe("breed dataset — schema validity", () => {
  it("every dog row parses under breedSchema", () => {
    expect(() => breedSchema.array().parse(dogBreeds)).not.toThrow();
  });

  it("every cat row parses under breedSchema", () => {
    expect(() => breedSchema.array().parse(catBreeds)).not.toThrow();
  });

  it("every row has a positive weight range with max >= min", () => {
    for (const breed of allBreeds) {
      expect(breed.typicalAdultWeightKg.min).toBeGreaterThan(0);
      expect(breed.typicalAdultWeightKg.max).toBeGreaterThan(0);
      expect(breed.typicalAdultWeightKg.max).toBeGreaterThanOrEqual(
        breed.typicalAdultWeightKg.min,
      );
    }
  });
});

describe("breed dataset — uniqueness", () => {
  it("dog slugs are unique", () => {
    const slugs = dogBreeds.map((b) => b.slug);
    expect(new Set(slugs).size).toBe(dogBreeds.length);
  });

  it("cat slugs are unique", () => {
    const slugs = catBreeds.map((b) => b.slug);
    expect(new Set(slugs).size).toBe(catBreeds.length);
  });
});

describe("breed dataset — mixed-unknown", () => {
  it("is present in dogBreeds with sizeClass UNKNOWN", () => {
    const row = dogBreeds.find((b) => b.slug === "mixed-unknown");
    expect(row).toBeDefined();
    expect(row?.sizeClass).toBe("UNKNOWN");
  });

  it("is present in catBreeds with sizeClass UNKNOWN", () => {
    const row = catBreeds.find((b) => b.slug === "mixed-unknown");
    expect(row).toBeDefined();
    expect(row?.sizeClass).toBe("UNKNOWN");
  });
});

describe("breed dataset — German Shepherd (gsd initials source row)", () => {
  it("the german-shepherd row is named exactly 'German Shepherd Dog'", () => {
    const row = dogBreeds.find((b) => b.slug === "german-shepherd");
    expect(row).toBeDefined();
    expect(row?.name).toBe("German Shepherd Dog");
  });
});
