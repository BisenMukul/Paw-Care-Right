/**
 * `computeDeferUntil` — pure, DST-correct "quiet hours" defer helper (T058
 * plan decision 3). Returns the UTC instant of the next quiet-window END if
 * `now` currently falls inside the caller's quiet window, else `null`
 * (deliver immediately). Window is start-inclusive, end-exclusive.
 *
 * The zoned-wall-clock<->UTC math (`getZonedWallClock` /
 * `zonedWallClockToUtc`) is a minimal copy of the same two-pass DST
 * fixed-point approach `apps/api/src/reminders/next-fire-at.ts` uses
 * (that file's helpers are private, and this module's needs are narrow
 * enough that widening `next-fire-at.ts`'s public surface — and risking its
 * existing tests — isn't worth it; see plan Risk 3). `next-fire-at.ts` is
 * left untouched.
 */

interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number;
}

interface ZonedWallClock extends CalendarDate {
  hour: number;
  minute: number;
}

/** Formats `date` as its wall-clock `{y,m,d,hh,mm}` in `timeZone`. Never throws for a valid IANA `timeZone`. */
function getZonedWallClock(date: Date, timeZone: string): ZonedWallClock {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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
  };
}

/** The `timeZone` UTC offset (ms) in effect at `date`. */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const zoned = getZonedWallClock(date, timeZone);
  const asUtcMs = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, 0);
  return asUtcMs - date.getTime();
}

/**
 * Converts a wall-clock time in `timeZone` to the UTC instant it
 * represents. Two-pass fixed point on the tz offset — DST-correct across
 * ordinary spring-forward/fall-back transitions.
 */
function zonedWallClockToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
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

/** Parses a validated `HH:mm` string into minutes-since-midnight. Never throws for well-formed input. */
function parseHhMm(value: string): number {
  const [hh, mm] = value.split(":");
  return Number(hh ?? "0") * 60 + Number(mm ?? "0");
}

export interface QuietHoursPrefs {
  quietStart: string | null;
  quietEnd: string | null;
  timezone: string | null;
}

/**
 * Defer semantics (T058 plan "Defer semantics"):
 * - No quiet window configured (any of the three null) -> `null`.
 * - Non-straddling window (`start < end`): in-window iff `start <= t < end`.
 * - Straddling window (`start > end`, e.g. 22:00-07:00): in-window iff
 *   `t >= start || t < end`.
 * - `start === end` -> never in window (treated as no-op quiet window).
 * - Outside the window -> `null` (deliver now).
 * - Inside the window -> the next window-end UTC instant: for a straddling
 *   window, tomorrow's calendar day if `t >= start` (evening side), else
 *   today (early-morning side); for a non-straddling window, always today.
 *
 * Pure, total, never throws for a valid IANA `timezone`.
 */
export function computeDeferUntil(prefs: QuietHoursPrefs, now: Date): Date | null {
  const { quietStart, quietEnd, timezone } = prefs;
  if (quietStart === null || quietEnd === null || timezone === null) {
    return null;
  }

  const start = parseHhMm(quietStart);
  const end = parseHhMm(quietEnd);
  if (start === end) {
    return null;
  }

  const zoned = getZonedWallClock(now, timezone);
  const t = zoned.hour * 60 + zoned.minute;
  const today: CalendarDate = { year: zoned.year, month: zoned.month, day: zoned.day };

  const straddling = start > end;
  const inWindow = straddling ? t >= start || t < end : t >= start && t < end;
  if (!inWindow) {
    return null;
  }

  const endDay = straddling && t >= start ? addCalendarDays(today, 1) : today;
  const endHour = Math.floor(end / 60);
  const endMinute = end % 60;

  return zonedWallClockToUtc(endDay.year, endDay.month, endDay.day, endHour, endMinute, timezone);
}
