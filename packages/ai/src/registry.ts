import { type AiEnv, loadAiEnv } from "./env.schema";
import { FakeImageProvider, FakeTextProvider, FakeVisionProvider } from "./providers/fake";
import { GeminiImageProvider } from "./providers/gemini-image";
import { OllamaTextProvider } from "./providers/ollama-text";
import { OllamaVisionProvider } from "./providers/ollama-vision";
import type { ImageProvider, TextProvider, VisionProvider } from "./providers/types";

/**
 * Single seam for resolving provider implementations from env. No hidden
 * global cache — each call constructs fresh from the given (or loaded) env,
 * so callers/tests stay explicit and deterministic.
 */
export function getTextProvider(env?: AiEnv): TextProvider {
  const resolved = env ?? loadAiEnv();

  switch (resolved.AI_TEXT_PROVIDER) {
    case "fake":
      return new FakeTextProvider();
    case "ollama":
      return new OllamaTextProvider({
        baseUrl: resolved.OLLAMA_CLOUD_BASE_URL,
        apiKey: resolved.OLLAMA_CLOUD_API_KEY,
        model: resolved.AI_TEXT_MODEL,
      });
  }
}

export function getVisionProvider(env?: AiEnv): VisionProvider {
  const resolved = env ?? loadAiEnv();

  switch (resolved.AI_VISION_PROVIDER) {
    case "fake":
      return new FakeVisionProvider();
    case "ollama":
      return new OllamaVisionProvider({
        baseUrl: resolved.OLLAMA_CLOUD_BASE_URL,
        apiKey: resolved.OLLAMA_CLOUD_API_KEY,
        model: resolved.AI_VISION_MODEL,
      });
  }
}

export function getImageProvider(env?: AiEnv): ImageProvider {
  const resolved = env ?? loadAiEnv();

  switch (resolved.AI_IMAGE_PROVIDER) {
    case "fake":
      return new FakeImageProvider();
    case "gemini":
      return new GeminiImageProvider({
        apiKey: resolved.GEMINI_API_KEY,
        model: resolved.GEMINI_IMAGE_MODEL,
      });
  }
}
