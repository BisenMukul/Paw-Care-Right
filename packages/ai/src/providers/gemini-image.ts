import { fetchJson } from "../http";
import { computeUsage, startTimer, type CostRates } from "../usage";
import {
  DEFAULT_TIMEOUT_MS,
  type ImageGenerateOptions,
  type ImageProvider,
  type ImageResult,
} from "./types";

const PROVIDER = "gemini-image";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiGenerateContentResponse {
  candidates?: {
    content?: { parts?: { inlineData?: { data?: string } }[] };
  }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

export interface GeminiImageProviderOptions {
  apiKey: string;
  model: string;
  rates?: CostRates;
}

/** Real Gemini image provider (REST `:generateContent`, thin + mockable — see plan Risk R5). */
export class GeminiImageProvider implements ImageProvider {
  constructor(private readonly options: GeminiImageProviderOptions) {}

  async generateImage(options: ImageGenerateOptions): Promise<ImageResult> {
    const body = {
      contents: [{ parts: [{ text: options.prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    };

    const url = `${GEMINI_BASE_URL}/models/${this.options.model}:generateContent?key=${this.options.apiKey}`;

    const timer = startTimer();
    const response = await fetchJson<GeminiGenerateContentResponse>(
      PROVIDER,
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    const latencyMs = timer.elapsedMs();

    const imageBase64 = response.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData?.data !== undefined,
    )?.inlineData?.data;

    const result: ImageResult = {
      model: this.options.model,
      usage: computeUsage({
        latencyMs,
        inputTokens: response.usageMetadata?.promptTokenCount,
        outputTokens: response.usageMetadata?.candidatesTokenCount,
        rates: this.options.rates,
      }),
      raw: response,
    };
    if (imageBase64 !== undefined) {
      result.imageBase64 = imageBase64;
    }

    return result;
  }
}
