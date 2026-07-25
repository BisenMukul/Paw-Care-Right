import type { BreedGuide, BreedSpecies } from "@pawcareright/data";
import { allBreeds, getBreedGuide, publishedBreedGuides } from "@pawcareright/data";

/**
 * T087 plan (in-app breed guide reader), step 4. Pure, no-React module — the
 * ONLY place app code may resolve a breed guide. Imports exclusively
 * `publishedBreedGuides` / `getBreedGuide` (both draft-safe) plus `allBreeds`
 * for display names (D7) from `@pawcareright/data`. The draft-inclusive
 * audit/tooling export from `@pawcareright/data` (the one that also carries
 * unreviewed guides) is FORBIDDEN here and everywhere else under
 * `apps/mobile/**` — safety statement 4, `breed-guide-safety.test.ts`
 * enforces this with a source-scan test.
 */

/** A published guide paired with its human-readable breed name (D7 — `BreedGuide` itself has no `name` field). */
export interface BreedGuideEntry {
  guide: BreedGuide;
  breedName: string;
}

function findBreedName(species: BreedSpecies, slug: string): string | null {
  const breed = allBreeds.find((row) => row.species === species && row.slug === slug);
  return breed === undefined ? null : breed.name;
}

function toEntry(guide: BreedGuide): BreedGuideEntry | null {
  const breedName = findBreedName(guide.species, guide.slug);
  if (breedName === null) {
    return null;
  }
  return { guide, breedName };
}

/**
 * Resolves a pet's own breed guide, if one is published. Returns `null` for
 * a missing/empty `breedSlug`, an unreviewed draft, an unknown slug, or a
 * published guide whose slug has no matching breed row (D7 parity).
 */
export function resolveBreedGuideForPet(species: BreedSpecies, breedSlug: string | null): BreedGuideEntry | null {
  if (breedSlug === null || breedSlug.length === 0) {
    return null;
  }
  return resolveBreedGuideEntry(species, breedSlug);
}

/** Same published-only lookup, keyed by route params (D2 — species-scoped, since slugs are unique only within a species). */
export function resolveBreedGuideEntry(species: BreedSpecies, slug: string): BreedGuideEntry | null {
  const guide = getBreedGuide(species, slug);
  if (guide === undefined) {
    return null;
  }
  return toEntry(guide);
}

/**
 * Every published guide with a resolvable display name, sorted DOG group
 * first then CAT group, A→Z by `breedName` within each group (AC1). The
 * parity test in `breed-guide-content.test.ts` pins
 * `listPublishedBreedGuides().length === publishedBreedGuides.length` so a
 * guide silently losing its breed row would fail the build (D7/R7).
 */
export function listPublishedBreedGuides(): BreedGuideEntry[] {
  const entries = publishedBreedGuides
    .map(toEntry)
    .filter((entry): entry is BreedGuideEntry => entry !== null);

  const speciesRank: Record<BreedSpecies, number> = { DOG: 0, CAT: 1 };

  return [...entries].sort((a, b) => {
    const rankDiff = speciesRank[a.guide.species] - speciesRank[b.guide.species];
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return a.breedName.localeCompare(b.breedName);
  });
}

/** `"dog"`/`"DOG"` -> `"DOG"`, `"cat"`/`"CAT"` -> `"CAT"`, everything else -> `null` (route-param parsing, D2). */
export function parseSpeciesParam(raw: string | undefined): BreedSpecies | null {
  if (raw === undefined) {
    return null;
  }
  const upper = raw.toUpperCase();
  return upper === "DOG" || upper === "CAT" ? upper : null;
}

/** Builds the deep-link route params for a guide entry (D2) — the one place this shape is constructed, so the screen and every entry point stay in lockstep. */
export function guideRouteParams(entry: BreedGuideEntry): { species: string; slug: string } {
  return { species: entry.guide.species.toLowerCase(), slug: entry.guide.slug };
}
