import { parseRRule } from "@pawcareright/types";

import { computeNextFireAt } from "./next-fire-at";

/** A single sibling `Reminder`-to-be-created spec (never touches Prisma). */
export interface MedicationCourseSpec {
  type: "MEDICATION";
  title: string;
  rrule: string;
  timezone: string;
  startAt: Date;
  nextFireAt: Date;
  courseId: string;
  medNameAsEntered: string;
  medDoseAsEntered?: string;
  active: true;
}

export interface BuildMedicationCourseParams {
  medNameAsEntered: string;
  medDoseAsEntered?: string;
  doseStartAts: string[];
  courseLengthDays: number;
  timezone: string;
  courseId: string;
}

/**
 * Pure sibling-reminder generator (T061 plan decisions 1/2/6): the locked
 * RRULE grammar (`packages/types/src/rrule.ts`) has no BYHOUR / multiple-
 * times-per-day support, so a "2x/day for 10 days" course is modeled as TWO
 * sibling reminders (distinct `startAt` wall-clock times), each
 * `FREQ=DAILY;COUNT=<courseLengthDays>` -- COUNT deterministically
 * terminates each sibling after exactly `courseLengthDays` occurrences (no
 * `endsAt` column, no scheduler change). Identical `doseStartAts` instants
 * are de-duped (plan Risk 12) so the agenda never shows two identical rows.
 * Never touches Prisma; never performs dosing math (CLAUDE §7 rule 2).
 */
export function buildMedicationCourse(params: BuildMedicationCourseParams): MedicationCourseSpec[] {
  const rrule = `FREQ=DAILY;COUNT=${params.courseLengthDays}`;
  const parsed = parseRRule(rrule);
  if (!parsed.ok) {
    /* istanbul ignore next -- unreachable: `FREQ=DAILY;COUNT=<positive int>` is always a valid rrule. */
    throw new Error(`unreachable: generated rrule failed to parse: ${parsed.reason}`);
  }

  const seenEpochMs = new Set<number>();
  const specs: MedicationCourseSpec[] = [];

  for (const doseStartAt of params.doseStartAts) {
    const startAt = new Date(doseStartAt);
    const epochMs = startAt.getTime();
    if (seenEpochMs.has(epochMs)) {
      continue; // de-dupe identical dose-time instants
    }
    seenEpochMs.add(epochMs);

    const nextFireAt = computeNextFireAt(parsed.value, startAt, startAt, params.timezone);
    if (nextFireAt === null) {
      /* istanbul ignore next -- unreachable: `courseLengthDays >= 1` guarantees an occurrence at startAt itself. */
      throw new Error("rrule has no occurrence at or after startAt");
    }

    specs.push({
      type: "MEDICATION",
      title: params.medNameAsEntered,
      rrule,
      timezone: params.timezone,
      startAt,
      nextFireAt,
      courseId: params.courseId,
      medNameAsEntered: params.medNameAsEntered,
      ...(params.medDoseAsEntered !== undefined ? { medDoseAsEntered: params.medDoseAsEntered } : {}),
      active: true,
    });
  }

  return specs;
}
