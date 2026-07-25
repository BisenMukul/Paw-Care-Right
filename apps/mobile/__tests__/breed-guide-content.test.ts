import { getBreedGuide, publishedBreedGuides } from "@pawcareright/data";

import {
  guideRouteParams,
  listPublishedBreedGuides,
  parseSpeciesParam,
  resolveBreedGuideEntry,
  resolveBreedGuideForPet,
} from "../src/content/breed-guide-content";

/**
 * T087 plan (AC1) — resolver/list/param helper unit tests. Every lookup
 * goes through the published-only accessors (`getBreedGuide`,
 * `publishedBreedGuides`); a draft breed (`DOG/beagle`) must never resolve
 * anywhere in this module (safety statement 4).
 */
describe("listPublishedBreedGuides", () => {
  it("lists exactly the five published exemplars, DOG group before CAT, A→Z within group", () => {
    const pairs = listPublishedBreedGuides().map((e) => `${e.guide.species}/${e.guide.slug}`);
    expect(pairs).toEqual([
      "DOG/german-shepherd",
      "DOG/golden-retriever",
      "DOG/labrador-retriever",
      "CAT/maine-coon",
      "CAT/persian",
    ]);
  });

  it("parity: every published guide resolves a display name", () => {
    expect(listPublishedBreedGuides().length).toBe(publishedBreedGuides.length);
  });
});

describe("resolveBreedGuideEntry / resolveBreedGuideForPet", () => {
  it("a draft slug never resolves", () => {
    expect(resolveBreedGuideEntry("DOG", "beagle")).toBeNull();
    expect(resolveBreedGuideForPet("DOG", "beagle")).toBeNull();
  });

  it("lookup is species-scoped", () => {
    expect(resolveBreedGuideEntry("CAT", "labrador-retriever")).toBeNull();
    expect(resolveBreedGuideEntry("DOG", "labrador-retriever")).not.toBeNull();
  });

  it("no breed slug ⇒ no guide", () => {
    expect(resolveBreedGuideForPet("DOG", null)).toBeNull();
    expect(resolveBreedGuideForPet("DOG", "")).toBeNull();
  });

  it("resolves a known published pair with a breed name attached", () => {
    const entry = resolveBreedGuideEntry("DOG", "labrador-retriever");
    expect(entry).not.toBeNull();
    expect(entry?.guide).toBe(getBreedGuide("DOG", "labrador-retriever"));
    expect(entry?.breedName.length).toBeGreaterThan(0);
  });
});

describe("parseSpeciesParam", () => {
  it("accepts lower/upper-case dog and cat", () => {
    expect(parseSpeciesParam("dog")).toBe("DOG");
    expect(parseSpeciesParam("DOG")).toBe("DOG");
    expect(parseSpeciesParam("cat")).toBe("CAT");
    expect(parseSpeciesParam("CAT")).toBe("CAT");
  });

  it("rejects anything else, including undefined", () => {
    expect(parseSpeciesParam("hamster")).toBeNull();
    expect(parseSpeciesParam(undefined)).toBeNull();
    expect(parseSpeciesParam("")).toBeNull();
  });
});

describe("guideRouteParams", () => {
  it("builds lowercase-species route params from a guide entry", () => {
    const entry = resolveBreedGuideEntry("DOG", "labrador-retriever");
    expect(entry).not.toBeNull();
    if (entry) {
      expect(guideRouteParams(entry)).toEqual({ species: "dog", slug: "labrador-retriever" });
    }
  });
});
