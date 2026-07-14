import { computeDeferUntil, type QuietHoursPrefs } from "./quiet-hours";

/**
 * `computeDeferUntil` defer matrix (T058 plan AC1). `now` instants below
 * are given as UTC ISO strings computed to land on the documented local
 * wall-clock time in the given `timezone` (verified independently via
 * `Intl.DateTimeFormat`, not by re-deriving them from the function under
 * test).
 */
describe("computeDeferUntil", () => {
  const straddling: QuietHoursPrefs = {
    quietStart: "22:00",
    quietEnd: "07:00",
    timezone: "America/New_York",
  };

  const nonStraddling: QuietHoursPrefs = {
    quietStart: "13:00",
    quietEnd: "15:00",
    timezone: "America/New_York",
  };

  it("straddling 22:00-07:00 at 23:00 defers to 07:00 next day", () => {
    // 2026-06-14 23:00 EDT (offset -04:00, no DST edge nearby)
    const now = new Date("2026-06-15T03:00:00.000Z");
    const result = computeDeferUntil(straddling, now);
    // 2026-06-15 07:00 EDT
    expect(result).toEqual(new Date("2026-06-15T11:00:00.000Z"));
  });

  it("straddling 22:00-07:00 at 03:00 defers to 07:00 same day", () => {
    // 2026-06-15 03:00 EDT
    const now = new Date("2026-06-15T07:00:00.000Z");
    const result = computeDeferUntil(straddling, now);
    // 2026-06-15 07:00 EDT (same calendar day)
    expect(result).toEqual(new Date("2026-06-15T11:00:00.000Z"));
  });

  it("straddling 22:00-07:00 at 12:00 returns null (outside window)", () => {
    // 2026-06-15 12:00 EDT
    const now = new Date("2026-06-15T16:00:00.000Z");
    expect(computeDeferUntil(straddling, now)).toBeNull();
  });

  it("non-straddling 13:00-15:00 at 14:00 defers to 15:00 today", () => {
    // 2026-06-15 14:00 EDT
    const now = new Date("2026-06-15T18:00:00.000Z");
    const result = computeDeferUntil(nonStraddling, now);
    // 2026-06-15 15:00 EDT
    expect(result).toEqual(new Date("2026-06-15T19:00:00.000Z"));
  });

  it("non-straddling 13:00-15:00 at 12:00 returns null", () => {
    // 2026-06-15 12:00 EDT
    const now = new Date("2026-06-15T16:00:00.000Z");
    expect(computeDeferUntil(nonStraddling, now)).toBeNull();
  });

  it("non-straddling 13:00-15:00 at 16:00 returns null", () => {
    // 2026-06-15 16:00 EDT
    const now = new Date("2026-06-15T20:00:00.000Z");
    expect(computeDeferUntil(nonStraddling, now)).toBeNull();
  });

  it("window-end exact boundary returns null (deliver) -- straddling", () => {
    // 2026-06-15 07:00 EDT == quietEnd exactly
    const now = new Date("2026-06-15T11:00:00.000Z");
    expect(computeDeferUntil(straddling, now)).toBeNull();
  });

  it("window-end exact boundary returns null (deliver) -- non-straddling", () => {
    // 2026-06-15 15:00 EDT == quietEnd exactly
    const now = new Date("2026-06-15T19:00:00.000Z");
    expect(computeDeferUntil(nonStraddling, now)).toBeNull();
  });

  it("window-start exact boundary defers -- straddling", () => {
    // 2026-06-15 22:00 EDT == quietStart exactly
    const now = new Date("2026-06-16T02:00:00.000Z");
    const result = computeDeferUntil(straddling, now);
    // 2026-06-16 07:00 EDT
    expect(result).toEqual(new Date("2026-06-16T11:00:00.000Z"));
  });

  it("window-start exact boundary defers -- non-straddling", () => {
    // 2026-06-15 13:00 EDT == quietStart exactly
    const now = new Date("2026-06-15T17:00:00.000Z");
    const result = computeDeferUntil(nonStraddling, now);
    expect(result).toEqual(new Date("2026-06-15T19:00:00.000Z"));
  });

  it("no quiet window (all null) returns null", () => {
    const now = new Date("2026-06-15T23:00:00.000Z");
    expect(computeDeferUntil({ quietStart: null, quietEnd: null, timezone: null }, now)).toBeNull();
  });

  it("quietStart === quietEnd is treated as no quiet window", () => {
    const now = new Date("2026-06-15T23:00:00.000Z");
    expect(
      computeDeferUntil({ quietStart: "09:00", quietEnd: "09:00", timezone: "America/New_York" }, now),
    ).toBeNull();
  });

  it("DST-transition night defers to the correct post-transition UTC instant", () => {
    // US spring-forward 2026: America/New_York jumps from 02:00 EST to
    // 03:00 EDT on 2026-03-08. `now` = 2026-03-07 23:00 EST (offset -05:00,
    // pre-transition); the deferred 07:00 target falls the morning AFTER
    // the transition (offset -04:00). A naive single-offset conversion
    // would apply the WRONG (-05:00) offset to the target and land an hour
    // off; the two-pass fixed point must get this right.
    const now = new Date("2026-03-08T04:00:00.000Z"); // 2026-03-07T23:00 EST
    const result = computeDeferUntil(straddling, now);
    expect(result).toEqual(new Date("2026-03-08T11:00:00.000Z")); // 2026-03-08T07:00 EDT
  });
});
