import { resolveCareTemplateForPet } from "@pawcareright/data";
import type { ReminderType, Species } from "@pawcareright/types";

import { daysAgo, daysFromNow, startOfUtcDay } from "../clock";
import { DEMO_COUNTRY, DEMO_TIMEZONE } from "../constants";
import { MEDICATION_DOSE_AS_ENTERED, MEDICATION_NAME_AS_ENTERED, MEDICATION_TITLE } from "../content";

export interface DemoReminderEventInput {
  dueAt: Date;
  status: "PENDING" | "DONE";
  completedAt?: Date;
}

export interface DemoReminderInput {
  petId: string;
  type: ReminderType;
  title: string;
  rrule: string;
  timezone: string;
  startAt: Date;
  nextFireAt: Date;
  active: boolean;
  templateKey?: string;
  medNameAsEntered?: string;
  medDoseAsEntered?: string;
  events: DemoReminderEventInput[];
}

/**
 * Care-plan density (plan "Pets" table): `rich` (Buddy) and `moderate`
 * (Cleo) both get completed history + a due-today occurrence; `sparse`
 * (Luna, a brand-new pet) gets ONLY future PENDING events — zero
 * completions (plan #7 / AC4).
 */
export type CarePlanDensity = "rich" | "moderate" | "sparse";

const FUTURE_OFFSET_DAYS = 14;
const PLAN_STARTED_DAYS_AGO = 90;

/** The chosen next-fire is the earliest still-PENDING event; falls back to the last built event. */
function pickNextFireAt(events: DemoReminderEventInput[]): Date {
  const pending = events
    .filter((event) => event.status === "PENDING")
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  return pending[0]?.dueAt ?? events[events.length - 1].dueAt;
}

/**
 * Rich (Buddy) per-item event pattern: every item gets one past-completed
 * occurrence within the trailing 7 days (so a future Care Score reads a
 * real, high signal — plan Risk R4) plus one future PENDING occurrence.
 * The FIRST item (always the vaccine item — `packages/data`'s base
 * schedule lists it first in every species/life-stage) also gets an
 * older completed occurrence, illustrating vaccine history.
 */
function richEvents(now: Date, index: number): DemoReminderEventInput[] {
  const withinWeekOffsets = [3, 0, 5, 6, 4];
  const daysBack = withinWeekOffsets[index % withinWeekOffsets.length];
  const pastDue = daysBack === 0 ? startOfUtcDay(now) : daysAgo(now, daysBack);

  const events: DemoReminderEventInput[] = [
    { dueAt: pastDue, status: "DONE", completedAt: pastDue },
    { dueAt: daysFromNow(now, FUTURE_OFFSET_DAYS), status: "PENDING" },
  ];

  if (index === 0) {
    const historyDue = daysAgo(now, 45);
    events.unshift({ dueAt: historyDue, status: "DONE", completedAt: historyDue });
  }

  return events;
}

/**
 * Moderate (Cleo) per-item event pattern: alternates a completed occurrence
 * within the trailing 7 days with a still-open due-today occurrence, plus a
 * future PENDING occurrence — a mixed, "partial" picture (plan #7).
 */
function moderateEvents(now: Date, index: number): DemoReminderEventInput[] {
  const isDone = index % 2 === 0;
  const future: DemoReminderEventInput = { dueAt: daysFromNow(now, FUTURE_OFFSET_DAYS), status: "PENDING" };

  if (!isDone) {
    return [{ dueAt: startOfUtcDay(now), status: "PENDING" }, future];
  }

  const doneOffsets = [3, 5, 4];
  const daysBack = doneOffsets[Math.floor(index / 2) % doneOffsets.length];
  const pastDue = daysAgo(now, daysBack);
  return [{ dueAt: pastDue, status: "DONE", completedAt: pastDue }, future];
}

/** Sparse (Luna) per-item event pattern: only a future PENDING occurrence — no completions. */
function sparseEvents(now: Date): DemoReminderEventInput[] {
  return [{ dueAt: daysFromNow(now, FUTURE_OFFSET_DAYS), status: "PENDING" }];
}

/**
 * Resolves `packages/data`'s care template for `pet` and turns each item
 * into one `Reminder` + its `ReminderEvent`s, per `density` (plan #7).
 */
export function buildCarePlan(
  pet: { id: string; species: Species; ageEstimateMonths: number },
  now: Date,
  density: CarePlanDensity,
): DemoReminderInput[] {
  const resolved = resolveCareTemplateForPet({
    species: pet.species,
    ageMonths: pet.ageEstimateMonths,
    countryCode: DEMO_COUNTRY,
  });

  return resolved.items.map((item, index) => {
    const events =
      density === "rich" ? richEvents(now, index) : density === "moderate" ? moderateEvents(now, index) : sparseEvents(now);

    return {
      petId: pet.id,
      type: item.reminderType,
      title: item.title,
      rrule: item.rrule,
      timezone: DEMO_TIMEZONE,
      startAt: daysAgo(now, PLAN_STARTED_DAYS_AGO),
      nextFireAt: pickNextFireAt(events),
      active: true,
      templateKey: item.id,
      events,
    };
  });
}

/**
 * The medication reminder (plan #7): a completed dose within the trailing
 * week (Care Score signal) plus a due-today occurrence still PENDING (the
 * next dose). Record-only med name/dose strings from `content.ts` — never
 * a suggested drug or dosage (CLAUDE §7 rule 2).
 */
export function buildMedicationReminder(pet: { id: string }, now: Date): DemoReminderInput {
  const completedDue = daysAgo(now, 2);
  const todayDue = startOfUtcDay(now);

  const events: DemoReminderEventInput[] = [
    { dueAt: completedDue, status: "DONE", completedAt: completedDue },
    { dueAt: todayDue, status: "PENDING" },
  ];

  return {
    petId: pet.id,
    type: "MEDICATION",
    title: MEDICATION_TITLE,
    rrule: "RRULE:FREQ=DAILY;INTERVAL=1",
    timezone: DEMO_TIMEZONE,
    startAt: daysAgo(now, 10),
    nextFireAt: pickNextFireAt(events),
    active: true,
    medNameAsEntered: MEDICATION_NAME_AS_ENTERED,
    medDoseAsEntered: MEDICATION_DOSE_AS_ENTERED,
    events,
  };
}
