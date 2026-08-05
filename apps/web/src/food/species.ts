// Species/segment descriptors for the programmatic `/can-{species}-eat/{item}`
// pages (T085). Two literal route directories exist (D2) — this module is the
// single place that maps a URL segment to the toxin dataset's verdict key and
// to the display strings used across the page model, copy and JSON-LD.

export interface SpeciesDescriptor {
  segment: "can-dogs-eat" | "can-cats-eat";
  verdictKey: "dog" | "cat"; // key into ToxinRow["verdicts"]
  plural: "dogs" | "cats"; // "Can dogs eat …?"
  singular: "dog" | "cat"; // "if my dog ate …"
  Plural: "Dogs" | "Cats";
}

const DOGS: SpeciesDescriptor = Object.freeze({
  segment: "can-dogs-eat",
  verdictKey: "dog",
  plural: "dogs",
  singular: "dog",
  Plural: "Dogs",
});

const CATS: SpeciesDescriptor = Object.freeze({
  segment: "can-cats-eat",
  verdictKey: "cat",
  plural: "cats",
  singular: "cat",
  Plural: "Cats",
});

/** Dogs first, then cats (D2/D9 — pinned order used by `allFoodPagePaths`). */
export const SPECIES_SEGMENTS: readonly SpeciesDescriptor["segment"][] = Object.freeze([
  DOGS.segment,
  CATS.segment,
]);

const BY_SEGMENT: ReadonlyMap<string, SpeciesDescriptor> = new Map([
  [DOGS.segment, DOGS],
  [CATS.segment, CATS],
]);

export function speciesBySegment(segment: string): SpeciesDescriptor | undefined {
  return BY_SEGMENT.get(segment);
}
