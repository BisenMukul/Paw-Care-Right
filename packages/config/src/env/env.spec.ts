import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import { defineEnv } from "./index";

describe("defineEnv", () => {
  it("parses a valid env and returns typed values", () => {
    const schema = z.object({
      GEMINI_API_KEY: z.string(),
      AI_TEXT_MODEL: z.string(),
    });
    const source = {
      GEMINI_API_KEY: "test-gemini-key",
      AI_TEXT_MODEL: "test-text-model",
    };

    expect(defineEnv(schema, source)).toEqual({
      GEMINI_API_KEY: "test-gemini-key",
      AI_TEXT_MODEL: "test-text-model",
    });
  });

  it("throws listing the missing key", () => {
    const schema = z.object({
      GEMINI_API_KEY: z.string(),
    });

    expect(() => defineEnv(schema, {})).toThrow(/GEMINI_API_KEY/);
  });

  it("lists every missing key, not just the first", () => {
    const schema = z.object({
      GEMINI_API_KEY: z.string(),
      AI_TEXT_MODEL: z.string(),
    });

    expect(() => defineEnv(schema, {})).toThrow(
      /GEMINI_API_KEY[\s\S]*AI_TEXT_MODEL/,
    );
  });

  it(".env.example lists all provider keys and no ANTHROPIC_API_KEY", () => {
    const envExamplePath = path.resolve(__dirname, "../../../../.env.example");
    const contents = fs.readFileSync(envExamplePath, "utf-8");

    for (const key of [
      "OLLAMA_CLOUD_API_KEY",
      "OLLAMA_CLOUD_BASE_URL",
      "AI_TEXT_MODEL",
      "AI_VISION_MODEL",
      "GEMINI_API_KEY",
      "GEMINI_IMAGE_MODEL",
    ]) {
      expect(contents).toContain(key);
    }

    expect(contents).not.toContain("ANTHROPIC_API_KEY");
  });
});
