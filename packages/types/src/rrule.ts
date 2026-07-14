import { z } from "zod";

/**
 * RRULE-subset validator/parser (T053 plan decision 1).
 *
 * This is a small, hand-rolled RFC5545 `RRULE` subset — NOT the `rrule` npm
 * package (CLAUDE §2 rule 7: an added dependency's "release < 6 months"
 * cannot be verified offline, and the product only needs simple
 * recurrences: yearly vaccines, every-N parasite/flea-tick, daily/N-per-day
 * meds — see T054/T060/T061). Full RFC5545 range-expansion is deliberately
 * out of scope here (T055/T056 own agenda generation); this module only
 * validates a candidate string and extracts a single structured
 * `ParsedRRule`.
 *
 * `parseRRule` mirrors the `parseTriage`/`parseIntake` result-object style
 * (./triage.ts, ./intake.ts): it NEVER throws and NEVER mutates its input.
 *
 * Deliberately uses NO `Intl`/timezone APIs (Hermes-safe for mobile T060's
 * schedule builder). The IANA-timezone/DST math that turns a `ParsedRRule`
 * into an actual next-fire instant lives api-side in
 * `apps/api/src/reminders/next-fire-at.ts` (plan decision 2).
 */

export const RRULE_FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;
export type RRuleFrequency = (typeof RRULE_FREQUENCIES)[number];

export const RRULE_WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type RRuleWeekday = (typeof RRULE_WEEKDAYS)[number];

export interface ParsedRRule {
  freq: RRuleFrequency;
  /** Defaults to 1 when `INTERVAL` is absent from the input. */
  interval: number;
  byDay?: RRuleWeekday[];
  byMonthDay?: number[];
  count?: number;
  /** Parsed from the RFC5545 UTC form (`YYYYMMDDTHHMMSSZ`) via manual digit extraction — no `Date` string parsing, no `Intl`. */
  until?: Date;
}

export type ParseRRuleResult = { ok: true; value: ParsedRRule } | { ok: false; reason: string };

const SUPPORTED_KEYS = new Set(["FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "COUNT", "UNTIL"]);
const RRULE_PREFIX = "RRULE:";
const UNTIL_PATTERN = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/;

/** A bare positive-integer string (no sign, no leading/trailing whitespace, no decimals). */
function parsePositiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

/** Manual digit extraction — never relies on `Date`/`Intl` string parsing. */
function parseUntilTimestamp(value: string): Date | null {
  const match = UNTIL_PATTERN.exec(value);
  if (!match) return null;

  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const second = Number(secondStr);

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

/**
 * Validates and parses an RFC5545 `RRULE`-style value. See the plan's
 * "RRULE-subset validation semantics" for the full grammar + rejection
 * table. Never throws.
 */
export function parseRRule(input: string): ParseRRuleResult {
  if (typeof input !== "string" || input.trim().length === 0) {
    return { ok: false, reason: "rrule must be a non-empty string" };
  }

  const body = input.startsWith(RRULE_PREFIX) ? input.slice(RRULE_PREFIX.length) : input;
  if (body.trim().length === 0) {
    return { ok: false, reason: "rrule must be a non-empty string" };
  }

  const fields: Record<string, string> = {};
  for (const part of body.split(";")) {
    const eqIndex = part.indexOf("=");
    if (eqIndex <= 0) {
      return { ok: false, reason: `malformed component: "${part}"` };
    }

    const key = part.slice(0, eqIndex).trim();
    const value = part.slice(eqIndex + 1).trim();

    if (!SUPPORTED_KEYS.has(key)) {
      return { ok: false, reason: `unsupported key: "${key}"` };
    }
    if (key in fields) {
      return { ok: false, reason: `duplicate key: "${key}"` };
    }
    fields[key] = value;
  }

  const freqValue = fields.FREQ;
  if (freqValue === undefined) {
    return { ok: false, reason: "FREQ is required" };
  }
  if (!(RRULE_FREQUENCIES as readonly string[]).includes(freqValue)) {
    return { ok: false, reason: `unknown FREQ value: "${freqValue}"` };
  }
  const freq = freqValue as RRuleFrequency;

  let interval = 1;
  const intervalValue = fields.INTERVAL;
  if (intervalValue !== undefined) {
    const parsedInterval = parsePositiveInteger(intervalValue);
    if (parsedInterval === null) {
      return { ok: false, reason: `INTERVAL must be a positive integer: "${intervalValue}"` };
    }
    interval = parsedInterval;
  }

  let byDay: RRuleWeekday[] | undefined;
  const byDayValue = fields.BYDAY;
  if (byDayValue !== undefined) {
    const tokens = byDayValue.split(",").map((token) => token.trim());
    if (tokens.length === 0 || tokens.some((token) => token.length === 0)) {
      return { ok: false, reason: `BYDAY malformed: "${byDayValue}"` };
    }
    for (const token of tokens) {
      if (!(RRULE_WEEKDAYS as readonly string[]).includes(token)) {
        return { ok: false, reason: `BYDAY token is not a valid weekday: "${token}"` };
      }
    }
    byDay = tokens as RRuleWeekday[];
  }

  let byMonthDay: number[] | undefined;
  const byMonthDayValue = fields.BYMONTHDAY;
  if (byMonthDayValue !== undefined) {
    const tokens = byMonthDayValue.split(",").map((token) => token.trim());
    const days: number[] = [];
    for (const token of tokens) {
      const parsedDay = parsePositiveInteger(token);
      if (parsedDay === null || parsedDay > 31) {
        return { ok: false, reason: `BYMONTHDAY out of range 1..31: "${token}"` };
      }
      days.push(parsedDay);
    }
    byMonthDay = days;
  }

  let count: number | undefined;
  const countValue = fields.COUNT;
  if (countValue !== undefined) {
    const parsedCount = parsePositiveInteger(countValue);
    if (parsedCount === null) {
      return { ok: false, reason: `COUNT must be a positive integer: "${countValue}"` };
    }
    count = parsedCount;
  }

  let until: Date | undefined;
  const untilValue = fields.UNTIL;
  if (untilValue !== undefined) {
    const parsedUntil = parseUntilTimestamp(untilValue);
    if (parsedUntil === null) {
      return { ok: false, reason: `UNTIL is not a valid RFC5545 UTC timestamp: "${untilValue}"` };
    }
    until = parsedUntil;
  }

  if (count !== undefined && until !== undefined) {
    return { ok: false, reason: "COUNT and UNTIL cannot both be present" };
  }

  const value: ParsedRRule = {
    freq,
    interval,
    ...(byDay !== undefined ? { byDay } : {}),
    ...(byMonthDay !== undefined ? { byMonthDay } : {}),
    ...(count !== undefined ? { count } : {}),
    ...(until !== undefined ? { until } : {}),
  };

  return { ok: true, value };
}

/** `true` iff `parseRRule(input).ok`. The `@IsRRule()` DTO decorator (apps/api) delegates to this. */
export function isValidRRule(input: string): boolean {
  return parseRRule(input).ok;
}

export const rruleSchema = z.string().refine(isValidRRule, {
  message: "rrule must be a valid recurrence rule",
});
