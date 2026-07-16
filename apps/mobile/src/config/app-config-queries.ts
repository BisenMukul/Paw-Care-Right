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
export function useAppConfig(): UseQueryResult<AppConfig> {
  return useQuery({
    queryKey: ["app-config"],
    queryFn: fetchAppConfig,
    initialData: readCachedConfig() ?? DEFAULT_APP_CONFIG,
  });
}
