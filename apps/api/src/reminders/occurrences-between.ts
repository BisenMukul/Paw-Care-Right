import type { ParsedRRule } from "@pawcareright/types";

import { computeNextFireAt } from "./next-fire-at";

/**
 * `occurrencesBetween` — T055 plan decision 2: a pure range-expander built
 * by ITERATING the proven single-occurrence helper `computeNextFireAt`
 * (T053), never re-implementing tz/DST math here. Each iteration re-queries
 * "what's the next occurrence at-or-after `cursor`", advancing `cursor` to
 * just past the found instant, until either the series is exhausted
 * (`computeNextFireAt` returns `null`) or the next occurrence would fall
 * after `to`.
 *
 * Total function: `from > to` short-circuits to `[]`; `MAX_OCCURRENCES`
 * backstops runaway series so this never loops unbounded even for a
 * pathological `rule`/window combination.
 */
const MAX_OCCURRENCES = 500;

export function occurrencesBetween(
  rule: ParsedRRule,
  startAt: Date,
  timeZone: string,
  from: Date,
  to: Date,
): Date[] {
  if (from.getTime() > to.getTime()) {
    return [];
  }

  const occurrences: Date[] = [];
  let cursor = from;

  for (let scanned = 0; scanned < MAX_OCCURRENCES; scanned++) {
    const next = computeNextFireAt(rule, startAt, cursor, timeZone);
    if (next === null || next.getTime() > to.getTime()) {
      break;
    }

    occurrences.push(next);
    cursor = new Date(next.getTime() + 1);
  }

  return occurrences;
}
