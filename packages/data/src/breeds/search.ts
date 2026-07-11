import type { Breed, BreedSpecies } from "./schema";
import { catBreeds, dogBreeds } from "./index";

/**
 * Strips accents, lowercases, collapses everything that isn't `[a-z0-9]`
 * into single spaces, and trims. Used for both the query and breed names so
 * comparisons are diacritic- and punctuation-insensitive.
 */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Standard Levenshtein edit distance, hand-rolled (no dependency). */
export function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) {
    dp[i]![0] = i;
  }
  for (let j = 0; j < cols; j += 1) {
    dp[0]![j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }

  return dp[rows - 1]![cols - 1]!;
}

const DEFAULT_LIMIT = 20;

/**
 * Tiered breed matcher: exact > prefix (whole-name or token) > initials >
 * substring > levenshtein fuzzy. Empty `q` returns the entire species pool,
 * sorted A→Z, uncapped (it doubles as the breed-picker source).
 */
export function searchBreeds(species: BreedSpecies, q: string, limit = DEFAULT_LIMIT): Breed[] {
  const pool = species === "DOG" ? dogBreeds : catBreeds;
  const nq = normalize(q);

  if (nq === "") {
    return [...pool].sort((a, b) => a.name.localeCompare(b.name));
  }

  const threshold = nq.length <= 3 ? 1 : 2;

  const ranked: Array<{ breed: Breed; tier: number }> = [];

  for (const breed of pool) {
    const norm = normalize(breed.name);
    const tokens = norm.split(" ").filter((t) => t.length > 0);
    const initials = tokens.map((t) => t[0]).join("");

    let tier: number | null = null;

    if (norm === nq) {
      tier = 0;
    } else if (norm.startsWith(nq) || tokens.some((t) => t.startsWith(nq))) {
      tier = 1;
    } else if (initials === nq || initials.startsWith(nq)) {
      tier = 2;
    } else if (norm.includes(nq)) {
      tier = 3;
    } else {
      const best = Math.min(levenshtein(nq, norm), ...tokens.map((t) => levenshtein(nq, t)));
      if (best <= threshold) {
        tier = 4;
      }
    }

    if (tier !== null) {
      ranked.push({ breed, tier });
    }
  }

  ranked.sort((a, b) => {
    if (a.tier !== b.tier) {
      return a.tier - b.tier;
    }
    if (a.breed.name.length !== b.breed.name.length) {
      return a.breed.name.length - b.breed.name.length;
    }
    return a.breed.name.localeCompare(b.breed.name);
  });

  return ranked.slice(0, limit).map((r) => r.breed);
}
