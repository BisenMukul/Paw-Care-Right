import type { AgendaEntry } from "@pawcareright/types";

import { strings } from "../strings";

export type CareScoreBucket = "onTrack" | "someToLog" | "catchUp";

export type CareScoreResult =
  | { kind: "score"; value: number; bucket: CareScoreBucket } // value 0..100 integer
  | { kind: "insufficient" }; // no due routine in window

/** Trailing-day window the score is computed over (FIDELITY-1 plan). */
export const CARE_SCORE_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function bucketFor(value: number): CareScoreBucket {
  if (value >= 80) {
    return "onTrack";
  }
  if (value >= 40) {
    return "someToLog";
  }
  return "catchUp";
}

/**
 * Deterministic, single-signal Care Score (FIDELITY-1 plan Risk R2 --
 * intentionally coarse: the only real per-pet routine signal available is
 * agenda occurrences, done vs due, over the trailing
 * `CARE_SCORE_WINDOW_DAYS`). `now` is injected so the result is reproducible
 * in tests and across renders within the same tick.
 *
 * Formula: window = `[startOfDay(now) - (CARE_SCORE_WINDOW_DAYS-1) days,
 * now]`. Only entries with `dueAt <= now` are "due" (future occurrences are
 * not yet actionable, so they are excluded rather than penalised). No due
 * entries in the window -> `{kind:"insufficient"}` (honest: there is no
 * routine to measure completeness against, never a fake 0 or 100 -- plan R4).
 * Otherwise `value = round((doneCount/dueCount) * 100)`, clamped 0..100, and
 * bucketed onTrack (>=80) / someToLog (40..79) / catchUp (<40).
 */
export function computeCareScore(input: { entries: AgendaEntry[]; now: Date }): CareScoreResult {
  const { entries, now } = input;
  const nowMs = now.getTime();
  const windowStartMs = startOfDay(now).getTime() - (CARE_SCORE_WINDOW_DAYS - 1) * DAY_MS;

  let dueCount = 0;
  let doneCount = 0;
  for (const entry of entries) {
    const dueAtMs = new Date(entry.dueAt).getTime();
    if (dueAtMs > nowMs) {
      continue; // future occurrence: not yet actionable, never penalised
    }
    if (dueAtMs < windowStartMs) {
      continue; // outside the trailing window
    }
    dueCount += 1;
    if (entry.status === "DONE") {
      doneCount += 1;
    }
  }

  if (dueCount === 0) {
    return { kind: "insufficient" };
  }

  const value = clampScore(Math.round((doneCount / dueCount) * 100));
  return { kind: "score", value, bucket: bucketFor(value) };
}

/** Bucket -> record-only display line (reads `strings.careScore`, no React). */
export function careScoreBucketLine(result: CareScoreResult): string {
  if (result.kind === "insufficient") {
    return strings.careScore.bucketInsufficient;
  }
  switch (result.bucket) {
    case "onTrack":
      return strings.careScore.bucketOnTrack;
    case "someToLog":
      return strings.careScore.bucketSomeToLog;
    case "catchUp":
      return strings.careScore.bucketCatchUp;
  }
}
