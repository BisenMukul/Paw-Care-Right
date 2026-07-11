import { getImageProvider, getTextProvider, getVisionProvider } from "./registry";
import { aiEnvSchema, type AiEnv } from "./env.schema";
import { FakeImageProvider, FakeTextProvider, FakeVisionProvider } from "./providers/fake";
import { GeminiImageProvider } from "./providers/gemini-image";
import { OllamaTextProvider } from "./providers/ollama-text";
import { OllamaVisionProvider } from "./providers/ollama-vision";

function buildEnv(overrides: Partial<AiEnv> = {}): AiEnv {
  return aiEnvSchema.parse({ ...overrides });
}

describe("getTextProvider", () => {
  it("resolves FakeTextProvider when AI_TEXT_PROVIDER=fake", () => {
    const env = buildEnv({ AI_TEXT_PROVIDER: "fake" });

    expect(getTextProvider(env)).toBeInstanceOf(FakeTextProvider);
  });

  it("resolves OllamaTextProvider by default (real impl)", () => {
    const env = buildEnv();

    expect(getTextProvider(env)).toBeInstanceOf(OllamaTextProvider);
  });
});

describe("getVisionProvider", () => {
  it("resolves FakeVisionProvider when AI_VISION_PROVIDER=fake", () => {
    const env = buildEnv({ AI_VISION_PROVIDER: "fake" });

    expect(getVisionProvider(env)).toBeInstanceOf(FakeVisionProvider);
  });

  it("resolves OllamaVisionProvider by default (real impl)", () => {
    const env = buildEnv();

    expect(getVisionProvider(env)).toBeInstanceOf(OllamaVisionProvider);
  });
});

describe("getImageProvider", () => {
  it("resolves FakeImageProvider when AI_IMAGE_PROVIDER=fake", () => {
    const env = buildEnv({ AI_IMAGE_PROVIDER: "fake" });

    expect(getImageProvider(env)).toBeInstanceOf(FakeImageProvider);
  });

  it("resolves GeminiImageProvider by default (real impl)", () => {
    const env = buildEnv();

    expect(getImageProvider(env)).toBeInstanceOf(GeminiImageProvider);
  });
});
