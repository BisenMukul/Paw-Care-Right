/**
 * Provider abstraction seam: shared interfaces + error type for text, vision,
 * and image AI providers. Pure infrastructure — no prompts, triage schema,
 * parsing, disclaimer, or fallback logic (those live in T030-T033).
 */

export const DEFAULT_TIMEOUT_MS = 30_000;

export interface ProviderUsage {
  /** Always measured, regardless of provider. */
  latencyMs: number;
  /** From provider usage payload when present. */
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  /** Computed from tokens x CostRates (default 0). */
  costMicroUsd?: number;
}

export interface TextMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TextGenerateOptions {
  /** One of `prompt` | `messages` is required. */
  prompt?: string;
  messages?: TextMessage[];
  system?: string;
  /** Default 0 (triage determinism). */
  temperature?: number;
  /** Default DEFAULT_TIMEOUT_MS. */
  timeoutMs?: number;
  maxTokens?: number;
}

export interface TextResult {
  text: string;
  model: string;
  usage: ProviderUsage;
  raw?: unknown;
}

export interface TextProvider {
  generate(options: TextGenerateOptions): Promise<TextResult>;
}

export interface VisionImage {
  base64?: string;
  url?: string;
  mimeType: string;
}

export interface VisionGenerateOptions {
  prompt: string;
  images: VisionImage[];
  system?: string;
  temperature?: number;
  timeoutMs?: number;
  maxTokens?: number;
}

export interface VisionProvider {
  generate(options: VisionGenerateOptions): Promise<TextResult>;
}

export interface ImageGenerateOptions {
  prompt: string;
  size?: string;
  timeoutMs?: number;
}

export interface ImageResult {
  imageBase64?: string;
  url?: string;
  model: string;
  usage: ProviderUsage;
  raw?: unknown;
}

export interface ImageProvider {
  generateImage(options: ImageGenerateOptions): Promise<ImageResult>;
}

export type ProviderErrorCode =
  | "timeout"
  | "http_error"
  | "invalid_response"
  | "config_error";

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly provider: string;
  readonly status?: number;

  constructor(
    provider: string,
    code: ProviderErrorCode,
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.code = code;
    if (status !== undefined) {
      this.status = status;
    }
  }
}
