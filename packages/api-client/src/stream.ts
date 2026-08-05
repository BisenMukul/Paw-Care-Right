import { normalizeError, normalizeNetworkError } from "./errors";
import { createSseFrameParser, type SseFrame } from "./sse";

export type { SseFrame } from "./sse";

/**
 * Transport-agnostic SSE runner (T083 plan decision D2). Knows about HTTP
 * status, headers, `ApiError` normalization, and `event:`/`data:` framing —
 * NOTHING about chat's `start`/`nudge`/`chunk`/`done` semantics (that lives
 * in `apps/mobile/src/chat/chat-events.ts`). Reused by `createApiClient`'s
 * `streamSse` (D3) and, on mobile, driven by `expo-sse-transport.ts`.
 */

export interface SseTransportResponse {
  status: number;
  /** Case-insensitive header lookup. */
  getHeader(name: string): string | null;
  /** Decoded UTF-8 text chunks, in order. May yield the whole body as one chunk. */
  chunks: AsyncIterable<string>;
}

export interface SseTransportRequest {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}

export type SseTransport = (req: SseTransportRequest) => Promise<SseTransportResponse>;

export interface StreamSseOptions {
  onFrame: (frame: SseFrame) => void;
  /** Called once, after status/headers are known and status is 2xx (quota headers land here). */
  onOpen?: (headers: { get(name: string): string | null }) => void;
  signal?: AbortSignal;
}

/** Reads every chunk of an async iterable into one concatenated string. */
async function bufferChunks(chunks: AsyncIterable<string>): Promise<string> {
  let out = "";
  for await (const chunk of chunks) {
    out += chunk;
  }
  return out;
}

/** Best-effort JSON parse; falls back to the raw text (mirrors `client.ts`'s `readResponseBody`). */
function parseJsonBody(text: string): unknown {
  if (text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * Resolves when the byte source ends normally. Throws `ApiError` on non-2xx
 * (body normalized via `normalizeError`) and on transport failure
 * (`normalizeNetworkError`). It NEVER interprets frame semantics and NEVER
 * retries — that is the caller's job (D3/D7).
 */
export async function streamSseRequest(
  transport: SseTransport,
  req: SseTransportRequest,
  options: StreamSseOptions,
): Promise<void> {
  // `options.signal` is the caller-supplied abort signal for THIS stream
  // attempt; when present it takes precedence over anything already on
  // `req` so a caller can drive an attempt's lifecycle purely through
  // `options` without having to thread `signal` into `req` itself.
  const effectiveReq: SseTransportRequest = options.signal !== undefined ? { ...req, signal: options.signal } : req;

  let response: SseTransportResponse;
  try {
    response = await transport(effectiveReq);
  } catch (cause) {
    throw normalizeNetworkError(cause);
  }

  if (response.status < 200 || response.status >= 300) {
    const bodyText = await bufferChunks(response.chunks);
    throw normalizeError({ status: response.status, body: parseJsonBody(bodyText) });
  }

  options.onOpen?.({ get: (name: string) => response.getHeader(name) });

  const parser = createSseFrameParser();

  try {
    for await (const chunk of response.chunks) {
      for (const frame of parser.push(chunk)) {
        options.onFrame(frame);
      }
    }
    // FINDING-6: the `flush()` dispatch must share the SAME normalization
    // path as the main loop above -- an `onFrame` throw on a flushed
    // (unterminated-tail) frame is exactly as possible as one during the
    // main loop, and must be normalized to an `ApiError` the same way
    // (never let a raw throw escape `streamSseRequest` -- the invariant
    // every caller, e.g. `use-chat-stream.ts`, is documented to rely on).
    for (const frame of parser.flush()) {
      options.onFrame(frame);
    }
  } catch (cause) {
    throw normalizeNetworkError(cause);
  }
}
