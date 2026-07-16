import { useRouter } from "expo-router";
import { useEffect } from "react";

import { usePaywallShownStore } from "./paywall-shown-store";
import { usePremiumStore } from "./premium-store";

export interface UsePaywallOnboardingTriggerArgs {
  completedCheckCount: number;
}

/**
 * The onboarding-paywall trigger (T074 plan decisions 1/3): "after first
 * check result, before second". This hook is imported ONLY by
 * `app/check/index.tsx` (the check-ENTRY screen), which is strictly
 * upstream of the intake -> submit -> red-flag -> `onEmergency` ->
 * `/check/emergency/[checkId]` path. No file on that downstream path
 * imports this hook or the `/paywall` route, so the red-flag branch has no
 * paywall code on it and cannot be interposed on (§5/§7 rule 4 —
 * structural, not by copy).
 *
 * On mount, refreshes the (non-persisted) premium store from RC. The
 * effect then fires (push the onboarding paywall as a dismissible modal +
 * mark shown) ONLY when ALL of: `status === "free"` (definitively not
 * entitled -- "unknown" from an unloaded/absent native module NEVER
 * fires), `completedCheckCount >= 1` (a second check is starting), and the
 * paywall has not already been shown once. No-op otherwise.
 */
export function usePaywallOnboardingTrigger({ completedCheckCount }: UsePaywallOnboardingTriggerArgs): void {
  const router = useRouter();
  const status = usePremiumStore((state) => state.status);
  const shown = usePaywallShownStore((state) => state.shown);
  const markShown = usePaywallShownStore((state) => state.markShown);

  useEffect(() => {
    // Runs once on mount only -- a fresh refresh per check-entry visit.
    void usePremiumStore.getState().refresh();
  }, []);

  useEffect(() => {
    if (status === "free" && completedCheckCount >= 1 && !shown) {
      markShown();
      router.push({ pathname: "/paywall", params: { source: "onboarding" } });
    }
  }, [status, completedCheckCount, shown, markShown, router]);
}
