import type { BreedSpecies } from "../breeds/schema";

import catsRaw from "./cats.json";
import dogsRaw from "./dogs.json";
import { breedGuideSchema, type BreedGuide } from "./schema";

// Re-exported here (not from the top-level `src/index.ts`, which only gains
// the two lines the plan pins) so both this package's own tests and
// `packages/ai`'s cross-package tests can resolve the pinned slug lists via
// `@pawcareright/data` without a bespoke subpath export.
export * from "./top-breeds";

// Parsing at module load is the runtime validation layer; `breed-guides.spec.ts`
// is the build/test-time layer that additionally asserts counts/uniqueness/
// referential integrity (mirrors `packages/data/src/breeds/index.ts`). The
// `ReadonlyArray<Record<string, unknown>>` cast (rather than `any`) is needed
// because an empty-array JSON literal (`[]`, the step-3 stub) infers as
// `never[]`, which cannot be spread — the real, non-empty dataset (step 6)
// would not need it, but the cast is harmless and keeps the module compiling
// at every step.
const dogRows = dogsRaw as ReadonlyArray<Record<string, unknown>>;
const catRows = catsRaw as ReadonlyArray<Record<string, unknown>>;

const dogGuides: readonly BreedGuide[] = Object.freeze(
  dogRows.map((row) => breedGuideSchema.parse({ ...row, species: "DOG" })),
);
const catGuides: readonly BreedGuide[] = Object.freeze(
  catRows.map((row) => breedGuideSchema.parse({ ...row, species: "CAT" })),
);

/**
 * Every generated/authored guide (both `reviewed: true` and `reviewed: false`
 * drafts) — the explicitly-named audit/tooling export (plan D7). The AC3
 * detector lint must scan drafts too, and T105 needs the reviewed-flag
 * inventory. **Do not** render this array in-app; use `publishedBreedGuides`
 * or `getBreedGuide` instead.
 */
export const allBreedGuides: readonly BreedGuide[] = Object.freeze([...dogGuides, ...catGuides]);

/**
 * Only `reviewed: true` guides — the primary, app-safe export (plan D7 /
 * AC2). This is the data-layer half of "app renders only reviewed guides";
 * T087 (the in-app reader) must consume this or `getBreedGuide`, never
 * `allBreedGuides`.
 */
export const publishedBreedGuides: readonly BreedGuide[] = Object.freeze(
  allBreedGuides.filter((guide) => guide.reviewed),
);

/**
 * Resolves a published guide by `(species, slug)` (plan D2 — slugs are
 * unique only *within* a species, e.g. `mixed-unknown` exists in both breed
 * files). Returns `undefined` for an unreviewed draft or an unknown pair —
 * never exposes a draft, even to a caller that knows its slug.
 */
export function getBreedGuide(species: BreedSpecies, slug: string): BreedGuide | undefined {
  return publishedBreedGuides.find((guide) => guide.species === species && guide.slug === slug);
}
