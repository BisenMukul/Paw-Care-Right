/**
 * Real-network integration spec for the Gemini image provider. Skipped by
 * default (and always in CI) — no key is read unless explicitly opted in.
 *
 * To run locally:
 *   RUN_AI_INTEGRATION=1 GEMINI_API_KEY=<real key> \
 *     pnpm --filter @pawcareright/ai test -- gemini-image.integration.spec.ts
 */
import { GeminiImageProvider } from "./gemini-image";

const RUN = process.env.RUN_AI_INTEGRATION === "1" && !!process.env.GEMINI_API_KEY;

(RUN ? describe : describe.skip)("Gemini image integration", () => {
  const apiKey = process.env.GEMINI_API_KEY as string;
  const model = process.env.GEMINI_IMAGE_MODEL ?? "gemini-example-image-model";

  it("generates a real image", async () => {
    const provider = new GeminiImageProvider({ apiKey, model });

    const result = await provider.generateImage({ prompt: "a small red ball" });

    expect(result.imageBase64).toBeDefined();
  });
});
