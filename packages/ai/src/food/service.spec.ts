import { FOOD_SAFETY_FALLBACK } from "@pawcareright/types";

import { FakeTextProvider } from "../providers/fake";
import type { TextResult } from "../providers/types";

import { foodCacheKey, InMemoryAnswerCache } from "./cache";
import { checkFoodSafety } from "./service";
import type { FoodSafetyDeps } from "./types";

function textResult(text: string): TextResult {
  return { text, model: "fake-text-model", usage: { latencyMs: 1 } };
}

function depsWithScript(script: TextResult[]): { deps: FoodSafetyDeps; cache: InMemoryAnswerCache } {
  const cache = new InMemoryAnswerCache();
  const provider = new FakeTextProvider({ script });
  return { deps: { provider, cache }, cache };
}

describe("checkFoodSafety — dataset hit", () => {
  it("returns source DATASET with the curated verdict and never calls the provider", async () => {
    const { deps } = depsWithScript([]); // any provider.generate() call would reject

    const result = await checkFoodSafety("DOG", "grapes", deps);

    expect(result).toMatchObject({
      source: "DATASET",
      species: "DOG",
      item: "grapes",
      verdict: "emergency",
      cached: false,
    });
    expect(result.note.length).toBeGreaterThan(0);
  });

  it("bypasses the cache entirely on a dataset hit", async () => {
    const { deps, cache } = depsWithScript([]);

    await checkFoodSafety("CAT", "onion", deps);

    const key = foodCacheKey("CAT", "onion");
    await expect(cache.get(key)).resolves.toBeUndefined();
  });
});

describe("checkFoodSafety — miss then AI then cache", () => {
  it("misses the dataset, asks the provider, and caches the answer", async () => {
    const { deps, cache } = depsWithScript([
      textResult(JSON.stringify({ verdict: "toxic", note: "This is not a typical pet-safe item." })),
    ]);

    const result = await checkFoodSafety("DOG", "some-nonexistent-item-xyz", deps);

    expect(result).toMatchObject({
      source: "AI",
      verdict: "toxic",
      cached: false,
    });

    const key = foodCacheKey("DOG", "some nonexistent item xyz");
    await expect(cache.get(key)).resolves.toEqual({
      verdict: "toxic",
      note: "This is not a typical pet-safe item.",
    });
  });

  it("returns cached:true on a second lookup with no second provider call", async () => {
    const { deps } = depsWithScript([
      textResult(JSON.stringify({ verdict: "caution", note: "Limited information is available." })),
    ]);

    const first = await checkFoodSafety("CAT", "some-other-nonexistent-item", deps);
    expect(first.cached).toBe(false);

    const second = await checkFoodSafety("CAT", "some-other-nonexistent-item", deps);
    expect(second).toMatchObject({ source: "AI", verdict: "caution", cached: true });
  });
});

describe("checkFoodSafety — caution floor", () => {
  it("coerces an AI 'safe' verdict to 'caution' before returning and caching", async () => {
    const { deps, cache } = depsWithScript([
      textResult(JSON.stringify({ verdict: "safe", note: "Seems fine in small amounts." })),
    ]);

    const result = await checkFoodSafety("DOG", "yet-another-nonexistent-item", deps);

    expect(result.verdict).toBe("caution");
    expect(result.source).toBe("AI");

    const key = foodCacheKey("DOG", "yet another nonexistent item");
    await expect(cache.get(key)).resolves.toEqual({
      verdict: "caution",
      note: "Seems fine in small amounts.",
    });
  });
});

describe("checkFoodSafety — parse failure falls back and does not cache", () => {
  it("returns the frozen FOOD_SAFETY_FALLBACK on malformed JSON", async () => {
    const { deps, cache } = depsWithScript([textResult("not json at all")]);

    const result = await checkFoodSafety("DOG", "malformed-response-item", deps);

    expect(result).toMatchObject({
      source: "FALLBACK",
      verdict: FOOD_SAFETY_FALLBACK.verdict,
      note: FOOD_SAFETY_FALLBACK.note,
      cached: false,
    });

    const key = foodCacheKey("DOG", "malformed response item");
    await expect(cache.get(key)).resolves.toBeUndefined();
  });

  it("returns the frozen FOOD_SAFETY_FALLBACK on a schema-invalid answer", async () => {
    const { deps, cache } = depsWithScript([textResult(JSON.stringify({ verdict: "not-a-real-verdict" }))]);

    const result = await checkFoodSafety("CAT", "schema-invalid-item", deps);

    expect(result.source).toBe("FALLBACK");
    expect(result.verdict).toBe(FOOD_SAFETY_FALLBACK.verdict);

    const key = foodCacheKey("CAT", "schema invalid item");
    await expect(cache.get(key)).resolves.toBeUndefined();
  });
});

describe("checkFoodSafety — provider error falls back, never throws, and does not cache", () => {
  it("returns FOOD_SAFETY_FALLBACK when the provider rejects", async () => {
    const { deps, cache } = depsWithScript([]); // empty script -> generate() rejects

    const result = await checkFoodSafety("DOG", "provider-error-item", deps);

    expect(result).toMatchObject({
      source: "FALLBACK",
      verdict: FOOD_SAFETY_FALLBACK.verdict,
      note: FOOD_SAFETY_FALLBACK.note,
      cached: false,
    });

    const key = foodCacheKey("DOG", "provider error item");
    await expect(cache.get(key)).resolves.toBeUndefined();
  });
});
