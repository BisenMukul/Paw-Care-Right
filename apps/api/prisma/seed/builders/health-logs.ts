import type { ActivityType, ActivityUnit } from "@pawcareright/types";

import { daysAgo, startOfUtcDay } from "../clock";
import { ACTIVITY_NOTES } from "../content";

/**
 * Plain `HealthLog` create-inputs (plan #6) — pure, `now`-injected, no
 * randomness. `kind` is restricted to the 5 kinds this task is allowed to
 * write (`WEIGHT`/`MEAL`/`NOTE`/`VET_VISIT`/`ACTIVITY`) — `MED_GIVEN` and
 * `CHECK_REF` are read-time projections (T061/T064, plan Risk R2) and are
 * NEVER built here.
 */
export interface DemoHealthLogInput {
  petId: string;
  kind: "WEIGHT" | "MEAL" | "NOTE" | "VET_VISIT" | "ACTIVITY";
  valueJson: Record<string, unknown>;
  occurredAt: Date;
}

/**
 * A gentle, deterministic weight trend: `points` samples spread evenly
 * across the trailing `spanDays`, starting at `startWeightGrams` and
 * increasing by `trendGramsPerPoint` per sample (oldest sample first).
 */
export function buildWeightSeries(
  petId: string,
  now: Date,
  points: number,
  spanDays: number,
  startWeightGrams: number,
  trendGramsPerPoint: number,
): DemoHealthLogInput[] {
  const step = spanDays / Math.max(points - 1, 1);
  const series: DemoHealthLogInput[] = [];

  for (let i = 0; i < points; i += 1) {
    const daysBack = Math.round(spanDays - i * step);
    series.push({
      petId,
      kind: "WEIGHT",
      valueJson: { weightGrams: startWeightGrams + trendGramsPerPoint * i },
      occurredAt: daysAgo(now, daysBack),
    });
  }

  return series;
}

interface ActivityEntry {
  activityType: ActivityType;
  unit: ActivityUnit;
  quantity?: number;
  note?: string;
  occurredAt: Date;
}

function toActivityLog(petId: string, entry: ActivityEntry): DemoHealthLogInput {
  return {
    petId,
    kind: "ACTIVITY",
    valueJson: {
      activityType: entry.activityType,
      ...(entry.quantity !== undefined ? { quantity: entry.quantity } : {}),
      unit: entry.unit,
      ...(entry.note !== undefined ? { note: entry.note } : {}),
    },
    occurredAt: entry.occurredAt,
  };
}

/**
 * The rich activity set: all 7 `ActivityType`s, with FOOD/WATER/POTTY/WALK/
 * PLAY dated TODAY (plan #6 / AC3) and SLEEP/GROOMING dated recently.
 */
export function buildActivities(petId: string, now: Date): DemoHealthLogInput[] {
  const today = startOfUtcDay(now);

  const entries: ActivityEntry[] = [
    { activityType: "FOOD", unit: "meals", quantity: 2, occurredAt: today },
    { activityType: "WATER", unit: "bowls", quantity: 1, occurredAt: today },
    { activityType: "POTTY", unit: "both", occurredAt: today },
    { activityType: "WALK", unit: "min", quantity: 30, note: ACTIVITY_NOTES.walk, occurredAt: today },
    { activityType: "PLAY", unit: "min", quantity: 15, note: ACTIVITY_NOTES.play, occurredAt: today },
    { activityType: "SLEEP", unit: "min", quantity: 480, occurredAt: daysAgo(now, 2) },
    { activityType: "GROOMING", unit: "brush", note: ACTIVITY_NOTES.grooming, occurredAt: daysAgo(now, 6) },
  ];

  return entries.map((entry) => toActivityLog(petId, entry));
}

/** Luna's (sparse/new) single minimal activity log. */
export function buildSparseActivity(petId: string, now: Date): DemoHealthLogInput[] {
  return [toActivityLog(petId, { activityType: "FOOD", unit: "meals", quantity: 1, occurredAt: daysAgo(now, 1) })];
}

export function buildNotes(petId: string, now: Date, notes: ReadonlyArray<{ text: string; daysBack: number }>): DemoHealthLogInput[] {
  return notes.map((n) => ({ petId, kind: "NOTE", valueJson: { text: n.text }, occurredAt: daysAgo(now, n.daysBack) }));
}

export function buildMeals(
  petId: string,
  now: Date,
  meals: ReadonlyArray<{ note: string; daysBack: number; portionGrams?: number }>,
): DemoHealthLogInput[] {
  return meals.map((m) => ({
    petId,
    kind: "MEAL",
    valueJson: { note: m.note, ...(m.portionGrams !== undefined ? { portionGrams: m.portionGrams } : {}) },
    occurredAt: daysAgo(now, m.daysBack),
  }));
}

export function buildVetVisits(
  petId: string,
  now: Date,
  visits: ReadonlyArray<{ reason: string; clinicName?: string; notes?: string; daysBack: number }>,
): DemoHealthLogInput[] {
  return visits.map((v) => ({
    petId,
    kind: "VET_VISIT",
    valueJson: {
      reason: v.reason,
      ...(v.clinicName !== undefined ? { clinicName: v.clinicName } : {}),
      ...(v.notes !== undefined ? { notes: v.notes } : {}),
    },
    occurredAt: daysAgo(now, v.daysBack),
  }));
}
