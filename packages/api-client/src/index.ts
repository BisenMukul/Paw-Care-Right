// Core, platform-agnostic entry. Does NOT re-export `./mmkv-persister` — that
// subpath is mobile-only and must never pull `react-native-mmkv` into this
// chunk (kept isolated so web can safely import from `.`).
export { ApiError, isApiError, normalizeError, normalizeNetworkError } from "./errors";
export type { ApiErrorArgs } from "./errors";
export { createApiClient } from "./client";
export type { ApiClient, ApiClientConfig } from "./client";
export { MAX_QUERY_RETRIES, shouldRetry } from "./retry";
export { createQueryClient } from "./query-client";
export type { CreateQueryClientOptions } from "./query-client";
export { ApiQueryProvider } from "./query-provider";
export type { ApiQueryProviderProps } from "./query-provider";
