import { URGENCY_SEVERITY, type Urgency } from "@pawcareright/types";

/**
 * Pure, platform-agnostic "find a vet" deep link (T048 plan D6). Google's
 * documented universal maps search URL opens the native Maps app on
 * iOS/Android with a browser fallback, so this stays pure and deterministic
 * (no `Platform.select` geo:/maps: branching).
 */
export const VET_SEARCH_MAPS_BASE = "https://www.google.com/maps/search/?api=1&query=";
export const EMERGENCY_VET_QUERY = "emergency vet near me";
export const ROUTINE_VET_QUERY = "veterinarian near me";

export function buildVetSearchQuery(urgency: Urgency): string {
  return URGENCY_SEVERITY[urgency] <= URGENCY_SEVERITY.VET_24H ? EMERGENCY_VET_QUERY : ROUTINE_VET_QUERY;
}

export function buildVetSearchUrl(urgency: Urgency): string {
  return `${VET_SEARCH_MAPS_BASE}${encodeURIComponent(buildVetSearchQuery(urgency))}`;
}
