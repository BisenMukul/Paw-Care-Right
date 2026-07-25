import {
  breedGuideRowSchema,
  catBreeds,
  dogBreeds,
  TOP_CAT_BREED_GUIDE_SLUGS,
  TOP_DOG_BREED_GUIDE_SLUGS,
  VET_PROMPT_PREFIX,
  type Breed,
  type BreedGuideRow,
  type ExerciseLevel,
  type SizeClass,
} from "@pawcareright/data";

import { scanUnsafeText } from "../evals/detector";
import { FakeTextProvider } from "../providers/fake";

import { buildTemplateDraft, draftBreedGuideRow, mergeBreedGuides, parseProviderDraft } from "./breed-guide-draft";

function findBreed(slug: string, breeds: readonly Breed[]): Breed {
  const breed = breeds.find((b) => b.slug === slug);
  if (!breed) {
    throw new Error(`test fixture: breed "${slug}" not found`);
  }
  return breed;
}

const PINNED_BREEDS: Breed[] = [
  ...TOP_DOG_BREED_GUIDE_SLUGS.map((slug) => findBreed(slug, dogBreeds)),
  ...TOP_CAT_BREED_GUIDE_SLUGS.map((slug) => findBreed(slug, catBreeds)),
];

function makeBreed(overrides: Partial<Breed> & Pick<Breed, "species" | "sizeClass">): Breed {
  return {
    slug: "test-breed",
    name: "Test Breed",
    typicalAdultWeightKg: { min: 5, max: 10 },
    ...overrides,
  };
}

describe("buildTemplateDraft", () => {
  it.each(PINNED_BREEDS.map((breed) => [breed.species, breed.slug, breed] as const))(
    "yields a schema-valid reviewed:false row for %s/%s",
    (_species, _slug, breed) => {
      const row = buildTemplateDraft(breed);
      expect(() => breedGuideRowSchema.parse(row)).not.toThrow();
      expect(row.reviewed).toBe(false);
      expect(row.provenance.generatedBy).toBe("TEMPLATE");
    },
  );

  it("is deterministic", () => {
    const breed = PINNED_BREEDS[0];
    if (!breed) throw new Error("fixture: no pinned breed");
    expect(buildTemplateDraft(breed)).toEqual(buildTemplateDraft(breed));
  });

  describe("exercise level follows the pinned size mapping", () => {
    const dogCases: Array<[SizeClass, ExerciseLevel]> = [
      ["TOY", "MODERATE"],
      ["SMALL", "MODERATE"],
      ["MEDIUM", "HIGH"],
      ["LARGE", "HIGH"],
      ["GIANT", "MODERATE"],
      ["UNKNOWN", "MODERATE"],
    ];

    it.each(dogCases)("DOG size %s -> level %s", (sizeClass, expectedLevel) => {
      const breed = makeBreed({ species: "DOG", sizeClass });
      expect(buildTemplateDraft(breed).exerciseNeeds.level).toBe(expectedLevel);
    });

    it.each(["TOY", "SMALL", "MEDIUM", "LARGE", "GIANT", "UNKNOWN"] as SizeClass[])(
      "CAT size %s -> level MODERATE",
      (sizeClass) => {
        const breed = makeBreed({ species: "CAT", sizeClass });
        expect(buildTemplateDraft(breed).exerciseNeeds.level).toBe("MODERATE");
      },
    );
  });
});

// ---- parseProviderDraft ---------------------------------------------------

function validDraftJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: "model-echoed-slug",
    temperament:
      "This is a calm, biddable companion that thrives on a predictable routine and early socialisation.",
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
    ...overrides,
  };
}

describe("parseProviderDraft", () => {
  const breed = findBreed("labrador-retriever", dogBreeds);

  it("accepts a well-formed fenced-JSON response", () => {
    const raw = "```json\n" + JSON.stringify(validDraftJson()) + "\n```";
    const outcome = parseProviderDraft(raw, breed, "test-model");

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.row.slug).toBe(breed.slug);
    }
  });

  it("rejects unparsable output", () => {
    const outcome = parseProviderDraft("this is not JSON at all", breed, "test-model");
    expect(outcome).toEqual({ ok: false, reason: "unparsable" });
  });

  it("rejects schema-invalid output", () => {
    const raw = JSON.stringify({ temperament: "too short" });
    const outcome = parseProviderDraft(raw, breed, "test-model");
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe("schema");
    }
  });

  it("rejects a draft containing dosage language", () => {
    const unsafeNarrative =
      "Give 5mg per kg twice daily to keep the coat calm and shiny; brush after breakfast time.";
    expect(scanUnsafeText(unsafeNarrative).length).toBeGreaterThan(0);

    const raw = JSON.stringify(
      validDraftJson({ groomingCadence: { frequency: "WEEKLY", narrative: unsafeNarrative } }),
    );
    const outcome = parseProviderDraft(raw, breed, "test-model");

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe("unsafe");
      expect(outcome.findings?.length).toBeGreaterThan(0);
    }
  });

  it("forces reviewed:false even when the model claims reviewed: true", () => {
    const raw = JSON.stringify(
      validDraftJson({
        reviewed: true,
        provenance: { generatedBy: "HUMAN", reviewedBy: "fake-vet", reviewedAt: "2020-01-01" },
      }),
    );
    const outcome = parseProviderDraft(raw, breed, "test-model");

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.row.reviewed).toBe(false);
      expect(outcome.row.provenance.reviewedBy).toBeUndefined();
      expect(outcome.row.provenance.reviewedAt).toBeUndefined();
    }
  });

  it("forces provenance.generatedBy: 'PROVIDER' + the passed model, discarding model-supplied provenance", () => {
    const raw = JSON.stringify(
      validDraftJson({ provenance: { generatedBy: "HUMAN", model: "not-the-real-model" } }),
    );
    const outcome = parseProviderDraft(raw, breed, "real-model-name");

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.row.provenance.generatedBy).toBe("PROVIDER");
      expect(outcome.row.provenance.model).toBe("real-model-name");
    }
  });
});

// ---- draftBreedGuideRow ----------------------------------------------------

describe("draftBreedGuideRow", () => {
  const breed = findBreed("labrador-retriever", dogBreeds);

  it("uses the template draft when no provider is given", async () => {
    const result = await draftBreedGuideRow(breed, undefined, "unused");
    expect(result.source).toBe("template");
    expect(result.row).toEqual(buildTemplateDraft(breed));
  });

  it("uses the provider draft when the provider returns a valid response", async () => {
    const provider = new FakeTextProvider({
      canned: { text: JSON.stringify(validDraftJson()), model: "fake-eval-provider", usage: { latencyMs: 1 } },
    });
    const result = await draftBreedGuideRow(breed, provider, "fake-eval-provider");
    expect(result.source).toBe("provider");
    expect(result.row.provenance.generatedBy).toBe("PROVIDER");
  });

  it("a provider that throws is not fatal — falls back to the template draft", async () => {
    const provider = new FakeTextProvider({ script: [] });
    const result = await draftBreedGuideRow(breed, provider, "fake-eval-provider");

    expect(result.source).toBe("template");
    expect(result.rejectedReason).toBe("provider_error");
    expect(result.row).toEqual(buildTemplateDraft(breed));
  });
});

// ---- mergeBreedGuides -------------------------------------------------------

describe("mergeBreedGuides", () => {
  const reviewedRow: BreedGuideRow = {
    ...buildTemplateDraft(findBreed("labrador-retriever", dogBreeds)),
    reviewed: true,
    provenance: { generatedBy: "HUMAN", reviewedBy: "content-editor", reviewedAt: "2026-01-01" },
  };

  it("never overwrites a reviewed:true row", () => {
    const draft = buildTemplateDraft(findBreed("labrador-retriever", dogBreeds));
    const differentDraft: BreedGuideRow = { ...draft, temperament: "A completely different draft temperament string that is long enough." };
    expect(differentDraft.temperament).not.toBe(reviewedRow.temperament);

    const merged = mergeBreedGuides([reviewedRow], [differentDraft]);
    expect(merged).toEqual([reviewedRow]);
  });

  it("replaces a reviewed:false row", () => {
    const existingDraft = buildTemplateDraft(findBreed("golden-retriever", dogBreeds));
    const incomingDraft: BreedGuideRow = {
      ...existingDraft,
      temperament: "A completely different draft temperament string that is long enough to pass schema.",
    };

    const merged = mergeBreedGuides([existingDraft], [incomingDraft]);
    expect(merged).toEqual([incomingDraft]);
  });

  it("is idempotent and preserves the pinned order with unique slugs", () => {
    const drafts = [
      buildTemplateDraft(findBreed("labrador-retriever", dogBreeds)),
      buildTemplateDraft(findBreed("golden-retriever", dogBreeds)),
      buildTemplateDraft(findBreed("german-shepherd", dogBreeds)),
    ];

    const firstMerge = mergeBreedGuides([], drafts);
    const secondMerge = mergeBreedGuides(firstMerge, drafts);

    expect(secondMerge).toEqual(firstMerge);
    expect(firstMerge.map((row) => row.slug)).toEqual(drafts.map((row) => row.slug));
    expect(new Set(firstMerge.map((row) => row.slug)).size).toBe(drafts.length);
  });
});
