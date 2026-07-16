import { MutationCache, QueryCache, QueryClient, type DefaultOptions } from "@tanstack/react-query";

import { shouldRetry } from "./retry";

export interface CreateQueryClientOptions {
  /** Passthrough overrides layered on top of the shared retry-policy defaults. */
  defaultOptions?: DefaultOptions;
  /** Passthrough (T075) — e.g. mobile's central 402-upsell `onError` interceptor. Undefined -> QueryClient's own default cache. */
  mutationCache?: MutationCache;
  /** Passthrough (T075), symmetric with `mutationCache`. Undefined -> QueryClient's own default cache. */
  queryCache?: QueryCache;
}

/**
 * Shared `QueryClient` factory used by both web and mobile so every consumer
 * gets the same no-retry-on-4xx policy (see `shouldRetry`) without having to
 * wire it up themselves.
 */
export function createQueryClient(options: CreateQueryClientOptions = {}): QueryClient {
  return new QueryClient({
    ...(options.mutationCache !== undefined ? { mutationCache: options.mutationCache } : {}),
    ...(options.queryCache !== undefined ? { queryCache: options.queryCache } : {}),
    defaultOptions: {
      ...options.defaultOptions,
      queries: {
        retry: shouldRetry,
        ...options.defaultOptions?.queries,
      },
      mutations: {
        retry: shouldRetry,
        ...options.defaultOptions?.mutations,
      },
    },
  });
}
