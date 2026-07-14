import type { ParsedRRule } from "@pawcareright/types";
import { parseRRule } from "@pawcareright/types";

import { computeNextFireAt } from "./next-fire-at";

/** Test-local convenience: the plan's valid-input matrix is already proven by rrule.spec.ts. */
function rule(input: string): ParsedRRule {
  const parsed = parseRRule(input);
  if (!parsed.ok) throw new Error(`test fixture rrule is invalid: ${input} (${parsed.reason})`);
  return parsed.value;
}

describe("computeNextFireAt", () => {
  it("DAILY: returns the next day at the same wall-clock time once `after` moves past the anchor", () => {
    const startAt = new Date("2026-01-10T09:00:00.000Z");
    const after = new Date("2026-01-10T09:00:00.001Z");

    expect(computeNextFireAt(rule("FREQ=DAILY"), startAt, after, "UTC")).toEqual(
      new Date("2026-01-11T09:00:00.000Z"),
    );
  });

  it("DAILY: returns the anchor instant itself when `after` equals `startAt` (the create-time call)", () => {
    const startAt = new Date("2026-01-10T09:00:00.000Z");

    expect(computeNextFireAt(rule("FREQ=DAILY"), startAt, startAt, "UTC")).toEqual(startAt);
  });

  it("WEEKLY;BYDAY=MO: from a Wednesday anchor, returns the following Monday", () => {
    // 2026-01-07 is a Wednesday.
    const startAt = new Date("2026-01-07T09:00:00.000Z");

    expect(computeNextFireAt(rule("FREQ=WEEKLY;BYDAY=MO"), startAt, startAt, "UTC")).toEqual(
      new Date("2026-01-12T09:00:00.000Z"), // the next Monday
    );
  });

  it("MONTHLY;BYMONTHDAY=15: from the 1st, returns the 15th of the same month", () => {
    const startAt = new Date("2026-02-01T09:00:00.000Z");

    expect(computeNextFireAt(rule("FREQ=MONTHLY;BYMONTHDAY=15"), startAt, startAt, "UTC")).toEqual(
      new Date("2026-02-15T09:00:00.000Z"),
    );
  });

  it("YEARLY: returns the same month/day one year later", () => {
    const startAt = new Date("2026-03-01T09:00:00.000Z");
    const after = new Date("2026-03-01T09:00:00.001Z");

    expect(computeNextFireAt(rule("FREQ=YEARLY"), startAt, after, "UTC")).toEqual(
      new Date("2027-03-01T09:00:00.000Z"),
    );
  });

  it("INTERVAL=2 spacing: skips the off-cycle day", () => {
    const startAt = new Date("2026-01-10T09:00:00.000Z");
    const after = new Date("2026-01-11T09:00:00.000Z"); // one day after the anchor — not a multiple of 2

    expect(computeNextFireAt(rule("FREQ=DAILY;INTERVAL=2"), startAt, after, "UTC")).toEqual(
      new Date("2026-01-12T09:00:00.000Z"),
    );
  });

  it("MONTHLY;BYMONTHDAY=31 skips a 31-less month (does not roll into it)", () => {
    const startAt = new Date("2026-01-31T09:00:00.000Z");
    const after = new Date("2026-02-01T00:00:00.000Z"); // past the anchor's own Jan-31 occurrence

    expect(computeNextFireAt(rule("FREQ=MONTHLY;BYMONTHDAY=31"), startAt, after, "UTC")).toEqual(
      new Date("2026-03-31T09:00:00.000Z"), // February has no 31st — skipped entirely
    );
  });

  it("COUNT exhaustion returns null once the series is spent", () => {
    const startAt = new Date("2026-01-10T09:00:00.000Z");
    const after = new Date("2026-01-11T09:00:00.000Z"); // past the only (COUNT=1) occurrence

    expect(computeNextFireAt(rule("FREQ=DAILY;COUNT=1"), startAt, after, "UTC")).toBeNull();
  });

  it("UNTIL exhaustion returns null once the series is spent", () => {
    const startAt = new Date("2026-01-10T09:00:00.000Z");
    const after = new Date("2026-01-11T09:00:00.000Z"); // past UNTIL, which equals the anchor instant

    expect(computeNextFireAt(rule("FREQ=DAILY;UNTIL=20260110T090000Z"), startAt, after, "UTC")).toBeNull();
  });

  it("DST-adjacent: a DAILY 09:00 America/New_York reminder keeps 09:00 local time across spring-forward, shifting its UTC offset by one hour", () => {
    // 2026-03-08 is the US spring-forward date (clocks jump 02:00 -> 03:00 local).
    // 2026-03-05 (Thursday, EST/UTC-5) is before it; 2026-03-09 (Monday, EDT/UTC-4) is after it.
    const startAt = new Date("2026-03-05T14:00:00.000Z"); // 09:00 EST

    const beforeDst = computeNextFireAt(rule("FREQ=DAILY"), startAt, startAt, "America/New_York");
    expect(beforeDst).toEqual(new Date("2026-03-05T14:00:00.000Z")); // still UTC-5

    const afterMar8Fire = new Date("2026-03-08T13:00:00.001Z"); // just past the Mar-8 09:00 EDT occurrence
    const afterDst = computeNextFireAt(rule("FREQ=DAILY"), startAt, afterMar8Fire, "America/New_York");
    expect(afterDst).toEqual(new Date("2026-03-09T13:00:00.000Z")); // now UTC-4 — same 09:00 local wall-clock

    // The UTC offset shifted by exactly one hour across the boundary while local time-of-day stayed 09:00.
    expect(beforeDst?.getUTCHours()).toBe(14);
    expect(afterDst?.getUTCHours()).toBe(13);
  });

  it("is total: an absurdly small BYMONTHDAY/BYDAY combination that never matches within the scan bound returns null, not a throw", () => {
    // MONTHLY with BYMONTHDAY=29 anchored on a non-leap Feb 1 combined with an
    // early `after` far beyond the anchor still resolves — this just proves
    // the function never throws, whatever the inputs.
    const startAt = new Date("2026-02-01T09:00:00.000Z");
    const after = new Date("2200-01-01T00:00:00.000Z");

    expect(() => computeNextFireAt(rule("FREQ=MONTHLY;BYMONTHDAY=29"), startAt, after, "UTC")).not.toThrow();
  });
});
