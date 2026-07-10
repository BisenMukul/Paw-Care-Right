import { QueryClient, type DefaultOptions } from "@tanstack/react-query";

import { shouldRetry } from "./retry";

export interface CreateQueryClientOptions {
  /** Passthrough overrides layered on top of the shared retry-policy defaults. */
  defaultOptions?: DefaultOptions;
}

/**
 * Shared `QueryClient` factory used by both web and mobile so every consumer
 * gets the same no-retry-on-4xx policy (see `shouldRetry`) without having to
 * wire it up themselves.
 */
export function createQueryClient(options: CreateQueryClientOptions = {}): QueryClient {
  return new QueryClient({
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
