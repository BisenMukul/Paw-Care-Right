import { fetchJson } from "../http";
import { computeUsage, startTimer, type CostRates } from "../usage";
import {
  DEFAULT_TIMEOUT_MS,
  ProviderError,
  type TextGenerateOptions,
  type TextMessage,
  type TextProvider,
  type TextResult,
  type TextStreamChunk,
} from "./types";

const PROVIDER = "ollama-text";

interface OllamaChatCompletionResponse {
  model?: string;
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

interface OllamaStreamChunkPayload {
  choices?: { delta?: { content?: string } }[];
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

  private buildMessages(options: TextGenerateOptions): TextMessage[] {
    const messages: TextMessage[] = [];
    if (options.system) {
      messages.push({ role: "system", content: options.system });
    }
    if (options.messages) {
      messages.push(...options.messages);
    } else if (options.prompt !== undefined) {
      messages.push({ role: "user", content: options.prompt });
    }
    return messages;
  }

  private buildBody(options: TextGenerateOptions, stream: boolean): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.options.model,
      messages: this.buildMessages(options),
      temperature: options.temperature ?? 0,
      stream,
    };
    if (options.maxTokens !== undefined) {
      body["max_tokens"] = options.maxTokens;
    }
    return body;
  }

  async generate(options: TextGenerateOptions): Promise<TextResult> {
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
        body: JSON.stringify(this.buildBody(options, false)),
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

  /**
   * Streaming variant (T081 plan decision D3): OpenAI-compatible
   * `stream: true` + `data:` line parsing. Yields `{text}` deltas as they
   * arrive; the caller (`ChatService`) is responsible for output-gating
   * every released chunk through `scanUnsafeText` before it reaches the
   * client — this method has no safety logic of its own.
   */
  async *generateStream(options: TextGenerateOptions): AsyncGenerator<TextStreamChunk> {
    const url = `${this.options.baseUrl}/v1/chat/completions`;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.options.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(this.buildBody(options, true)),
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new ProviderError(PROVIDER, "timeout", `Request to ${url} timed out after ${timeoutMs}ms`);
        }
        throw new ProviderError(
          PROVIDER,
          "invalid_response",
          `Request to ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (!response.ok) {
        throw new ProviderError(PROVIDER, "http_error", `Request to ${url} responded with status ${response.status}`, response.status);
      }

      if (!response.body) {
        throw new ProviderError(PROVIDER, "invalid_response", `Response from ${url} had no body to stream`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          const chunk = this.parseStreamLine(rawLine);
          if (chunk !== null) {
            yield chunk;
          }
        }
      }

      const trailing = this.parseStreamLine(buffer);
      if (trailing !== null) {
        yield trailing;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /** Parses one raw SSE line from the Ollama stream; `null` on blank/`[DONE]`/malformed/empty-delta lines. */
  private parseStreamLine(rawLine: string): TextStreamChunk | null {
    const line = rawLine.trim();
    if (line.length === 0 || !line.startsWith("data:")) {
      return null;
    }

    const payload = line.slice("data:".length).trim();
    if (payload.length === 0 || payload === "[DONE]") {
      return null;
    }

    try {
      const parsed = JSON.parse(payload) as OllamaStreamChunkPayload;
      const text = parsed.choices?.[0]?.delta?.content;
      return text !== undefined && text.length > 0 ? { text } : null;
    } catch {
      return null;
    }
  }
}
