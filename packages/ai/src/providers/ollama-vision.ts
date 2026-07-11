import { fetchJson } from "../http";
import { computeUsage, startTimer, type CostRates } from "../usage";
import {
  DEFAULT_TIMEOUT_MS,
  type TextResult,
  type VisionGenerateOptions,
  type VisionImage,
  type VisionProvider,
} from "./types";

const PROVIDER = "ollama-vision";

interface OllamaChatCompletionResponse {
  model?: string;
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface OllamaVisionProviderOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  rates?: CostRates;
}

function toImageUrl(image: VisionImage): string {
  return image.base64
    ? `data:${image.mimeType};base64,${image.base64}`
    : (image.url ?? "");
}

/** Real Ollama Cloud vision provider (OpenAI-compatible `/v1/chat/completions`). */
export class OllamaVisionProvider implements VisionProvider {
  constructor(private readonly options: OllamaVisionProviderOptions) {}

  async generate(options: VisionGenerateOptions): Promise<TextResult> {
    const content: ContentPart[] = [
      { type: "text", text: options.prompt },
      ...options.images.map(
        (image): ContentPart => ({
          type: "image_url",
          image_url: { url: toImageUrl(image) },
        }),
      ),
    ];

    const messages: { role: "system" | "user"; content: string | ContentPart[] }[] = [];
    if (options.system) {
      messages.push({ role: "system", content: options.system });
    }
    messages.push({ role: "user", content });

    const body: Record<string, unknown> = {
      model: this.options.model,
      messages,
      temperature: options.temperature ?? 0,
      stream: false,
    };
    if (options.maxTokens !== undefined) {
      body["max_tokens"] = options.maxTokens;
    }

    const timer = startTimer();
    const response = await fetchJson<OllamaChatCompletionResponse>(
      PROVIDER,
      `${this.options.baseUrl}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    const latencyMs = timer.elapsedMs();

    return {
      text: response.choices?.[0]?.message?.content ?? "",
      model: response.model ?? this.options.model,
      usage: computeUsage({
        latencyMs,
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
        rates: this.options.rates,
      }),
      raw: response,
    };
  }
}
