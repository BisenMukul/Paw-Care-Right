import {
  appConfigClientSchema,
  NO_GATE_VERSION,
  type FeatureFlags,
  type PaywallVariant,
  type PlatformAppVersions,
} from "@bombaypetcompany/types";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiClient } from "../api/client";

import { readCachedConfig, writeCachedConfig } from "./app-config-cache";

export interface AppConfig {
  variant: PaywallVariant;
  minSupportedVersion: string;
  hotlinePackVersion: number;
  features: FeatureFlags;
  /** T114: the EAS updateId that MUST be running; `null` = no critical update. */
  criticalOtaVersion: string | null;
  /** T115: per-platform blocking gate; "0.0.0" on both platforms = no gate. */
  minAppVersion: PlatformAppVersions;
  /** T115: per-platform dismissible-banner gate; "0.0.0" on both platforms = no gate. */
  recommendedAppVersion: PlatformAppVersions;
}

/**
 * Permissive default (T079 plan decision 5; grown by T106 D10): used
 * whenever `/v1/config` is unreachable/malformed AND there is no cached
 * last-known-good config. The permissive `minSupportedVersion` ("0.0.0")
 * means the update gate never blocks anyone under this default (CLAUDE.md
 * §7 fail-open posture). `features` defaults to all `true` for the SAME
 * reason: a client that cannot reach `/config` must not lock itself out of
 * a symptom check or chat -- the API is the authoritative enforcement point
 * (D6), never the client default.
 *
 * T114: `criticalOtaVersion` defaults to `null` -- the fail-safe default is
 * "no critical update", so a client on this fallback can never be prompted
 * to reload based on stale/missing config.
 *
 * T115: `minAppVersion`/`recommendedAppVersion` default to `"0.0.0"` on both
 * platforms (`NO_GATE_VERSION`) -- a client on this fallback can never be
 * blocked or shown the recommended-update banner.
 */
export const DEFAULT_APP_CONFIG: AppConfig = {
  variant: "A",
  minSupportedVersion: "0.0.0",
  hotlinePackVersion: 1,
  features: { checks: true, chat: true, paywall: true },
  criticalOtaVersion: null,
  minAppVersion: { ios: NO_GATE_VERSION, android: NO_GATE_VERSION },
  recommendedAppVersion: { ios: NO_GATE_VERSION, android: NO_GATE_VERSION },
};

/**
 * `GET /v1/config`, parsed with the CLIENT-tolerant `appConfigClientSchema`
 * (T115 / docs/OTA_UPDATES.md §5.4 -- T114 checker Finding 1) and flattened
 * to `AppConfig`. Unlike the server's own `.strict()` contract schema, this
 * parse path tolerates unknown/future top-level and nested keys and
 * defaults `minAppVersion`/`recommendedAppVersion` when the server omits
 * them, so an old bundle's parse can never reject a body -- and lose the
 * `features` kill switches -- just because the server grew a field. On
 * success, writes the MMKV last-known-good cache and returns the fresh
 * config. On ANY failure -- network error, offline, non-200, schema-invalid
 * body (e.g. a pre-existing required field is missing/malformed) -- returns
 * the cached config when one exists, else the safe (fail-open) default.
 * Never throws.
 */
export async function fetchAppConfig(): Promise<AppConfig> {
  try {
    const body = await apiClient.get<unknown>("/v1/config");
    const parsed = appConfigClientSchema.parse(body);
    const config: AppConfig = {
      variant: parsed.paywall.variant,
      minSupportedVersion: parsed.minSupportedVersion,
      hotlinePackVersion: parsed.hotlinePackVersion,
      features: parsed.features,
      criticalOtaVersion: parsed.criticalOtaVersion,
      minAppVersion: parsed.minAppVersion,
      recommendedAppVersion: parsed.recommendedAppVersion,
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
