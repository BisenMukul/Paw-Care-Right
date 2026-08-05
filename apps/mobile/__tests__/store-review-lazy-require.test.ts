/**
 * T109 checker Finding 3: pins the lazy-require idiom in `store-review.ts`,
 * mirroring `ota-lazy-require.test.ts`'s idiom for `ota-info.ts`/
 * `update-controller.ts`. `expo-store-review` is mocked to THROW on
 * require -- a real Expo Go / jest-container failure mode (and the shape
 * of the plan's install-skip fallback, F12). This fails the moment
 * `store-review.ts` moves to a top-level `import * as` (which would throw
 * at import time, before any try/catch could run) instead of the lazy,
 * try/catch-guarded `require` inside `defaultStoreReviewLoader`.
 */
jest.mock("expo-store-review", () => {
  throw new Error("native binding unavailable");
});

describe("store-review lazy-require: importing store-review.ts never eagerly requires expo-store-review", () => {
  it("imports src/review/store-review.ts without throwing", () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: this test must exercise the module's OWN internal require of "expo-store-review" (mocked to throw above), which can only be observed via a runtime require here too, not a top-level import
      require("../src/review/store-review");
    }).not.toThrow();
  });

  it("defaultStoreReviewLoader() resolves to null when the native module throws on load", () => {
    const { defaultStoreReviewLoader } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
      require("../src/review/store-review") as typeof import("../src/review/store-review");

    expect(defaultStoreReviewLoader()).toBeNull();
  });

  it("requestStoreReview() resolves false (never throws) when the native module throws on load", async () => {
    const { requestStoreReview, defaultStoreReviewLoader } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
      require("../src/review/store-review") as typeof import("../src/review/store-review");

    await expect(requestStoreReview(defaultStoreReviewLoader)).resolves.toBe(false);
  });
});
