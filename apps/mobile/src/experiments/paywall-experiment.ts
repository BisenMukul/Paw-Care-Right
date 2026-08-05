import { PAYWALL_EXPERIMENT_KEY } from "@bombaypetcompany/analytics";
import type { PaywallVariant } from "@bombaypetcompany/types";

import { captureEvent } from "../analytics/analytics";
import { useAuthStore } from "../auth/auth-store";

/**
 * T107 plan step 6 — the paywall copy A/B experiment's emitters. No React
 * here (see `use-paywall-experiment-assignment.ts` for the assignment hook
 * and `app/paywall.tsx` for the exposure call site).
 *
 * `captureEvent` already no-ops when nobody is signed in
 * (`../analytics/analytics.ts`'s header comment) and when consent is off
 * (`../analytics/consent-store.ts`), so this module can never emit an
 * anonymous or opted-out event.
 *
 * Fix-round (checker F1, HIGH): `captureAssignmentOnce` used to consume the
 * dedupe latch UNCONDITIONALLY, before checking whether anyone was signed
 * in. Every cold start runs this effect at least once while
 * `useAuthStore`'s `status` is still `"restoring"`/`"signedOut"` (auth
 * restore is async and always resolves after the first render), so the
 * latch was permanently burned with NO event ever emitted — deterministically
 * dropping the assignment event for every arm-A user and every warm-cache
 * session (see the plan doc §3/§8 fix-round note). The guard below checks
 * signed-in status BEFORE touching the latch, so a signed-out call is a
 * true no-op (the latch stays free for the real, later, signed-in call —
 * see `use-resolved-paywall-variant.ts` for the caller-side half of this
 * fix, which additionally waits for an AUTHENTICATED config fetch).
 */
let assignedThisSession: PaywallVariant | null = null;

/** Enrolment event (D3): fired once per app session, the first time the resolved variant is observed AFTER sign-in. */
export function captureAssignmentOnce(variant: PaywallVariant): void {
  if (useAuthStore.getState().user?.id === undefined) {
    // Signed out (or not yet restored): do NOT consume the latch. A later,
    // genuinely signed-in call must still be able to fire (fixes F1).
    return;
  }
  if (assignedThisSession === variant) {
    return;
  }
  assignedThisSession = variant;
  captureEvent("paywall_experiment_assigned", { experiment: PAYWALL_EXPERIMENT_KEY, variant });
}

/** Exposure event (D3): the metric's denominator. Per-mount dedupe lives at the call site (`app/paywall.tsx`). */
export function captureExposure(variant: PaywallVariant): void {
  captureEvent("paywall_experiment_exposed", { experiment: PAYWALL_EXPERIMENT_KEY, variant });
}

/** Test seam only -- no production caller. Resets the module-level session dedupe state between tests. */
export function resetPaywallExperimentSession(): void {
  assignedThisSession = null;
}
