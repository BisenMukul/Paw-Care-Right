import type { AnalyticsTransport, CapturePayload } from "./analytics";

export interface CreateHttpTransportOptions {
  apiKey: string;
  host: string;
  /** Injectable for tests; defaults to the global `fetch` (Node 20+/RN/Expo Go). */
  fetchImpl?: typeof fetch;
  /** Invoked when the fire-and-forget POST rejects; never rethrown. */
  onError?: (error: unknown) => void;
}

/**
 * A fetch-based PostHog HTTP-capture transport (plan decision 2): calls the
 * documented `POST {host}/capture/` endpoint via global `fetch` -- no
 * `posthog-node`/`posthog-react-native` dependency. An empty `apiKey` makes
 * `send` a no-op (plan decision 5, stub-safe: no key in tests/CI means no
 * network call and no throw). `send` never throws synchronously; a
 * rejected fetch is swallowed and reported via `onError`.
 */
export function createHttpTransport(opts: CreateHttpTransportOptions): AnalyticsTransport {
  return {
    send(payload: CapturePayload): void {
      if (opts.apiKey === "") {
        return;
      }

      const fetchFn = opts.fetchImpl ?? fetch;
      void fetchFn(`${opts.host}/capture/`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: opts.apiKey,
          event: payload.event,
          distinct_id: payload.distinctId,
          properties: payload.properties,
          timestamp: new Date().toISOString(),
        }),
      }).catch(opts.onError ?? (() => {}));
    },
  };
}
