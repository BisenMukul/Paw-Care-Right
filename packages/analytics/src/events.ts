import type { Urgency } from "@pawcareright/types";

/**
 * The shared, typed PostHog event map (T078 plan decision 3 / SPEC §8).
 * Every event name + its property shape is declared here ONCE; `capture`
 * (see `./analytics.ts`) is generic over `keyof AnalyticsEventMap`, so an
 * unknown event name or a mismatched property shape is a `tsc` compile
 * error -- no zod/runtime validation needed for this guarantee (proven by
 * `events.spec.ts`'s `@ts-expect-error` cases).
 *
 * SAFETY (CLAUDE §7 / plan "Safety statement"): properties here are ids +
 * coarse enums ONLY. Never add free text, photos, or any AI-result field
 * (`summary`/`possibleCauses`/`redFlagsToWatch`/`homeCare`/`doNot`/
 * `vetQuestions`), email, breed, or pet name.
 */
export interface AnalyticsEventMap {
  first_check_completed: {
    checkId: string;
    householdId: string;
    status: "DONE" | "FALLBACK";
    urgency: Urgency;
  };
  paywall_view: {
    source: "onboarding" | "settings";
    householdId?: string;
  };
  trial_start: {
    householdId: string;
    plan: string | null;
  };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;
