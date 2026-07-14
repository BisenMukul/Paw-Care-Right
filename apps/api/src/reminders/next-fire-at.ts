import type { ParsedRRule, RRuleWeekday } from "@pawcareright/types";
import { RRULE_WEEKDAYS } from "@pawcareright/types";

/**
 * `computeNextFireAt` — pure, DST-correct "single next occurrence" helper
 * (T053 plan decision 2). Lives api-side (not `packages/types`) because it
 * needs IANA-timezone/DST math via Node's full-ICU `Intl`, which the shared
 * `rrule.ts` parser deliberately avoids for Hermes-safety.
 *
 * This module ships NO range-expansion / agenda engine (T055 owns that) —
 * only the single-next-occurrence contract the T055 create endpoint and the
 * T056 worker will call.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number;
}

interface ZonedDateTime extends CalendarDate {
  hour: number;
  minute: number;
  second: number;
}

/**
 * Formats `date` as its wall-clock representation in `timeZone`. Never
 * throws for a valid IANA `timeZone` (the DTO boundary's `@IsTimeZone()`
 * guarantees that by the time this pure helper runs).
 */
function getZonedDateTime(date: Date, timeZone: string): ZonedDateTime {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts: { [key: string]: string | undefined } = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }

  return {
    year: Number(parts.year ?? "0"),
    month: Number(parts.month ?? "1"),
    day: Number(parts.day ?? "1"),
    // hourCycle "h23" can format local midnight as "24" on some ICU builds;
    // normalize that back to 0.
    hour: Number(parts.hour ?? "0") % 24,
    minute: Number(parts.minute ?? "0"),
    second: Number(parts.second ?? "0"),
  };
}

/** The `timeZone` UTC offset (ms) in effect at `date`, derived from `getZonedDateTime`. */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const zoned = getZonedDateTime(date, timeZone);
  const asUtcMs = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);
  return asUtcMs - date.getTime();
}

/**
 * Converts a wall-clock time in `timeZone` to the UTC instant it represents.
 * Two-pass fixed point on the tz offset — DST-correct across ordinary
 * spring-forward/fall-back transitions.
 */
function zonedWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset1 = getTimeZoneOffsetMs(new Date(naiveUtcMs), timeZone);
  const candidateMs = naiveUtcMs - offset1;
  const offset2 = getTimeZoneOffsetMs(new Date(candidateMs), timeZone);
  const finalMs = offset2 === offset1 ? candidateMs : naiveUtcMs - offset2;
  return new Date(finalMs);
}

/** Pure calendar-day arithmetic (no timezone involved) via a UTC-anchored scratch `Date`. */
function addCalendarDays(date: CalendarDate, delta: number): CalendarDate {
  const scratch = new Date(Date.UTC(date.year, date.month - 1, date.day + delta));
  return { year: scratch.getUTCFullYear(), month: scratch.getUTCMonth() + 1, day: scratch.getUTCDate() };
}

function daysBetweenCalendar(from: CalendarDate, to: CalendarDate): number {
  const fromMs = Date.UTC(from.year, from.month - 1, from.day);
  const toMs = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toMs - fromMs) / MS_PER_DAY);
}

/** ISO weekday index: 0=Monday .. 6=Sunday (matches `RRULE_WEEKDAYS` order). */
function isoWeekdayIndex(date: CalendarDate): number {
  const jsDay = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay(); // 0=Sun..6=Sat
  return (jsDay + 6) % 7;
}

function weekdayCodeOf(date: CalendarDate): RRuleWeekday {
  return RRULE_WEEKDAYS[isoWeekdayIndex(date)] as RRuleWeekday;
}

/** Whether `cursor` (always `>= anchor` by construction) is an occurrence of `rule`. */
function matchesPattern(cursor: CalendarDate, anchor: CalendarDate, rule: ParsedRRule): boolean {
  const daysSinceAnchor = daysBetweenCalendar(anchor, cursor);

  switch (rule.freq) {
    case "DAILY":
      return daysSinceAnchor % rule.interval === 0;

    case "WEEKLY": {
      if (rule.byDay && rule.byDay.length > 0) {
        if (!rule.byDay.includes(weekdayCodeOf(cursor))) return false;
        const anchorMonday = addCalendarDays(anchor, -isoWeekdayIndex(anchor));
        const cursorMonday = addCalendarDays(cursor, -isoWeekdayIndex(cursor));
        const weeksSinceAnchor = daysBetweenCalendar(anchorMonday, cursorMonday) / 7;
        return weeksSinceAnchor % rule.interval === 0;
      }
      if (weekdayCodeOf(cursor) !== weekdayCodeOf(anchor)) return false;
      return daysSinceAnchor % (7 * rule.interval) === 0;
    }

    case "MONTHLY": {
      const monthsSinceAnchor = (cursor.year - anchor.year) * 12 + (cursor.month - anchor.month);
      if (monthsSinceAnchor < 0 || monthsSinceAnchor % rule.interval !== 0) return false;
      if (rule.byMonthDay && rule.byMonthDay.length > 0) {
        return rule.byMonthDay.includes(cursor.day);
      }
      return cursor.day === anchor.day;
    }

    case "YEARLY": {
      const yearsSinceAnchor = cursor.year - anchor.year;
      if (yearsSinceAnchor < 0 || yearsSinceAnchor % rule.interval !== 0) return false;
      return cursor.month === anchor.month && cursor.day === anchor.day;
    }

    default:
      return false;
  }
}

/** Bounds the forward day-by-day scan so the function is always total (never loops forever). */
const MAX_SCAN_DAYS = 20000; // ~54 years — generous for a single-occurrence lookup

/**
 * Returns the earliest occurrence instant `>= after` (UTC), anchored to the
 * wall-clock time-of-day of `startAt` interpreted in `timeZone`, honoring
 * `rule.freq`/`interval`/`byDay`/`byMonthDay`. Returns `null` once the
 * series is exhausted (`count`/`until` passed) before reaching `after`, or
 * if no occurrence is found within the scan bound.
 *
 * Pure and total — never throws, never mutates its inputs. `MONTHLY` with a
 * `byMonthDay` that doesn't exist in a given month (e.g. `31` in February)
 * simply produces no occurrence that month — it does NOT roll into the
 * next month.
 */
export function computeNextFireAt(rule: ParsedRRule, startAt: Date, after: Date, timeZone: string): Date | null {
  const anchorZoned = getZonedDateTime(startAt, timeZone);
  const anchor: CalendarDate = { year: anchorZoned.year, month: anchorZoned.month, day: anchorZoned.day };

  let cursor: CalendarDate = anchor;
  let occurrenceIndex = 0;

  for (let scanned = 0; scanned < MAX_SCAN_DAYS; scanned++) {
    if (matchesPattern(cursor, anchor, rule)) {
      occurrenceIndex++;
      if (rule.count !== undefined && occurrenceIndex > rule.count) {
        return null;
      }

      const instant = zonedWallClockToUtc(
        cursor.year,
        cursor.month,
        cursor.day,
        anchorZoned.hour,
        anchorZoned.minute,
        anchorZoned.second,
        timeZone,
      );

      if (rule.until !== undefined && instant.getTime() > rule.until.getTime()) {
        return null;
      }

      if (instant.getTime() >= after.getTime()) {
        return instant;
      }
    }

    cursor = addCalendarDays(cursor, 1);
  }

  return null;
}
