import type { Urgency } from "@pawcareright/types";

/**
 * Tier banner presentation map (T048 plan D4). One banner component reads
 * this map instead of five per-tier components; user-facing copy is never
 * stored here (it lives in `strings.check.result.tierLabel`).
 */
export const URGENCY_DISPLAY: Record<Urgency, { containerClass: string; textClass: string; testId: string }> = {
  EMERGENCY_NOW: { containerClass: "bg-red-600", textClass: "text-white", testId: "urgency-banner-EMERGENCY_NOW" },
  VET_24H: { containerClass: "bg-orange-500", textClass: "text-white", testId: "urgency-banner-VET_24H" },
  VET_SOON: { containerClass: "bg-amber-400", textClass: "text-amber-950", testId: "urgency-banner-VET_SOON" },
  MONITOR: { containerClass: "bg-blue-500", textClass: "text-white", testId: "urgency-banner-MONITOR" },
  REASSURE: { containerClass: "bg-green-600", textClass: "text-white", testId: "urgency-banner-REASSURE" },
};
