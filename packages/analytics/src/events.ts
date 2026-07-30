import type { Urgency } from "@bombaypetcompany/types";

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
 * `vetQuestions`), email, breed, or pet name. T117's three `ota_*` events
 * (OTA_UPDATES §7) are no exception: every property is a machine id
 * (`updateId`/`fromUpdateId`/`channel`/`currentUpdateId`), a boolean, or a
 * number (`latencyMs`) -- never a manifest/update message or any other
 * free-text field.
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
  ota_available: {
    channel: string | null;
    currentUpdateId: string | null;
  };
  ota_downloaded: {
    channel: string | null;
    currentUpdateId: string | null;
    critical: boolean;
  };
  ota_applied: {
    updateId: string | null;
    fromUpdateId: string | null;
    latencyMs: number;
  };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;
