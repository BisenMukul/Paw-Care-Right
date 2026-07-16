import type { PaywallVariant } from "@pawcareright/types";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { readCachedConfig } from "../config/app-config-cache";
import { DEFAULT_APP_CONFIG, fetchAppConfig } from "../config/app-config-queries";

import { fetchOfferings as fetchOfferingsFromNative } from "./purchases";
import type { PaywallOffering } from "./paywall-types";

export interface PaywallConfig {
  variant: PaywallVariant;
}

/** Offline-safe default (T074 plan decision 4/R6): used whenever `/v1/config` is unreachable or malformed. */
export const DEFAULT_PAYWALL_CONFIG: PaywallConfig = { variant: "A" };

/**
 * Thin selector over the shared `fetchAppConfig()` (T079 plan decision 5) --
 * ONE network call/cache backs both the paywall variant and the rest of
 * `AppConfig`. Preserves the original `PaywallConfig` public shape so
 * `paywall.tsx` is unchanged.
 */
export async function fetchPaywallConfig(): Promise<PaywallConfig> {
  const config = await fetchAppConfig();
  return { variant: config.variant };
}

/**
 * Thin `select` over the SAME `["app-config"]` query used by `useAppConfig`
 * (T079 plan decision 5): one network call, shared cache. `initialData` is
 * seeded from the cache-or-default so the paywall screen NEVER renders a
 * loading/undefined variant (plan Risk 6).
 */
export function usePaywallConfig(): UseQueryResult<PaywallConfig> {
  return useQuery({
    queryKey: ["app-config"],
    queryFn: fetchAppConfig,
    initialData: readCachedConfig() ?? DEFAULT_APP_CONFIG,
    select: (config): PaywallConfig => ({ variant: config.variant }),
  });
}

/** Wraps the RC-offering fetch (`purchases.ts`) as a query; `null` means "unavailable" (Expo Go / no offering). */
export function useOfferings(): UseQueryResult<PaywallOffering | null> {
  return useQuery({
    queryKey: ["paywall-offerings"],
    queryFn: fetchOfferingsFromNative,
  });
}
