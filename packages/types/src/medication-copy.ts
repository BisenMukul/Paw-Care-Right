/**
 * Medication tracker static copy (T061 plan decision 7; CLAUDE §7 rule 2 --
 * THE load-bearing constraint: the med tracker RECORDS what a vet
 * prescribed, it NEVER suggests). Every user-facing string T061 renders
 * lives here, as the single source of truth both the mobile UI
 * (`apps/mobile/src/strings.ts`) and the T038 detector lint test
 * (`packages/ai/src/evals/medication-copy-safety.spec.ts`) import -- so the
 * tested string is byte-identical to the rendered string (no drift).
 * Mirrors the `FOOD_SAFETY_FALLBACK`/`SAFE_FALLBACK` precedent of
 * safety-critical constants living in `@pawcareright/types` (plan decision
 * 10).
 *
 * Constraints on every value below (mechanically enforced by the detector
 * spec, never by convention alone): no digit+unit ("5mg"), no drug names, no
 * "give/administer ... every N ..." phrasing, no "diagnos*" substring, and no
 * hardcoded product display name (CLAUDE §1a). Placeholders in particular
 * contain no dose example (no numbers, no units) so they can never read as a
 * suggested amount.
 */

export const MEDICATION_FORM_HEADING = "Medication reminders";
export const MEDICATION_NAME_LABEL = "Medication name";
export const MEDICATION_NAME_PLACEHOLDER = "Exactly as written by your vet";
export const MEDICATION_DOSE_LABEL = "Dose";
export const MEDICATION_DOSE_PLACEHOLDER = "Exactly as instructed by your vet";
export const MEDICATION_DOSE_TIMES_LABEL = "Times each day";
export const MEDICATION_ADD_TIME_LABEL = "Add another time";
export const MEDICATION_COURSE_LENGTH_LABEL = "Number of days";
export const MEDICATION_DISCLAIMER =
  "Enter exactly what your vet prescribed. We never suggest medications or doses.";
export const MEDICATION_SAVE_LABEL = "Save medication reminders";
export const MEDICATION_AGENDA_DOSE_LABEL = "Dose (as entered)";

/**
 * Every string above, aggregated for the mechanical detector-reuse gate
 * (AC2). Frozen so callers cannot mutate the shared array.
 */
export const MEDICATION_STATIC_COPY: readonly string[] = Object.freeze([
  MEDICATION_FORM_HEADING,
  MEDICATION_NAME_LABEL,
  MEDICATION_NAME_PLACEHOLDER,
  MEDICATION_DOSE_LABEL,
  MEDICATION_DOSE_PLACEHOLDER,
  MEDICATION_DOSE_TIMES_LABEL,
  MEDICATION_ADD_TIME_LABEL,
  MEDICATION_COURSE_LENGTH_LABEL,
  MEDICATION_DISCLAIMER,
  MEDICATION_SAVE_LABEL,
  MEDICATION_AGENDA_DOSE_LABEL,
]);
