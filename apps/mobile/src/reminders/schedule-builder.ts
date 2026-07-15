import { parseRRule, type RRuleWeekday } from "@pawcareright/types";

/**
 * T060 plan decision 7: an in-house pure schedule-builder (no new
 * dependency) that maps a small UI-facing config to the EXACT T053 rrule
 * grammar (`FREQ=…[;INTERVAL=N][;BYDAY=…][;BYMONTHDAY=N]`). Kept as a pure
 * module with no RN imports so the AC2 test runs without rendering
 * anything. "Every-N" is `INTERVAL=N` over the chosen `FREQ` -- dropping
 * `INTERVAL` for an every-N case would silently collapse it to every-1,
 * which is why every non-1 interval MUST emit the `INTERVAL=N` component.
 *
 * `startAt`/time-of-day is the reminder's DTSTART anchor (a separate field
 * on the create/edit form) -- deliberately NOT part of this config/output.
 */

export type ScheduleFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

export interface ScheduleConfig {
  freq: ScheduleFrequency;
  /** Defaults to 1 when omitted (mirrors `parseRRule`'s INTERVAL default). */
  interval?: number;
  /** WEEKLY only: one or more weekdays. */
  byDay?: RRuleWeekday[];
  /** MONTHLY only: day-of-month (1-31). */
  byMonthDay?: number;
}

/**
 * Builds an RFC5545-subset `RRULE` string from a `ScheduleConfig`. Pure,
 * total, never throws -- invalid combinations (e.g. `byDay` on a MONTHLY
 * config) are simply ignored, matching the schedule builder UI's own
 * freq-scoped fields (only the fields relevant to the selected `freq` are
 * ever populated by the caller).
 */
export function buildRRule(config: ScheduleConfig): string {
  const parts = [`FREQ=${config.freq}`];

  const interval = config.interval ?? 1;
  if (interval !== 1) {
    parts.push(`INTERVAL=${interval}`);
  }

  if (config.freq === "WEEKLY" && config.byDay !== undefined && config.byDay.length > 0) {
    parts.push(`BYDAY=${config.byDay.join(",")}`);
  }

  if (config.freq === "MONTHLY" && config.byMonthDay !== undefined) {
    parts.push(`BYMONTHDAY=${config.byMonthDay}`);
  }

  return parts.join(";");
}

const EDITABLE_FREQUENCIES = new Set<string>(["DAILY", "WEEKLY", "MONTHLY"]);

/**
 * Inverse of `buildRRule` (edit-mode form seeding): parses an existing
 * rrule string back into a `ScheduleConfig`. An rrule outside this
 * builder's DAILY/WEEKLY/MONTHLY scope (e.g. a care-template `YEARLY`
 * reminder, or a malformed/unparseable string) degrades to a safe
 * `{ freq: "DAILY", interval: 1 }` default rather than throwing --
 * re-editing such a reminder's schedule via this form is out of scope
 * (plan: daily/weekly/monthly/every-N only); its title/type still edit
 * normally. A multi-value `BYMONTHDAY` (not producible by this builder,
 * but possible on a hand-authored/legacy rrule) takes only its first day.
 */
export function parseRRuleToScheduleConfig(rrule: string): ScheduleConfig {
  const parsed = parseRRule(rrule);
  if (!parsed.ok || !EDITABLE_FREQUENCIES.has(parsed.value.freq)) {
    return { freq: "DAILY", interval: 1 };
  }

  const { freq, interval, byDay, byMonthDay } = parsed.value;
  return {
    freq: freq as ScheduleFrequency,
    interval,
    ...(byDay !== undefined ? { byDay } : {}),
    ...(byMonthDay !== undefined && byMonthDay[0] !== undefined ? { byMonthDay: byMonthDay[0] } : {}),
  };
}
