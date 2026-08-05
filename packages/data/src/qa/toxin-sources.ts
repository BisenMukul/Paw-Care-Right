import type { ToxinCategory } from "../toxins/schema";

/**
 * T105 — per-category source registry. `ToxinRow` (toxins/schema.ts) has no
 * per-row source field; T035 decision R9 recorded sources once per category
 * as a file-header comment in each `packages/data/src/toxins/data/*.ts`
 * file. Per-row citation therefore does not exist — attribution here is
 * category-level only.
 *
 * The strings below are a **verbatim transcription** of each category
 * file's "Sources consulted" header comment (names only, no copied prose, no
 * URLs — T035 R9), transcribed by reading the files directly, not from
 * memory. `dataset-audit.spec.ts` (T1) asserts every registered source
 * string actually appears in the corresponding file's header, so this
 * registry cannot silently drift from the real header comments.
 */
export const TOXIN_SOURCE_FILES: Record<ToxinCategory, string> = {
  "human-food": "human-foods.ts",
  plant: "plants.ts",
  "household-chemical": "household-chemicals.ts",
  "human-med": "human-meds.ts",
  "pest-bait": "pest-baits.ts",
  other: "other.ts",
};

/** Identical three-source list in every category header, transcribed verbatim (see file-level comment). */
const COMMON_SOURCES: readonly string[] = [
  "ASPCA Animal Poison Control Center",
  "Pet Poison Helpline",
  "Merck Veterinary Manual",
];

export const TOXIN_SOURCE_REGISTRY: Record<ToxinCategory, readonly string[]> = {
  "human-food": COMMON_SOURCES,
  plant: COMMON_SOURCES,
  "household-chemical": COMMON_SOURCES,
  "human-med": COMMON_SOURCES,
  "pest-bait": COMMON_SOURCES,
  other: COMMON_SOURCES,
};
