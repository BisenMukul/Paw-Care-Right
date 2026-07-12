import type { FoodVerdict } from "@pawcareright/types";

import type { ToxinRow } from "./schema";
import { toxins } from "./index";

/**
 * Strips accents, lowercases, drops apostrophes, and collapses everything
 * that isn't `[a-z0-9]` into single spaces, then trims (mirrors
 * `packages/data/src/breeds/search.ts` `normalize`, plan R10).
 */
export function normalizeItem(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Strips a trailing plural from a single lowercase token (best-effort, hand-rolled). */
function singularizeToken(token: string): string {
  if (token.length <= 3) {
    return token;
  }
  if (token.endsWith("ies")) {
    return `${token.slice(0, -3)}y`;
  }
  if (/[sxz]es$/.test(token) || /[cs]hes$/.test(token)) {
    return token.slice(0, -2);
  }
  if (token.endsWith("ss")) {
    return token;
  }
  if (token.endsWith("s")) {
    return token.slice(0, -1);
  }
  return token;
}

/** Applies `singularizeToken` to every whitespace-separated token in a normalized string. */
export function singularize(normalized: string): string {
  return normalized
    .split(" ")
    .filter((token) => token.length > 0)
    .map(singularizeToken)
    .join(" ");
}

/**
 * A small curated map of high-frequency misspellings/brand names that are
 * not already carried as an `aliases[]` entry on the relevant row. Maps a
 * normalized+singularized key to another normalized+singularized key already
 * present in the alias index (plan R10 — hand-rolled, no NLP dependency).
 */
const COMMON_MISSPELLINGS: Readonly<Record<string, string>> = Object.freeze({
  avacado: "avocado",
  tylenal: "acetaminophen",
  ibuprofin: "ibuprofen",
  asprin: "aspirin",
});

function buildKeysFor(text: string): string[] {
  const normalized = normalizeItem(text);
  if (normalized.length === 0) {
    return [];
  }
  const keys = new Set<string>([normalized, singularize(normalized)]);
  return [...keys];
}

/** `Map<normalizedKey, id>` built once from every row's name, id, and aliases. */
function buildAliasIndex(): Map<string, string> {
  const index = new Map<string, string>();

  for (const row of toxins) {
    const keys = new Set<string>();
    buildKeysFor(row.name).forEach((k) => keys.add(k));
    buildKeysFor(row.id.replace(/-/g, " ")).forEach((k) => keys.add(k));
    row.aliases.forEach((alias) => buildKeysFor(alias).forEach((k) => keys.add(k)));

    for (const key of keys) {
      index.set(key, row.id);
    }
  }

  return index;
}

const ALIAS_INDEX: Map<string, string> = buildAliasIndex();
const TOXIN_BY_ID: Map<string, ToxinRow> = new Map(toxins.map((row) => [row.id, row]));

/** Looks up the dataset row for a free-text item name. Returns `undefined` on a miss. */
export function findToxinEntry(rawItem: string): ToxinRow | undefined {
  const key = singularize(normalizeItem(rawItem));
  if (key.length === 0) {
    return undefined;
  }

  const directId = ALIAS_INDEX.get(key);
  if (directId) {
    return TOXIN_BY_ID.get(directId);
  }

  const correctedKey = COMMON_MISSPELLINGS[key];
  if (correctedKey) {
    const correctedId = ALIAS_INDEX.get(correctedKey);
    if (correctedId) {
      return TOXIN_BY_ID.get(correctedId);
    }
  }

  return undefined;
}

/** Looks up the per-species verdict for a free-text item name. Returns `undefined` on a miss. */
export function toxinVerdictFor(species: "DOG" | "CAT", rawItem: string): FoodVerdict | undefined {
  const entry = findToxinEntry(rawItem);
  if (!entry) {
    return undefined;
  }
  return species === "DOG" ? entry.verdicts.dog : entry.verdicts.cat;
}
