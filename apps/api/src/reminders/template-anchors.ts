import type { TemplateAnchor } from "@pawcareright/data";

/**
 * Anchor-derivation helpers for T055's `from-template` instantiation (plan
 * "Instantiation semantics" + Risk R8). Pure, calendar-day/month arithmetic
 * via UTC-anchored scratch `Date`s -- no `Intl`/timezone math here (that
 * belongs to `next-fire-at.ts`; the instantiated reminder's own `timezone`
 * is supplied by the caller's request body, not derived here).
 */

/** Pure calendar-day addition (no timezone involved). */
function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Pure calendar-month subtraction (no timezone involved). */
function subtractCalendarMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  result.setUTCMonth(result.getUTCMonth() - months);
  return result;
}

/** Whole calendar months between `birthDate` and `now` (never negative). */
function monthsBetween(birthDate: Date, now: Date): number {
  let months =
    (now.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 + (now.getUTCMonth() - birthDate.getUTCMonth());
  if (now.getUTCDate() < birthDate.getUTCDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

/**
 * The pet's age in whole months, for life-stage resolution
 * (`resolveLifeStage`). `birthDate` (if present) is the source of truth;
 * otherwise falls back to the caller-recorded `ageEstimateMonths` as-is.
 * `null` when neither is known.
 */
export function petAgeMonths(
  pet: { birthDate: Date | null; ageEstimateMonths: number | null },
  now: Date,
): number | null {
  if (pet.birthDate !== null) {
    return monthsBetween(pet.birthDate, now);
  }
  if (pet.ageEstimateMonths !== null) {
    return pet.ageEstimateMonths;
  }
  return null;
}

/**
 * Derives a template item's `startAt` (DTSTART) per its `anchor` (Risk R8):
 * - `PLAN_START` -> `now + startOffsetDays`.
 * - `PET_AGE` -> `effectiveBirthDate + startOffsetDays`, where
 *   `effectiveBirthDate = pet.birthDate ?? (pet.ageEstimateMonths != null ?
 *   now - ageEstimateMonths months : null)`.
 *
 * Returns `null` for an unanchorable `PET_AGE` item (no derivable birth
 * date) -- the caller (`RemindersService.instantiateFromTemplate`) skips
 * that item rather than guessing a start date.
 */
export function deriveTemplateStartAt(
  item: { anchor: TemplateAnchor; startOffsetDays: number },
  pet: { birthDate: Date | null; ageEstimateMonths: number | null },
  now: Date,
): Date | null {
  if (item.anchor === "PLAN_START") {
    return addCalendarDays(now, item.startOffsetDays);
  }

  const effectiveBirthDate =
    pet.birthDate ?? (pet.ageEstimateMonths !== null ? subtractCalendarMonths(now, pet.ageEstimateMonths) : null);

  if (effectiveBirthDate === null) {
    return null;
  }

  return addCalendarDays(effectiveBirthDate, item.startOffsetDays);
}
