import { useEffect } from "react";

import { captureAssignmentOnce } from "./paywall-experiment";
import { useResolvedPaywallVariant } from "./use-resolved-paywall-variant";

/**
 * T107 plan step 7 — mounted once from the root layout (`app/_layout.tsx`).
 * No render output, no state of its own, no navigation — cannot throw (the
 * effect body is a single, non-throwing dedupe check).
 *
 * Fix-round (checker F1+F2): reads `useResolvedPaywallVariant()` rather than
 * `usePaywallConfig()` directly, and only calls `captureAssignmentOnce` once
 * `resolved` is `true` — i.e. after an AUTHENTICATED `/v1/config` fetch has
 * settled. Before the fix this fired (or rather, silently latched-and-
 * dropped — see `paywall-experiment.ts`'s F1 comment) on the very first
 * render, while signed out and against the anonymous fallback variant.
 */
export function usePaywallExperimentAssignment(): void {
  const { variant, resolved } = useResolvedPaywallVariant();

  useEffect(() => {
    if (!resolved) {
      return;
    }
    captureAssignmentOnce(variant);
  }, [resolved, variant]);
}
