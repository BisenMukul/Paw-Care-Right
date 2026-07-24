import { ApiError, normalizeError, normalizeNetworkError } from "./errors";
import { streamSseRequest, type SseTransport, type SseTransportRequest, type StreamSseOptions } from "./stream";

export interface ApiClientConfig {
  baseUrl: string;
  getAuthToken?: () => string | null | Promise<string | null>;
  /** Injectable for tests; defaults to `globalThis.fetch`. */
  fetch?: typeof fetch;
  /** Called on a 401 to obtain a fresh access token; null ⇒ session is dead. Single-flighted by the client. */
  refreshSession?: () => Promise<string | null>;
  /** Called after a refresh yields null/throws, or a retried request is still 401. */
  onSessionExpired?: () => void | Promise<void>;
  /** T083: injectable SSE transport (e.g. `expo/fetch`-backed on mobile). Omitted ⇒ `streamSse` throws. */
  streamTransport?: SseTransport;
}

export interface ApiClient {
  request<T>(path: string, init?: RequestInit): Promise<T>;
  get<T>(path: string, init?: RequestInit): Promise<T>;
  post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  put<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  patch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  delete<T>(path: string, init?: RequestInit): Promise<T>;
  /**
   * T083 (D3): streams a POST via the configured `streamTransport`, reusing
   * this client's auth header + single-flighted 401 refresh-then-retry
   * (mirrors `request()`). Throws a plain `Error` if no `streamTransport`
   * was configured.
   */
  streamSse(path: string, body: unknown, options: StreamSseOptions): Promise<void>;
}

function buildUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** Returns `{ body: json }` when a body is provided, or `{}` otherwise (never `{ body: undefined }`). */
function buildBodyInit(body: unknown): RequestInit {
  return body === undefined ? {} : { body: JSON.stringify(body) };
}

interface Attempt {
  response: Response;
  body: unknown;
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const fetchImpl = config.fetch ?? globalThis.fetch;
  /** Shared across concurrent 401s on this client instance (single-flight). */
  let refreshInFlight: Promise<string | null> | null = null;

  /**
   * A single HTTP attempt. `authOverride`, when provided, replaces
   * `getAuthToken` entirely (used for the post-refresh retry so the retried
   * request always carries the freshly-returned token, not a re-read via
   * `getAuthToken`).
   */
  async function attempt(
    path: string,
    init: RequestInit,
    authOverride?: string,
  ): Promise<Attempt> {
    const headers = new Headers(init.headers);

    if (authOverride !== undefined) {
      headers.set("Authorization", `Bearer ${authOverride}`);
    } else if (config.getAuthToken) {
      const token = await config.getAuthToken();
      if (token !== null) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    if (init.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    let response: Response;
    try {
      response = await fetchImpl(buildUrl(config.baseUrl, path), { ...init, headers });
    } catch (cause) {
      throw normalizeNetworkError(cause);
    }

    const body = await readResponseBody(response);
    return { response, body };
  }

  /**
   * Single-flighted refresh: the first concurrent 401 kicks off
   * `refreshSession()`; every other concurrent 401 awaits the same promise
   * instead of triggering its own refresh call. Resolves to `null` on any
   * failure (rejection or synchronous throw) so callers never need a
   * try/catch around it.
   */
  function refreshOnce(refreshSession: () => Promise<string | null>): Promise<string | null> {
    if (refreshInFlight === null) {
      refreshInFlight = Promise.resolve()
        .then(() => refreshSession())
        .catch(() => null)
        .finally(() => {
          refreshInFlight = null;
        });
    }
    return refreshInFlight;
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const first = await attempt(path, init);

    if (first.response.ok) {
      return first.body as T;
    }

    if (first.response.status === 401 && config.refreshSession) {
      const token = await refreshOnce(config.refreshSession);

      if (token === null) {
        await config.onSessionExpired?.();
        throw normalizeError({ status: first.response.status, body: first.body });
      }

      const retried = await attempt(path, init, token);

      if (retried.response.ok) {
        return retried.body as T;
      }

      await config.onSessionExpired?.();
      throw normalizeError({ status: retried.response.status, body: retried.body });
    }

    throw normalizeError({ status: first.response.status, body: first.body });
  }

  /**
   * Builds the SSE transport request (auth header + JSON body), reusing the
   * same `Content-Type`/`Authorization` conventions as `attempt()`.
   * `authOverride`, when provided, is used INSTEAD of `getAuthToken` (the
   * post-refresh retry, mirroring `attempt()`).
   */
  async function buildStreamRequest(path: string, body: unknown, authOverride?: string): Promise<SseTransportRequest> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (authOverride !== undefined) {
      headers.Authorization = `Bearer ${authOverride}`;
    } else if (config.getAuthToken) {
      const token = await config.getAuthToken();
      if (token !== null) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    return {
      url: buildUrl(config.baseUrl, path),
      method: "POST",
      headers,
      body: JSON.stringify(body ?? {}),
    };
  }

  /**
   * Streams a POST via `config.streamTransport`, reusing `refreshOnce`'s
   * single-flighted 401 refresh (D3): a 401 (surfaced by `streamSseRequest`
   * as an `ApiError` with `httpStatus: 401`) triggers exactly one refresh
   * and one retry attempt on the SAME transport/options, mirroring
   * `request()` exactly.
   */
  async function streamSse(path: string, body: unknown, options: StreamSseOptions): Promise<void> {
    if (!config.streamTransport) {
      throw new Error("streamSse requires a `streamTransport` to be configured on this ApiClient");
    }
    const transport = config.streamTransport;

    const req = await buildStreamRequest(path, body);

    try {
      await streamSseRequest(transport, req, options);
      return;
    } catch (err) {
      const isUnauthorized = err instanceof ApiError && err.httpStatus === 401;
      if (!isUnauthorized || !config.refreshSession) {
        throw err;
      }

      const token = await refreshOnce(config.refreshSession);
      if (token === null) {
        await config.onSessionExpired?.();
        throw err;
      }

      const retriedReq = await buildStreamRequest(path, body, token);

      try {
        await streamSseRequest(transport, retriedReq, options);
        return;
      } catch (retryErr) {
        if (retryErr instanceof ApiError && retryErr.httpStatus === 401) {
          await config.onSessionExpired?.();
        }
        throw retryErr;
      }
    }
  }

  return {
    request,
    get<T>(path: string, init: RequestInit = {}): Promise<T> {
      return request<T>(path, { ...init, method: "GET" });
    },
    post<T>(path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
      return request<T>(path, { ...init, ...buildBodyInit(body), method: "POST" });
    },
    put<T>(path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
      return request<T>(path, { ...init, ...buildBodyInit(body), method: "PUT" });
    },
    patch<T>(path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
      return request<T>(path, { ...init, ...buildBodyInit(body), method: "PATCH" });
    },
    delete<T>(path: string, init: RequestInit = {}): Promise<T> {
      return request<T>(path, { ...init, method: "DELETE" });
    },
    streamSse,
  };
}
