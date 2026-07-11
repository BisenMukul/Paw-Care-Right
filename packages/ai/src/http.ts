import { DEFAULT_TIMEOUT_MS, ProviderError } from "./providers/types";

/**
 * Thin `fetch` + JSON helper shared by every real provider implementation.
 * Applies an `AbortController` timeout, maps failures to typed
 * `ProviderError`s, and never retries (retry policy belongs to callers).
 */
export async function fetchJson<T>(
  provider: string,
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ProviderError(
          provider,
          "timeout",
          `Request to ${url} timed out after ${timeoutMs}ms`,
        );
      }
      throw new ProviderError(
        provider,
        "invalid_response",
        `Request to ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!response.ok) {
      throw new ProviderError(
        provider,
        "http_error",
        `Request to ${url} responded with status ${response.status}`,
        response.status,
      );
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new ProviderError(
        provider,
        "invalid_response",
        `Response from ${url} was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } finally {
    clearTimeout(timer);
  }
}
