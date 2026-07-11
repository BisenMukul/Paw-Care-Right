import { fetchJson } from "../http";
import { computeUsage, startTimer, type CostRates } from "../usage";
import {
  DEFAULT_TIMEOUT_MS,
  type TextGenerateOptions,
  type TextMessage,
  type TextProvider,
  type TextResult,
} from "./types";

const PROVIDER = "ollama-text";

interface OllamaChatCompletionResponse {
  model?: string;
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export interface OllamaTextProviderOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  rates?: CostRates;
}

/** Real Ollama Cloud text provider (OpenAI-compatible `/v1/chat/completions`). */
export class OllamaTextProvider implements TextProvider {
  constructor(private readonly options: OllamaTextProviderOptions) {}

  async generate(options: TextGenerateOptions): Promise<TextResult> {
    const messages: TextMessage[] = [];
    if (options.system) {
      messages.push({ role: "system", content: options.system });
    }
    if (options.messages) {
      messages.push(...options.messages);
    } else if (options.prompt !== undefined) {
      messages.push({ role: "user", content: options.prompt });
    }

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
