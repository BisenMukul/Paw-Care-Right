import { findToxinEntry, normalizeItem } from "@pawcareright/data";
import { FOOD_SAFETY_FALLBACK, parseFoodSafetyAnswer, type FoodVerdict, type Species } from "@pawcareright/types";

import { extractJsonCandidate } from "../triage/extract-json";
import { foodCacheKey } from "./cache";
import { buildFoodSafetyPrompt } from "./prompt";
import type { FoodSafetyDeps, FoodSafetyResult } from "./types";

/** Explicit typed map — `Species` is `"DOG" | "CAT"`, not lowercase-able by `.toLowerCase()` alone (plan trap). */
const SPECIES_VERDICT_KEY: Record<Species, "dog" | "cat"> = { DOG: "dog", CAT: "cat" };

/**
 * Provider-injected food/toxin lookup orchestration (T035): curated dataset
 * hit -> cache hit -> AI answer (caution-floored + cached) -> frozen
 * `FOOD_SAFETY_FALLBACK` (not cached). NEVER throws (Decision R6) and NEVER
 * returns unvalidated AI data — the returned verdict/note is always either a
 * dataset row, a `parseFoodSafetyAnswer`-validated answer, or the exact
 * `FOOD_SAFETY_FALLBACK` constant (plan R5/R6, §5 rule 2 / CLAUDE §7 rule 5).
 */
export async function checkFoodSafety(
  species: Species,
  rawItem: string,
  deps: FoodSafetyDeps,
): Promise<FoodSafetyResult> {
  const normalizedItem = normalizeItem(rawItem);

  // 1. Dataset hit bypasses the cache entirely (Decision R7).
  const entry = findToxinEntry(rawItem);
  if (entry) {
    return {
      source: "DATASET",
      species,
      item: normalizedItem,
      verdict: entry.verdicts[SPECIES_VERDICT_KEY[species]],
      note: entry.note,
      ...(entry.quantityNuance !== undefined ? { quantityNuance: entry.quantityNuance } : {}),
      cached: false,
    };
  }

  const key = foodCacheKey(species, normalizedItem);

  // 2. Cache hit (an earlier AI answer for this species+item).
  const cached = await deps.cache.get(key);
  if (cached) {
    return {
      source: "AI",
      species,
      item: normalizedItem,
      verdict: cached.verdict,
      note: cached.note,
      cached: true,
    };
  }

  // 3. Miss -> ask the provider, validate, caution-floor, cache.
  try {
    const built = buildFoodSafetyPrompt(species, rawItem);
    const res = await deps.provider.generate({
      system: built.system,
      messages: built.messages,
      temperature: built.temperature,
    });

    const parsed = parseFoodSafetyAnswer(extractJsonCandidate(res.text));
    if (!parsed.ok) {
      // Schema-invalid AI output: frozen fallback, NOT cached (Decision R6).
      return {
        source: "FALLBACK",
        species,
        item: normalizedItem,
        verdict: FOOD_SAFETY_FALLBACK.verdict,
        note: FOOD_SAFETY_FALLBACK.note,
        cached: false,
      };
    }

    // A model must never be able to surface `safe` for an unknown item (Decision R5).
    const verdict: FoodVerdict = parsed.result.verdict === "safe" ? "caution" : parsed.result.verdict;
    const answer = { verdict, note: parsed.result.note };

    await deps.cache.set(key, answer);

    return {
      source: "AI",
      species,
      item: normalizedItem,
      verdict: answer.verdict,
      note: answer.note,
      cached: false,
    };
  } catch {
    // Provider threw: frozen fallback, NOT cached (Decision R6). Service NEVER throws.
    return {
      source: "FALLBACK",
      species,
      item: normalizedItem,
      verdict: FOOD_SAFETY_FALLBACK.verdict,
      note: FOOD_SAFETY_FALLBACK.note,
      cached: false,
    };
  }
}
