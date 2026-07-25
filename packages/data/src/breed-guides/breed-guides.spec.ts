import { catBreeds, dogBreeds } from "../breeds";

import catsRaw from "./cats.json";
import dogsRaw from "./dogs.json";
import { breedGuideRowSchema, VET_PROMPT_PREFIX, type BreedGuideRow } from "./schema";
import { TOP_CAT_BREED_GUIDE_SLUGS, TOP_DOG_BREED_GUIDE_SLUGS, TOP_BREED_GUIDE_COUNT } from "./top-breeds";
import { allBreedGuides, getBreedGuide, publishedBreedGuides } from "./index";

/** Minimal, schema-valid row used only to isolate one field per mutation-style unit assertion. */
function validRow(overrides: Partial<BreedGuideRow> = {}): unknown {
  return {
    slug: "test-breed",
    temperament: "A calm, biddable companion that thrives on a predictable daily routine and early socialisation.",
    exerciseNeeds: {
      level: "MODERATE",
      narrative: "Short daily walks plus a little play time suit most individuals of this size and energy.",
    },
    commonConditionAwareness: [
      {
        topic: "Routine wellness checks",
        prompt: `${VET_PROMPT_PREFIX}which routine wellness checks suit this pet's age, size and lifestyle.`,
      },
      {
        topic: "Weight and body condition",
        prompt: `${VET_PROMPT_PREFIX}a healthy weight range and body condition scoring for this pet.`,
      },
    ],
    groomingCadence: {
      frequency: "WEEKLY",
      narrative: "A weekly brushing session and a quick coat check keeps things comfortable between baths.",
    },
    reviewed: false,
    provenance: { generatedBy: "TEMPLATE" },
    ...overrides,
  };
}

describe("breed guide dataset — AC1 schema validity", () => {
  it("every dog row and every cat row parses under breedGuideRowSchema", () => {
    expect(() => breedGuideRowSchema.array().parse(dogsRaw)).not.toThrow();
    expect(() => breedGuideRowSchema.array().parse(catsRaw)).not.toThrow();
  });

  it("the loader attaches the right species to every guide", () => {
    const dogSlugs = new Set(dogsRaw.map((r) => r.slug));
    const catSlugs = new Set(catsRaw.map((r) => r.slug));

    for (const guide of allBreedGuides) {
      if (dogSlugs.has(guide.slug)) {
        expect(guide.species).toBe("DOG");
      }
      if (catSlugs.has(guide.slug)) {
        expect(guide.species).toBe("CAT");
      }
    }
  });

  it("counts: 50 guides — 38 dog, 12 cat", () => {
    expect(allBreedGuides.length).toBe(50);
    expect(allBreedGuides.filter((g) => g.species === "DOG").length).toBe(38);
    expect(allBreedGuides.filter((g) => g.species === "CAT").length).toBe(12);
    expect(TOP_BREED_GUIDE_COUNT).toBe(50);
  });

  it("(species, slug) pairs are unique", () => {
    const pairs = allBreedGuides.map((g) => `${g.species}/${g.slug}`);
    expect(new Set(pairs).size).toBe(allBreedGuides.length);
  });

  it("every guide slug exists in the T022 breeds dataset for that species", () => {
    const dogBreedSlugs = new Set(dogBreeds.map((b) => b.slug));
    const catBreedSlugs = new Set(catBreeds.map((b) => b.slug));

    for (const guide of allBreedGuides) {
      if (guide.species === "DOG") {
        expect(dogBreedSlugs.has(guide.slug)).toBe(true);
      } else {
        expect(catBreedSlugs.has(guide.slug)).toBe(true);
      }
    }
  });

  it("every pinned top slug has a guide, and every guide is a pinned top slug", () => {
    const guideDogSlugs = new Set(allBreedGuides.filter((g) => g.species === "DOG").map((g) => g.slug));
    const guideCatSlugs = new Set(allBreedGuides.filter((g) => g.species === "CAT").map((g) => g.slug));

    for (const slug of TOP_DOG_BREED_GUIDE_SLUGS) {
      expect(guideDogSlugs.has(slug)).toBe(true);
    }
    for (const slug of TOP_CAT_BREED_GUIDE_SLUGS) {
      expect(guideCatSlugs.has(slug)).toBe(true);
    }

    expect(guideDogSlugs.size).toBe(TOP_DOG_BREED_GUIDE_SLUGS.length);
    expect(guideCatSlugs.size).toBe(TOP_CAT_BREED_GUIDE_SLUGS.length);
    for (const slug of guideDogSlugs) {
      expect((TOP_DOG_BREED_GUIDE_SLUGS as readonly string[]).includes(slug)).toBe(true);
    }
    for (const slug of guideCatSlugs) {
      expect((TOP_CAT_BREED_GUIDE_SLUGS as readonly string[]).includes(slug)).toBe(true);
    }
  });

  it("no guide is mixed-unknown", () => {
    expect(allBreedGuides.some((g) => g.slug === "mixed-unknown")).toBe(false);
  });

  it("schema rejects an awareness prompt without the vet prefix", () => {
    const row = validRow({
      commonConditionAwareness: [
        { topic: "Routine wellness checks", prompt: "Your pet should see a vet about wellness checks soon." },
        { topic: "Weight", prompt: `${VET_PROMPT_PREFIX}a healthy weight range for this pet.` },
      ],
    } as Partial<BreedGuideRow>);

    expect(breedGuideRowSchema.safeParse(row).success).toBe(false);
  });

  it("schema rejects reviewed: true without reviewedBy/reviewedAt, and reviewed: false with them", () => {
    const reviewedWithoutProvenance = validRow({ reviewed: true, provenance: { generatedBy: "HUMAN" } });
    expect(breedGuideRowSchema.safeParse(reviewedWithoutProvenance).success).toBe(false);

    const unreviewedWithProvenance = validRow({
      reviewed: false,
      provenance: { generatedBy: "HUMAN", reviewedBy: "content-editor", reviewedAt: "2026-01-01" },
    });
    expect(breedGuideRowSchema.safeParse(unreviewedWithProvenance).success).toBe(false);
  });

  it("schema rejects an unknown extra field", () => {
    const row = validRow() as Record<string, unknown>;
    row.unexpectedField = "surprise";
    expect(breedGuideRowSchema.safeParse(row).success).toBe(false);
  });
});

describe("breed guide dataset — AC2 app renders only reviewed guides", () => {
  it("publishedBreedGuides contains only reviewed === true guides", () => {
    expect(publishedBreedGuides.every((g) => g.reviewed === true)).toBe(true);
  });

  it("publishedBreedGuides is exactly the 5 exemplars", () => {
    const pairs = publishedBreedGuides.map((g) => `${g.species}/${g.slug}`).sort();
    expect(pairs).toEqual(
      ["DOG/labrador-retriever", "DOG/golden-retriever", "DOG/german-shepherd", "CAT/maine-coon", "CAT/persian"].sort(),
    );
  });

  it("the dataset really does contain unreviewed drafts", () => {
    expect(allBreedGuides.length).toBe(50);
    expect(publishedBreedGuides.length).toBe(5);
  });

  it("getBreedGuide returns a guide for a reviewed pair", () => {
    expect(getBreedGuide("DOG", "labrador-retriever")).toBeDefined();
  });

  it("getBreedGuide returns undefined for an unreviewed pair", () => {
    expect(getBreedGuide("DOG", "beagle")).toBeUndefined();
  });

  it("getBreedGuide returns undefined for an unknown slug and for the right slug under the wrong species", () => {
    expect(getBreedGuide("DOG", "no-such-breed")).toBeUndefined();
    expect(getBreedGuide("CAT", "labrador-retriever")).toBeUndefined();
  });
});

describe("breed guide dataset — phrasing + honesty (§5/§7)", () => {
  it("every awareness prompt starts with VET_PROMPT_PREFIX", () => {
    for (const guide of allBreedGuides) {
      for (const item of guide.commonConditionAwareness) {
        expect(item.prompt.startsWith(VET_PROMPT_PREFIX)).toBe(true);
      }
    }
  });

  it("no awareness prompt contains treatment/likelihood language", () => {
    const forbidden = /\b(treat|cure|prescrib|medicat|dosage|dose|likely has|probably has|usually means)\b/i;
    for (const guide of allBreedGuides) {
      for (const item of guide.commonConditionAwareness) {
        expect(forbidden.test(item.prompt)).toBe(false);
      }
    }
  });

  it("no reviewedBy implies veterinary sign-off", () => {
    const vetLike = /vet|veterinar|dvm|\bdr\.?\b/i;
    for (const guide of allBreedGuides) {
      if (guide.provenance.reviewedBy !== undefined) {
        expect(vetLike.test(guide.provenance.reviewedBy)).toBe(false);
      }
    }
  });
});
