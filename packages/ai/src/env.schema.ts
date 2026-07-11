import { z } from "zod";
import { defineEnv } from "@pawcareright/config/env";

/**
 * Env slice for the `@pawcareright/ai` provider seam. Colocated with the
 * providers it configures (mirrors apps/api's env.schema.ts pattern) rather
 * than living in `@pawcareright/config`.
 */
export const aiEnvSchema = z.object({
  OLLAMA_CLOUD_BASE_URL: z.string().url().default("https://ollama.com"),
  OLLAMA_CLOUD_API_KEY: z.string().default("example-ollama-cloud-api-key"),
  AI_TEXT_MODEL: z.string().default("example-text-model"),
  AI_VISION_MODEL: z.string().default("example-vision-model"),
  GEMINI_API_KEY: z.string().default("example-gemini-api-key"),
  GEMINI_IMAGE_MODEL: z.string().default("gemini-example-image-model"),
  AI_TEXT_PROVIDER: z.enum(["ollama", "fake"]).default("ollama"),
  AI_VISION_PROVIDER: z.enum(["ollama", "fake"]).default("ollama"),
  AI_IMAGE_PROVIDER: z.enum(["gemini", "fake"]).default("gemini"),
});

export type AiEnv = z.infer<typeof aiEnvSchema>;

export function loadAiEnv(source?: NodeJS.ProcessEnv): AiEnv {
  return defineEnv(aiEnvSchema, source);
}
