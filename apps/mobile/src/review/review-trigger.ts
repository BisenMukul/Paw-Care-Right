/**
 * T109 — pure smart-review-prompt trigger logic (card: "StoreReview request
 * only after positive moments (REASSURE result acknowledged, or 5th reminder
 * streak), max 1/60 days, never after emergencies"). This file has NO
 * storage/native/react imports -- every decision is a pure function so the
 * whole gate is exhaustively unit-testable without mocking anything.
 *
 * D1 (clock direction, deliberately opposite `ota/update-throttle.ts`'s
 * `shouldRecheck`): both the emergency window and the prompt throttle below
 * fail CLOSED on a backwards/future timestamp -- `lastX > now` is treated as
 * "still inside the window", not "never happened". `update-throttle.ts`
 * fails OPEN (a wedged clock must never permanently block an OTA safety
 * check); a review prompt is the opposite risk: a wedged clock must never
 * *unlock* a review ask right after an emergency or right after we already
 * asked. The worst case of failing closed here is that we simply never ask
 * for a rating, which costs nothing (§7 "uncertainty fails upward" spirit,
 * applied to a growth feature rather than a safety one).
 *
 * Decision order inside `decideReview` is "safety before growth": the
 * emergency suppression is checked BEFORE the throttle, which is checked
 * BEFORE the positive-moment/streak gate.
 */

export type PositiveMoment = "reassure-acknowledged" | "reminder-streak";

export interface ReviewGateState {
  /** Epoch ms of the last time we requested a review; `null` = never prompted. */
  lastPromptedAt: number | null;
  /** Epoch ms of the last recorded emergency; `null` = no emergency ever recorded. */
  lastEmergencyAt: number | null;
  /** Consecutive reminder completions (resets on snooze or an observed miss). Never negative. */
  completionStreak: number;
}

/** 60 days, in milliseconds (card: "max 1/60 days"). */
export const REVIEW_THROTTLE_MS = 60 * 24 * 60 * 60 * 1000;

/** 30 days, in milliseconds (D1 — founder call, see plan Risk R1). */
export const EMERGENCY_SUPPRESSION_MS = 30 * 24 * 60 * 60 * 1000;

/** Card: "5th reminder streak". */
export const REVIEW_STREAK_THRESHOLD = 5;

export type ReviewDecision =
  | "request"
  | "suppressed-throttle"
  | "suppressed-emergency"
  | "suppressed-streak";

/**
 * Pure decision function. Order (safety before growth):
 * 1. Emergency window active (fail-closed on a backwards/future clock) -> `"suppressed-emergency"`.
 * 2. Throttle window active (fail-closed on a backwards/future clock) -> `"suppressed-throttle"`.
 * 3. A `"reminder-streak"` moment that is not (yet) a multiple-of-5 streak -> `"suppressed-streak"`.
 * 4. Otherwise -> `"request"`.
 */
export function decideReview(args: { now: number; moment: PositiveMoment; state: ReviewGateState }): ReviewDecision {
  const { now, moment, state } = args;

  if (
    state.lastEmergencyAt !== null &&
    (state.lastEmergencyAt > now || now - state.lastEmergencyAt < EMERGENCY_SUPPRESSION_MS)
  ) {
    return "suppressed-emergency";
  }

  if (
    state.lastPromptedAt !== null &&
    (state.lastPromptedAt > now || now - state.lastPromptedAt < REVIEW_THROTTLE_MS)
  ) {
    return "suppressed-throttle";
  }

  if (moment === "reminder-streak" && !(state.completionStreak > 0 && state.completionStreak % REVIEW_STREAK_THRESHOLD === 0)) {
    return "suppressed-streak";
  }

  return "request";
}

/** Convenience boolean form: `true` iff `decideReview(...) === "request"`. */
export function shouldRequestReview(args: { now: number; moment: PositiveMoment; state: ReviewGateState }): boolean {
  return decideReview(args) === "request";
}

/**
 * Pure: next streak value for a reminder event. `"completed"` increments;
 * `"snoozed"` and `"missed"` both reset to 0. Never returns a negative value.
 */
export function nextStreak(current: number, event: "completed" | "snoozed" | "missed"): number {
  if (event === "completed") {
    return current + 1;
  }
  return 0;
}

/** Pure: does a loaded agenda window contain a MISSED occurrence? */
export function hasMissedEntry(entries: readonly { status: string }[]): boolean {
  return entries.some((entry) => entry.status === "MISSED");
}
