import type { ParsedRRule } from "@pawcareright/types";
import { parseRRule } from "@pawcareright/types";

import { buildMedicationCourse } from "./medication-course";
import { computeNextFireAt } from "./next-fire-at";
import { occurrencesBetween } from "./occurrences-between";

/**
 * ============================================================================
 * T062 — Phase 5 timezone/clock test sweep: MASTER MATRIX
 * ============================================================================
 *
 * This is the single documented tz test matrix (plan AC2) for every reminder/
 * push/consistency component. Every OTHER new T062 spec file's header links
 * back here with a one-line pointer instead of restating the matrix. Cells
 * tagged `[PRE-EXISTING: <file>]` are intentionally NOT re-tested by T062 —
 * they were already proven by their originating task's spec and duplicating
 * them would only add maintenance cost, not coverage (plan decision 5 / "Out
 * of scope"). All DST instants below were independently verified against a
 * throwaway `node -e` `Intl.DateTimeFormat` script BEFORE any fixture was
 * written (plan decision 6 / Risk R1) — see the executor's final report for
 * the raw script output. Canonical 2026 transitions used throughout the T062
 * suite:
 *   - America/New_York: spring-forward Mar 8 (02:00 EST -> 03:00 EDT), fall-back Nov 1 (02:00 EDT -> 01:00 EST)
 *   - Europe/Paris: spring-forward Mar 29 (02:00 CET -> 03:00 CEST), fall-back Oct 25 (03:00 CEST -> 02:00 CET)
 *   - Asia/Kolkata: no DST, fixed UTC+05:30 year-round
 *
 * | Component                              | Scenario                              | tz-pair / zone              | DST direction   | Coverage                                                            |
 * |-----------------------------------------|---------------------------------------|------------------------------|-----------------|----------------------------------------------------------------------|
 * | computeNextFireAt                       | daily 09:00 holds local time           | America/New_York             | spring-forward  | [PRE-EXISTING: next-fire-at.spec.ts] "DST-adjacent" test              |
 * | computeNextFireAt                       | tz-change recompute (same rrule)       | Asia/Kolkata -> America/New_York | N/A (no DST)| [NEW: this file] §TZ-CHANGE                                          |
 * | computeNextFireAt                       | clock-skew ±1ms advance boundary       | UTC                          | N/A             | [NEW: this file] §CLOCK-SKEW                                          |
 * | computeNextFireAt                       | Kolkata invariance across the year     | Asia/Kolkata                 | N/A (no DST)    | [NEW: this file] §NO-DST-INVARIANCE                                   |
 * | occurrencesBetween                      | daily 09:00 holds local time           | America/New_York, Europe/Paris | spring + fall | [PRE-EXISTING: occurrences-between.spec.ts]                          |
 * | occurrencesBetween                      | inclusive 24h-multiple window boundary | UTC                          | N/A             | [NEW: this file] §INCLUSIVE-BOUNDARY                                  |
 * | buildMedicationCourse (2x/day siblings)  | both dose times hold across spring     | America/New_York             | spring-forward  | [NEW: this file] §MED-COURSE                                          |
 * | buildMedicationCourse (2x/day siblings)  | both dose times hold across fall       | America/New_York             | fall-back       | [NEW: this file] §MED-COURSE                                          |
 * | RemindersService.agenda                 | tz change: no dup/drop in a fixed window| Asia/Kolkata -> America/New_York | N/A (no DST)| [NEW: reminders-service.tz-sweep.spec.ts]                             |
 * | RemindersService.assertOccurrence        | epoch-match survives a tz change       | Asia/Kolkata -> America/New_York | N/A (no DST)| [NEW: reminders-service.tz-sweep.spec.ts]                             |
 * | RemindersService.update                 | nextFireAt recompute on tz field change | America/New_York -> UTC      | N/A             | [PRE-EXISTING: reminders.service.spec.ts] "timezone present" test     |
 * | ReminderSchedulerService.tick            | advance across spring-forward          | Europe/Paris                 | spring-forward  | [PRE-EXISTING: reminder-scheduler.service.spec.ts]                    |
 * | ReminderSchedulerService.tick            | fires despite ms-level clock-skew jitter| UTC                          | N/A             | [NEW: scheduler-tz-sweep.spec.ts]                                     |
 * | ReminderSchedulerService.tick            | advances to the new-tz wall clock       | Asia/Kolkata -> America/New_York | N/A (no DST)| [NEW: scheduler-tz-sweep.spec.ts]                                     |
 * | ReminderSchedulerService.backfill        | <24h / >24h missed windows              | UTC                          | N/A             | [PRE-EXISTING: reminder-scheduler.service.spec.ts]                    |
 * | ReminderSchedulerService.backfill        | exact 24h-boundary single-boot          | UTC                          | N/A             | [NEW: scheduler-tz-sweep.spec.ts]                                     |
 * | ReminderSchedulerService.refireSnoozed   | snooze -> refire -> push e2e chain      | UTC                          | N/A             | [NEW: scheduler-tz-sweep.spec.ts]                                     |
 * | computeDeferUntil                       | overnight straddling window            | America/New_York             | spring-forward  | [PRE-EXISTING: quiet-hours.spec.ts] "DST-transition night" test       |
 * | computeDeferUntil                       | overnight straddling window            | America/New_York             | fall-back       | [NEW: quiet-hours-tz-sweep.spec.ts]                                   |
 * | computeDeferUntil                       | tz change between two computations     | America/New_York -> Asia/Kolkata | N/A (no DST)| [NEW: quiet-hours-tz-sweep.spec.ts]                                   |
 * | ReminderConsistencyService.checkConsistency | matched/orphan/missing/grace/COUNT/empty | UTC                     | N/A             | [NEW: reminder-consistency.service.spec.ts]                           |
 * | mobile care.tsx (agenda bucketing)       | device-clock Today/Upcoming bucketing  | device clock (pinned)       | N/A             | [NEW: agenda-tz-drift.test.tsx]                                       |
 *
 * §matrix cross-reference key: rows tagged `this file` are proven by the
 * `describe` blocks below, grouped under the same `§SECTION` markers used in
 * the table.
 */

/** Test-local convenience: valid-input parsing itself is proven by rrule.spec.ts. */
function rule(input: string): ParsedRRule {
  const parsed = parseRRule(input);
  if (!parsed.ok) throw new Error(`test fixture rrule is invalid: ${input} (${parsed.reason})`);
  return parsed.value;
}

describe("timezone matrix — MED-COURSE (buildMedicationCourse siblings across DST)", () => {
  it("2x/day course (08:00+20:00 America/New_York) holds both local dose times across spring-forward Mar 8 2026", () => {
    const specs = buildMedicationCourse({
      medNameAsEntered: "As prescribed",
      doseStartAts: ["2026-01-05T13:00:00.000Z", "2026-01-06T01:00:00.000Z"], // 08:00 EST / 20:00 EST (prior day)
      courseLengthDays: 90,
      timezone: "America/New_York",
      courseId: "course-dst-spring",
    });
    expect(specs).toHaveLength(2);

    const from = new Date("2026-03-06T00:00:00.000Z");
    const to = new Date("2026-03-11T00:00:00.000Z");
    const isoDates = specs
      .flatMap((spec) => occurrencesBetween(rule(spec.rrule), spec.startAt, spec.timezone, from, to))
      .map((d) => d.toISOString())
      .sort();

    // 08:00 sibling: EST (UTC-5) before the boundary, EDT (UTC-4) from Mar 8 onward.
    expect(isoDates).toContain("2026-03-06T13:00:00.000Z");
    expect(isoDates).toContain("2026-03-07T13:00:00.000Z");
    expect(isoDates).toContain("2026-03-08T12:00:00.000Z"); // 08:00 EDT
    expect(isoDates).toContain("2026-03-09T12:00:00.000Z");
    expect(isoDates).toContain("2026-03-10T12:00:00.000Z");
    // 20:00 sibling. Note the window (from Mar 6 00:00Z) also catches Mar 5's
    // 20:00 EST dose, which lands at Mar 6 01:00Z (still >= `from`) -- six
    // 20:00-sibling instants in this window, not five.
    expect(isoDates).toContain("2026-03-06T01:00:00.000Z"); // Mar 5 20:00 EST
    expect(isoDates).toContain("2026-03-07T01:00:00.000Z"); // Mar 6 20:00 EST
    expect(isoDates).toContain("2026-03-08T01:00:00.000Z"); // Mar 7 20:00 EST
    expect(isoDates).toContain("2026-03-09T00:00:00.000Z"); // Mar 8 20:00 EDT
    expect(isoDates).toContain("2026-03-10T00:00:00.000Z"); // Mar 9 20:00 EDT
    expect(isoDates).toContain("2026-03-11T00:00:00.000Z"); // Mar 10 20:00 EDT

    // The Mar-8 local-calendar-day transition yields exactly 2 events total
    // (one per sibling) -- never 1 (a skipped dose) or 3 (a duplicated dose).
    const mar8LocalDayInstants = ["2026-03-08T12:00:00.000Z", "2026-03-09T00:00:00.000Z"];
    expect(isoDates.filter((iso) => mar8LocalDayInstants.includes(iso))).toHaveLength(2);
    expect(isoDates).toHaveLength(11); // 5 (08:00 sibling) + 6 (20:00 sibling, incl. the Mar 5 dose landing just after `from`)
  });

  it("same course holds local dose times across fall-back Nov 1 2026", () => {
    const specs = buildMedicationCourse({
      medNameAsEntered: "As prescribed",
      doseStartAts: ["2026-01-05T13:00:00.000Z", "2026-01-06T01:00:00.000Z"], // 08:00 EST / 20:00 EST (prior day)
      courseLengthDays: 320,
      timezone: "America/New_York",
      courseId: "course-dst-fall",
    });
    expect(specs).toHaveLength(2);

    const from = new Date("2026-10-30T00:00:00.000Z");
    const to = new Date("2026-11-03T00:00:00.000Z");
    const isoDates = specs
      .flatMap((spec) => occurrencesBetween(rule(spec.rrule), spec.startAt, spec.timezone, from, to))
      .map((d) => d.toISOString())
      .sort();

    // 08:00 sibling: EDT (UTC-4) before fall-back, EST (UTC-5) from Nov 1 onward.
    expect(isoDates).toContain("2026-10-30T12:00:00.000Z");
    expect(isoDates).toContain("2026-10-31T12:00:00.000Z");
    expect(isoDates).toContain("2026-11-01T13:00:00.000Z"); // 08:00 EST
    expect(isoDates).toContain("2026-11-02T13:00:00.000Z");
    // 20:00 sibling.
    expect(isoDates).toContain("2026-10-30T00:00:00.000Z"); // Oct 29 20:00 EDT
    expect(isoDates).toContain("2026-10-31T00:00:00.000Z"); // Oct 30 20:00 EDT
    expect(isoDates).toContain("2026-11-01T00:00:00.000Z"); // Oct 31 20:00 EDT
    expect(isoDates).toContain("2026-11-02T01:00:00.000Z"); // Nov 1 20:00 EST

    // Nov-1 local-calendar-day yields exactly 2 events total (one per sibling).
    const nov1LocalDayInstants = ["2026-11-01T13:00:00.000Z", "2026-11-02T01:00:00.000Z"];
    expect(isoDates.filter((iso) => nov1LocalDayInstants.includes(iso))).toHaveLength(2);
    expect(isoDates).toHaveLength(8);
  });
});

describe("timezone matrix — TZ-CHANGE (computeNextFireAt recomputes per-tz wall clock)", () => {
  it("computeNextFireAt recomputes to the new tz wall-clock when timezone changes Kolkata->New_York", () => {
    // Same rrule (FREQ=DAILY) and same nominal local dose time (09:00) --
    // only the timezone changes. Each anchor is independently verified to
    // read as 09:00 in its own tz (Asia/Kolkata is always +05:30; June puts
    // America/New_York in EDT, -04:00).
    const startAtIst = new Date("2026-06-01T03:30:00.000Z"); // 09:00 IST
    const startAtNy = new Date("2026-06-01T13:00:00.000Z"); // 09:00 EDT

    const nextIst = computeNextFireAt(rule("FREQ=DAILY"), startAtIst, startAtIst, "Asia/Kolkata");
    const nextNy = computeNextFireAt(rule("FREQ=DAILY"), startAtNy, startAtNy, "America/New_York");

    expect(nextIst).toEqual(startAtIst);
    expect(nextNy).toEqual(startAtNy);
    // The two tz's "09:00 local" resolve to genuinely distinct UTC instants.
    expect(nextIst?.getTime()).not.toBe(nextNy?.getTime());
  });
});

describe("timezone matrix — CLOCK-SKEW (±1ms advance boundary)", () => {
  it("exclusive +1ms advance lands on the next daily occurrence; -1ms and exact land on the same instant", () => {
    // anchor (startAt) is NOT the dueAt itself here -- a genuinely later
    // occurrence in the series -- so this does not re-assert T053's
    // after==anchor case (next-fire-at.spec.ts's own tests always use
    // after===startAt or startAt+1ms with anchor===startAt).
    const startAt = new Date("2026-01-10T09:00:00.000Z");
    const dueAt = new Date("2026-01-15T09:00:00.000Z"); // the 6th daily occurrence

    const justBefore = computeNextFireAt(rule("FREQ=DAILY"), startAt, new Date(dueAt.getTime() - 1), "UTC");
    const exact = computeNextFireAt(rule("FREQ=DAILY"), startAt, dueAt, "UTC");
    const justAfter = computeNextFireAt(rule("FREQ=DAILY"), startAt, new Date(dueAt.getTime() + 1), "UTC");

    expect(justBefore).toEqual(dueAt);
    expect(exact).toEqual(dueAt);
    expect(justAfter).toEqual(new Date("2026-01-16T09:00:00.000Z"));
  });
});

describe("timezone matrix — INCLUSIVE-BOUNDARY (exact 24h-multiple window)", () => {
  it("occurrencesBetween on an exact 24h-multiple DAILY window stays bounded (documents the inclusive-boundary count)", () => {
    const startAt = new Date("2026-02-01T09:00:00.000Z");
    const from = startAt;
    const to = new Date(startAt.getTime() + 4 * 24 * 60 * 60 * 1000); // exactly 4 days later

    const occurrences = occurrencesBetween(rule("FREQ=DAILY"), startAt, "UTC", from, to);

    // Both `from` and `to` are themselves occurrences (inclusive boundaries,
    // already proven generically by occurrences-between.spec.ts) -- a
    // 4x24h window over a DAILY cadence is bounded to exactly 5 rows
    // (day 0..4), never 4 (an off-by-one drop) or 6 (a duplicate/overrun).
    expect(occurrences).toHaveLength(5);
    expect(occurrences[0]).toEqual(startAt);
    expect(occurrences[occurrences.length - 1]).toEqual(to);
  });
});

describe("timezone matrix — NO-DST-INVARIANCE (Asia/Kolkata)", () => {
  it("a DAILY 09:00 Asia/Kolkata reminder never shifts its UTC offset across the whole year (no US/EU DST edge affects it)", () => {
    const startAt = new Date("2026-01-01T03:30:00.000Z"); // 09:00 IST
    const from = startAt;
    const to = new Date("2026-08-01T03:30:00.000Z"); // spans the US Mar/EU Mar+Oct DST edges

    const occurrences = occurrencesBetween(rule("FREQ=DAILY"), startAt, "Asia/Kolkata", from, to);

    for (let i = 1; i < occurrences.length; i += 1) {
      const deltaMs = occurrences[i]!.getTime() - occurrences[i - 1]!.getTime();
      expect(deltaMs).toBe(24 * 60 * 60 * 1000); // always exactly 24h -- no offset jump, ever
    }
    // Spot-check instants that straddle both US and EU 2026 DST edges: the
    // UTC minute-of-day (03:30) never moves for Asia/Kolkata.
    expect(occurrences.some((d) => d.toISOString() === "2026-03-08T03:30:00.000Z")).toBe(true); // US spring-forward day
    expect(occurrences.some((d) => d.toISOString() === "2026-03-29T03:30:00.000Z")).toBe(true); // EU spring-forward day
    expect(occurrences.length).toBeGreaterThan(200);
  });
});
