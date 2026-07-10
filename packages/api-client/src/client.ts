import { normalizeError, normalizeNetworkError } from "./errors";

export interface ApiClientConfig {
  baseUrl: string;
  getAuthToken?: () => string | null | Promise<string | null>;
  /** Injectable for tests; defaults to `globalThis.fetch`. */
  fetch?: typeof fetch;
}

export interface ApiClient {
  request<T>(path: string, init?: RequestInit): Promise<T>;
  get<T>(path: string, init?: RequestInit): Promise<T>;
  post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  put<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  patch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  delete<T>(path: string, init?: RequestInit): Promise<T>;
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

export function createApiClient(config: ApiClientConfig): ApiClient {
  const fetchImpl = config.fetch ?? globalThis.fetch;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);

    if (config.getAuthToken) {
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

    if (!response.ok) {
      throw normalizeError({ status: response.status, body });
    }

    return body as T;
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
  };
}
