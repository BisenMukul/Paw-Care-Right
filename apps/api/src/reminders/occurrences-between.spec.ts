import type { ParsedRRule } from "@pawcareright/types";
import { parseRRule } from "@pawcareright/types";

import { occurrencesBetween } from "./occurrences-between";

/** Test-local convenience: valid-input parsing itself is proven by rrule.spec.ts. */
function rule(input: string): ParsedRRule {
  const parsed = parseRRule(input);
  if (!parsed.ok) throw new Error(`test fixture rrule is invalid: ${input} (${parsed.reason})`);
  return parsed.value;
}

describe("occurrencesBetween", () => {
  describe("Europe/Paris spring-forward (2026-03-29, clocks 02:00 -> 03:00)", () => {
    it("keeps local 09:00 while the UTC offset shifts across the boundary", () => {
      const startAt = new Date("2026-01-05T08:00:00.000Z"); // 09:00 CET (Jan, UTC+1) -- arbitrary anchor, well before the window
      const from = new Date("2026-03-27T00:00:00.000Z");
      const to = new Date("2026-03-31T00:00:00.000Z");

      const occurrences = occurrencesBetween(rule("FREQ=DAILY"), startAt, "Europe/Paris", from, to);
      const isoDates = occurrences.map((d) => d.toISOString());

      // 2026-03-28 09:00 Europe/Paris = 08:00Z (CET, UTC+1) -- before the boundary.
      expect(isoDates).toContain("2026-03-28T08:00:00.000Z");
      // 2026-03-30 09:00 Europe/Paris = 07:00Z (CEST, UTC+2) -- after the boundary.
      expect(isoDates).toContain("2026-03-30T07:00:00.000Z");
    });
  });

  describe("America/New_York spring-forward (2026-03-08)", () => {
    it("keeps local 09:00 while the UTC offset shifts across the boundary", () => {
      const startAt = new Date("2026-01-05T14:00:00.000Z"); // 09:00 EST (Jan, UTC-5)
      const from = new Date("2026-03-06T00:00:00.000Z");
      const to = new Date("2026-03-10T00:00:00.000Z");

      const occurrences = occurrencesBetween(rule("FREQ=DAILY"), startAt, "America/New_York", from, to);
      const isoDates = occurrences.map((d) => d.toISOString());

      // 2026-03-06 09:00 America/New_York = 14:00Z (EST, UTC-5) -- before the boundary.
      expect(isoDates).toContain("2026-03-06T14:00:00.000Z");
      // 2026-03-09 09:00 America/New_York = 13:00Z (EDT, UTC-4) -- after the boundary.
      expect(isoDates).toContain("2026-03-09T13:00:00.000Z");
    });
  });

  describe("fall-back", () => {
    it("America/New_York 2026-11-01: local 09:00 is preserved as the UTC offset shifts back", () => {
      // US fall-back is 2026-11-01 (clocks 02:00 -> 01:00 local).
      const startAt = new Date("2026-01-05T14:00:00.000Z"); // 09:00 EST (Jan, UTC-5)
      const from = new Date("2026-10-30T00:00:00.000Z");
      const to = new Date("2026-11-03T00:00:00.000Z");

      const occurrences = occurrencesBetween(rule("FREQ=DAILY"), startAt, "America/New_York", from, to);
      const isoDates = occurrences.map((d) => d.toISOString());

      // 2026-10-31 09:00 America/New_York = 13:00Z (EDT, UTC-4) -- before fall-back.
      expect(isoDates).toContain("2026-10-31T13:00:00.000Z");
      // 2026-11-02 09:00 America/New_York = 14:00Z (EST, UTC-5) -- after fall-back.
      expect(isoDates).toContain("2026-11-02T14:00:00.000Z");
    });

    it("Europe/Paris 2026-10-25: local 09:00 is preserved as the UTC offset shifts back", () => {
      // EU fall-back is 2026-10-25 (clocks 03:00 -> 02:00 local).
      const startAt = new Date("2026-01-05T08:00:00.000Z"); // 09:00 CET (Jan, UTC+1)
      const from = new Date("2026-10-23T00:00:00.000Z");
      const to = new Date("2026-10-27T00:00:00.000Z");

      const occurrences = occurrencesBetween(rule("FREQ=DAILY"), startAt, "Europe/Paris", from, to);
      const isoDates = occurrences.map((d) => d.toISOString());

      // 2026-10-24 09:00 Europe/Paris = 07:00Z (CEST, UTC+2) -- before fall-back.
      expect(isoDates).toContain("2026-10-24T07:00:00.000Z");
      // 2026-10-26 09:00 Europe/Paris = 08:00Z (CET, UTC+1) -- after fall-back.
      expect(isoDates).toContain("2026-10-26T08:00:00.000Z");
    });
  });

  describe("monthly-on-31st", () => {
    it("FREQ=MONTHLY;BYMONTHDAY=31 from a 2026-01-31 anchor only fires Jan 31 and Mar 31 -- Feb/Apr absent, no roll-forward", () => {
      const startAt = new Date("2026-01-31T09:00:00.000Z");
      const from = new Date("2026-01-01T00:00:00.000Z");
      const to = new Date("2026-05-01T00:00:00.000Z");

      const occurrences = occurrencesBetween(rule("FREQ=MONTHLY;BYMONTHDAY=31"), startAt, "UTC", from, to);

      expect(occurrences).toEqual([
        new Date("2026-01-31T09:00:00.000Z"),
        new Date("2026-03-31T09:00:00.000Z"),
      ]);
    });
  });

  describe("window/bounds guards", () => {
    it("from > to -> []", () => {
      const startAt = new Date("2026-01-01T09:00:00.000Z");
      const from = new Date("2026-02-01T00:00:00.000Z");
      const to = new Date("2026-01-01T00:00:00.000Z");

      expect(occurrencesBetween(rule("FREQ=DAILY"), startAt, "UTC", from, to)).toEqual([]);
    });

    it("an occurrence exactly at `from` and exactly at `to` are both included (inclusive boundaries)", () => {
      const startAt = new Date("2026-01-01T09:00:00.000Z");
      const from = new Date("2026-01-02T09:00:00.000Z"); // exact occurrence instant
      const to = new Date("2026-01-03T09:00:00.000Z"); // exact occurrence instant

      const occurrences = occurrencesBetween(rule("FREQ=DAILY"), startAt, "UTC", from, to);

      expect(occurrences).toEqual([
        new Date("2026-01-02T09:00:00.000Z"),
        new Date("2026-01-03T09:00:00.000Z"),
      ]);
    });

    it("a COUNT-bounded rule stops within the window once the series is exhausted", () => {
      const startAt = new Date("2026-01-01T09:00:00.000Z");
      const from = new Date("2026-01-01T00:00:00.000Z");
      const to = new Date("2026-01-10T00:00:00.000Z");

      const occurrences = occurrencesBetween(rule("FREQ=DAILY;COUNT=2"), startAt, "UTC", from, to);

      expect(occurrences).toEqual([
        new Date("2026-01-01T09:00:00.000Z"),
        new Date("2026-01-02T09:00:00.000Z"),
      ]);
    });

    it("an UNTIL-bounded rule stops within the window once the series is exhausted", () => {
      const startAt = new Date("2026-01-01T09:00:00.000Z");
      const from = new Date("2026-01-01T00:00:00.000Z");
      const to = new Date("2026-01-10T00:00:00.000Z");

      const occurrences = occurrencesBetween(
        rule("FREQ=DAILY;UNTIL=20260102T090000Z"),
        startAt,
        "UTC",
        from,
        to,
      );

      expect(occurrences).toEqual([
        new Date("2026-01-01T09:00:00.000Z"),
        new Date("2026-01-02T09:00:00.000Z"),
      ]);
    });
  });
});
