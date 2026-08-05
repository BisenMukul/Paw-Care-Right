import { appConfigResponseSchema, type PaywallVariant } from "@pawcareright/types";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiClient } from "../api/client";

import { readCachedConfig, writeCachedConfig } from "./app-config-cache";

export interface AppConfig {
  variant: PaywallVariant;
  minSupportedVersion: string;
  hotlinePackVersion: number;
}

/**
 * Permissive default (T079 plan decision 5): used whenever `/v1/config` is
 * unreachable/malformed AND there is no cached last-known-good config. The
 * permissive `minSupportedVersion` ("0.0.0") means the update gate never
 * blocks anyone under this default (CLAUDE.md §7 fail-open posture).
 */
export const DEFAULT_APP_CONFIG: AppConfig = {
  variant: "A",
  minSupportedVersion: "0.0.0",
  hotlinePackVersion: 1,
};

/**
 * `GET /v1/config`, parsed with the shared `appConfigResponseSchema` and
 * flattened to `AppConfig`. On success, writes the MMKV last-known-good
 * cache and returns the fresh config. On ANY failure -- network error,
 * offline, non-200, schema-invalid body -- returns the cached config when
 * one exists, else the safe default. Never throws.
 */
export async function fetchAppConfig(): Promise<AppConfig> {
  try {
    const body = await apiClient.get<unknown>("/v1/config");
    const parsed = appConfigResponseSchema.parse(body);
    const config: AppConfig = {
      variant: parsed.paywall.variant,
      minSupportedVersion: parsed.minSupportedVersion,
      hotlinePackVersion: parsed.hotlinePackVersion,
    };

    writeCachedConfig(config);

    return config;
  } catch {
    return readCachedConfig() ?? DEFAULT_APP_CONFIG;
  }
}

/**
 * TanStack Query wrapper (stale-while-revalidate): `initialData` is seeded
 * from the cache-or-default so the config is NEVER `undefined`/loading, and
 * a background refetch swaps in the fresh value once, in place.
 */
// Config changes rarely; without a staleTime the default (0) makes the query
// stale immediately, so every observer mount refetches `/v1/config`. Under any
// mount/reconnect churn that becomes a request storm (observed: ~7 req/s that
// trips the global throttler). A finite staleTime fetches once per window and
// serves the cache in between; `initialData` still guarantees a value on the
// first render, and the MMKV cache survives restarts.
const APP_CONFIG_STALE_TIME_MS = 5 * 60 * 1000;

export function useAppConfig(): UseQueryResult<AppConfig> {
  return useQuery({
    queryKey: ["app-config"],
    queryFn: fetchAppConfig,
    initialData: readCachedConfig() ?? DEFAULT_APP_CONFIG,
    staleTime: APP_CONFIG_STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });
}
