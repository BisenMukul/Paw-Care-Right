import type { SseTransport, SseTransportResponse } from "@pawcareright/api-client";
import { fetch as expoFetch } from "expo/fetch";

/**
 * `expo/fetch`-backed `SseTransport` (T083 plan decision D1). `expo/fetch`
 * gives a WHATWG `Response` with a REAL incrementally-readable `body`
 * (`ReadableStream<Uint8Array> | null`) in React Native, unlike RN's classic
 * `fetch`. No new dependency: `expo/fetch` is a subpath of the already-
 * pinned `expo@~57.0.6` (see `apps/mobile/package.json`).
 *
 * Graceful, fail-SAFE degradation: when `response.body` is `null` (any
 * runtime without native streaming, e.g. Expo Go), this falls back to
 * awaiting `response.text()` and yielding the whole body as ONE chunk. The
 * SSE frame parser then emits every frame at once — the UI still renders
 * the complete, correctly-ordered answer, just non-incrementally. It never
 * breaks, never drops frames, never invents text.
 *
 * Not unit-tested (plan R2): its behavior is verified by TYPE (step 1's
 * gate) and by Expo's documented winter-runtime streaming support, not by a
 * device run — the parser/runner/hook it feeds are exercised through an
 * injected fake transport instead.
 */
async function* chunksFromReadableStream(stream: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        yield decoder.decode(value, { stream: true });
      }
    }
    const tail = decoder.decode();
    if (tail.length > 0) {
      yield tail;
    }
  } finally {
    reader.releaseLock();
  }
}

async function* chunksFromWholeText(text: string): AsyncIterable<string> {
  yield text;
}

export const expoSseTransport: SseTransport = async (req) => {
  const response = await expoFetch(req.url, {
    method: req.method,
    headers: req.headers,
    body: req.body,
    ...(req.signal ? { signal: req.signal } : {}),
  });

  const chunks: AsyncIterable<string> =
    response.body !== null ? chunksFromReadableStream(response.body) : chunksFromWholeText(await response.text());

  const transportResponse: SseTransportResponse = {
    status: response.status,
    getHeader: (name: string) => response.headers.get(name),
    chunks,
  };

  return transportResponse;
};
