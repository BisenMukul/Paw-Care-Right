import type { Species } from "@pawcareright/types";

import type { AnswerCachePort, CachedAnswer } from "./types";

/** `species:normalizedItem` (ARCHITECTURE line 63). `normalizedItem` must already be normalized by the caller. */
export function foodCacheKey(species: Species, normalizedItem: string): string {
  return `${species}:${normalizedItem}`;
}

/**
 * Deterministic, no-network `AnswerCachePort` fake for tests/CI (mirrors
 * `../providers/fake`). The Prisma-backed implementation (hitCount,
 * answerJson column) is the future `apps/api` food module's job.
 */
export class InMemoryAnswerCache implements AnswerCachePort {
  private readonly store = new Map<string, CachedAnswer>();

  get(key: string): Promise<CachedAnswer | undefined> {
    return Promise.resolve(this.store.get(key));
  }

  set(key: string, value: CachedAnswer): Promise<void> {
    this.store.set(key, value);
    return Promise.resolve();
  }
}
