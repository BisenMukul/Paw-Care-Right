import { computeDeferUntil, type QuietHoursPrefs } from "./quiet-hours";

/**
 * `computeDeferUntil` tz-change / fall-back sweep (T062 plan carry-forward
 * #3). See `../reminders/timezone-matrix.spec.ts` §matrix
 * ("computeDeferUntil" rows) for this file's place in the master tz test
 * matrix. `quiet-hours.spec.ts` already proves the spring-forward
 * straddling-window case ("DST-transition night defers to the correct
 * post-transition UTC instant") -- this file adds the FALL-BACK straddling
 * case and a pure tz-change (no DST) case, without duplicating that
 * existing test. All instants below were independently verified via a
 * throwaway `node -e` `Intl.DateTimeFormat` script (plan decision 6 / Risk
 * R1) -- see the executor's final report for the raw script output.
 */
describe("computeDeferUntil tz-change / fall-back sweep", () => {
  it("window-end follows the user's NEW timezone when tz changes between two computations (America/New_York -> Europe/Paris)", () => {
    const prefs: Omit<QuietHoursPrefs, "timezone"> = { quietStart: "22:00", quietEnd: "07:00" };
    // A single instant that lands inside the straddling 22:00-07:00 window
    // for BOTH zones: 2026-06-14 22:00 EDT (America/New_York) == 2026-06-15
    // 04:00 CEST (Europe/Paris).
    const now = new Date("2026-06-15T02:00:00.000Z");

    const resultNy = computeDeferUntil({ ...prefs, timezone: "America/New_York" }, now);
    const resultParis = computeDeferUntil({ ...prefs, timezone: "Europe/Paris" }, now);

    expect(resultNy).toEqual(new Date("2026-06-15T11:00:00.000Z")); // 2026-06-15 07:00 EDT
    expect(resultParis).toEqual(new Date("2026-06-15T05:00:00.000Z")); // 2026-06-15 07:00 CEST

    // Genuinely distinct window-end instants -- the SAME `now` and the SAME
    // quietStart/quietEnd strings recompute to different UTC targets purely
    // because the timezone changed, by exactly the two zones' offset delta
    // (CEST +02:00 vs EDT -04:00 = 6h) at this same-day instant.
    expect(resultParis).not.toBeNull();
    expect(resultNy).not.toBeNull();
    const deltaMs = resultNy!.getTime() - resultParis!.getTime();
    expect(deltaMs).toBe(6 * 60 * 60 * 1000);
  });

  it("overnight straddling window spanning fall-back Nov 1 2026 America/New_York defers to the correct UTC instant (extra hour honored)", () => {
    const straddling: QuietHoursPrefs = {
      quietStart: "22:00",
      quietEnd: "07:00",
      timezone: "America/New_York",
    };
    // 2026-10-31 23:00 EDT (offset -04:00, pre-fall-back) -- inside the
    // window's evening side. The deferred 07:00 target falls the morning
    // AFTER fall-back (offset -05:00) -- a naive single-offset conversion
    // would apply the WRONG (-04:00) offset and land an hour off; the
    // two-pass fixed point must get this right (mirrors the existing
    // spring-forward test in quiet-hours.spec.ts, but for fall-back).
    const now = new Date("2026-11-01T03:00:00.000Z");

    const result = computeDeferUntil(straddling, now);

    expect(result).toEqual(new Date("2026-11-01T12:00:00.000Z")); // 2026-11-01 07:00 EST
  });
});
