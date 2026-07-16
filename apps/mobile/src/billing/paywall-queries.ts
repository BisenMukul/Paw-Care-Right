import { appConfigResponseSchema, type PaywallVariant } from "@pawcareright/types";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiClient } from "../api/client";

import { fetchOfferings as fetchOfferingsFromNative } from "./purchases";
import type { PaywallOffering } from "./paywall-types";

export interface PaywallConfig {
  variant: PaywallVariant;
}

/** Offline-safe default (T074 plan decision 4/R6): used whenever `/v1/config` is unreachable or malformed. */
export const DEFAULT_PAYWALL_CONFIG: PaywallConfig = { variant: "A" };

/**
 * `GET /v1/config`, parsed with the shared `appConfigResponseSchema`. ANY
 * failure -- network error, offline, non-200, schema-invalid body --
 * resolves to the safe default (`variant: "A"`) rather than throwing, so
 * the paywall never blocks or shows undefined copy when the endpoint is
 * unreachable.
 */
export async function fetchPaywallConfig(): Promise<PaywallConfig> {
  try {
    const body = await apiClient.get<unknown>("/v1/config");
    const parsed = appConfigResponseSchema.parse(body);
    return { variant: parsed.paywall.variant };
  } catch {
    return DEFAULT_PAYWALL_CONFIG;
  }
}

/**
 * Wraps `fetchPaywallConfig` with `initialData` seeded to the safe default
 * so the paywall screen NEVER renders a loading/undefined variant (plan
 * Risk 6) -- a later successful fetch swaps the copy once, in place.
 */
export function usePaywallConfig(): UseQueryResult<PaywallConfig> {
  return useQuery({
    queryKey: ["paywall-config"],
    queryFn: fetchPaywallConfig,
    initialData: DEFAULT_PAYWALL_CONFIG,
  });
}

/** Wraps the RC-offering fetch (`purchases.ts`) as a query; `null` means "unavailable" (Expo Go / no offering). */
export function useOfferings(): UseQueryResult<PaywallOffering | null> {
  return useQuery({
    queryKey: ["paywall-offerings"],
    queryFn: fetchOfferingsFromNative,
  });
}
