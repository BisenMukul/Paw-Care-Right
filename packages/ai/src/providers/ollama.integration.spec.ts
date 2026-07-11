/**
 * Real-network integration spec for the Ollama Cloud text + vision providers.
 * Skipped by default (and always in CI) — no keys are read unless explicitly
 * opted in.
 *
 * To run locally:
 *   RUN_AI_INTEGRATION=1 OLLAMA_CLOUD_API_KEY=<real key> \
 *     pnpm --filter @pawcareright/ai test -- ollama.integration.spec.ts
 */
import { OllamaTextProvider } from "./ollama-text";
import { OllamaVisionProvider } from "./ollama-vision";

const RUN =
  process.env.RUN_AI_INTEGRATION === "1" && !!process.env.OLLAMA_CLOUD_API_KEY;

(RUN ? describe : describe.skip)("Ollama Cloud integration", () => {
  const apiKey = process.env.OLLAMA_CLOUD_API_KEY as string;
  const baseUrl = process.env.OLLAMA_CLOUD_BASE_URL ?? "https://ollama.com";
  const textModel = process.env.AI_TEXT_MODEL ?? "example-text-model";
  const visionModel = process.env.AI_VISION_MODEL ?? "example-vision-model";

  it("generates real text", async () => {
    const provider = new OllamaTextProvider({ baseUrl, apiKey, model: textModel });

    const result = await provider.generate({ prompt: "Say hello in one word." });

    expect(result.text.length).toBeGreaterThan(0);
  });

  it("generates real vision output", async () => {
    const provider = new OllamaVisionProvider({ baseUrl, apiKey, model: visionModel });

    const result = await provider.generate({
      prompt: "Describe this image in one word.",
      images: [
        {
          mimeType: "image/png",
          base64:
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        },
      ],
    });

    expect(result.text.length).toBeGreaterThan(0);
  });
});
