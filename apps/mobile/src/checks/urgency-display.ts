import type { Urgency } from "@pawcareright/types";

/**
 * Tier banner presentation map (T048 plan D4). One banner component reads
 * this map instead of five per-tier components; user-facing copy is never
 * stored here (it lives in `strings.check.result.tierLabel`).
 */
export interface UrgencyDisplay {
  containerClass: string;
  textClass: string;
  testId: string;
  /** History-row chip fill (dark-on-light-tint direction, §1.1-blessed) — small (12px) text needs 4.5:1, unreachable with white-on-fill for several tiers. See `urgency-contrast.test.ts`. */
  chipContainerClass: string;
  /** History-row chip text, paired with `chipContainerClass`. */
  chipTextClass: string;
}

export const URGENCY_DISPLAY: Record<Urgency, UrgencyDisplay> = {
  EMERGENCY_NOW: {
    containerClass: "bg-red-600",
    textClass: "text-white",
    testId: "urgency-banner-EMERGENCY_NOW",
    chipContainerClass: "bg-red-100",
    chipTextClass: "text-red-900",
  },
  // NOTE: bg-orange-500 (white-on-fill = 2.81:1) failed the WCAG 3:1
  // large-text floor for the banner; bg-orange-600 (3.56:1) is the minimal
  // hue-preserving fix (plan Risk R3 / urgency-contrast.test.ts).
  VET_24H: {
    containerClass: "bg-orange-600",
    textClass: "text-white",
    testId: "urgency-banner-VET_24H",
    chipContainerClass: "bg-orange-100",
    chipTextClass: "text-orange-900",
  },
  VET_SOON: {
    containerClass: "bg-amber-400",
    textClass: "text-amber-950",
    testId: "urgency-banner-VET_SOON",
    chipContainerClass: "bg-amber-100",
    chipTextClass: "text-amber-950",
  },
  MONITOR: {
    containerClass: "bg-blue-500",
    textClass: "text-white",
    testId: "urgency-banner-MONITOR",
    chipContainerClass: "bg-blue-100",
    chipTextClass: "text-blue-900",
  },
  REASSURE: {
    containerClass: "bg-green-600",
    textClass: "text-white",
    testId: "urgency-banner-REASSURE",
    chipContainerClass: "bg-green-100",
    chipTextClass: "text-green-900",
  },
};
