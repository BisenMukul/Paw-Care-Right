import type { FoodVerdict, Species } from "@pawcareright/types";

import type { TextProvider } from "../providers/types";

/**
 * Pure TS interfaces for the food-safety fallback service (T035). No zod
 * here — `@pawcareright/types`'s `foodSafetyAnswerSchema`/
 * `parseFoodSafetyAnswer` remain the single validation source of truth for
 * AI output; this file only shapes the orchestration seam.
 */

/** What the cache stores for a previously-answered AI lookup (plan §"Cache port contract"). */
export interface CachedAnswer {
  verdict: FoodVerdict;
  note: string;
}

/**
 * Injected cache seam (Decision R1/R7). The Prisma-backed implementation
 * (hitCount, answerJson column) is the future `apps/api` food module's job —
 * T035 ships only this port and an in-memory fake.
 */
export interface AnswerCachePort {
  get(key: string): Promise<CachedAnswer | undefined>;
  set(key: string, value: CachedAnswer): Promise<void>;
}

export interface FoodSafetyDeps {
  provider: TextProvider;
  cache: AnswerCachePort;
}

export type FoodAnswerSource = "DATASET" | "AI" | "FALLBACK";

export interface FoodSafetyResult {
  source: FoodAnswerSource;
  species: Species;
  /** Normalized item text (see `normalizeItem` in `@pawcareright/data`). */
  item: string;
  verdict: FoodVerdict;
  note: string;
  quantityNuance?: string;
  cached: boolean;
}
