import type { TimelineItem } from "../src/api/health-logs-api";
import { groupTimelineByMonth } from "../src/health-logs/timeline-sections";
import { extractCheckRefId, summarizeTimelineValue } from "../src/health-logs/timeline-value";
import { strings } from "../src/strings";

// T067 plan "Tests to write": pure-logic unit tests for `groupTimelineByMonth`
// (incl. the device-local-vs-UTC tz-boundary guard for plan decision 7),
// `summarizeTimelineValue`, and `extractCheckRefId`. No React, no mocks.

function makeItem(overrides: Partial<TimelineItem> & Pick<TimelineItem, "id" | "kind" | "occurredAt">): TimelineItem {
  return { value: {}, photoKeys: [], ...overrides };
}

describe("groupTimelineByMonth", () => {
  it("groups items into device-local YYYY-MM sections, newest-first order preserved", () => {
    const a = makeItem({ id: "a", kind: "NOTE", occurredAt: "2024-03-15T10:00:00.000Z" });
    const b = makeItem({ id: "b", kind: "NOTE", occurredAt: "2024-03-01T10:00:00.000Z" });
    const c = makeItem({ id: "c", kind: "NOTE", occurredAt: "2024-02-20T10:00:00.000Z" });

    const sections = groupTimelineByMonth([a, b, c]);

    expect(sections).toEqual([
      { title: "2024-03", data: [a, b] },
      { title: "2024-02", data: [c] },
    ]);
  });

  it("returns an empty array for no items", () => {
    expect(groupTimelineByMonth([])).toEqual([]);
  });

  // This sandbox's Node process resolves `Intl`/`Date` to a fixed UTC clock
  // (confirmed: reassigning `process.env.TZ` at runtime has no effect here),
  // so a real device-local timezone cannot be swapped in for a test. Instead
  // this simulates a UTC+14 "device local" clock by monkeypatching the local
  // getters (`getFullYear`/`getMonth`/`getDate`) to read the shifted instant
  // via the UNaffected UTC getters -- `groupTimelineByMonth` is exercised
  // completely unmodified. A UTC-based bucketer (e.g. `toISOString().slice`
  // or the plain `getUTCMonth`/`getUTCFullYear` getters) would ignore this
  // monkeypatch entirely and still see "2024-01", so this fails exactly the
  // way decision 7's UTC regression would fail it.
  describe("device-local month at a tz boundary (plan decision 7)", () => {
    const SIMULATED_OFFSET_MS = 14 * 60 * 60 * 1000; // UTC+14
    const originalGetFullYear = Date.prototype.getFullYear;
    const originalGetMonth = Date.prototype.getMonth;
    const originalGetDate = Date.prototype.getDate;

    beforeEach(() => {
      Date.prototype.getFullYear = function (this: Date) {
        return new Date(this.getTime() + SIMULATED_OFFSET_MS).getUTCFullYear();
      };
      Date.prototype.getMonth = function (this: Date) {
        return new Date(this.getTime() + SIMULATED_OFFSET_MS).getUTCMonth();
      };
      Date.prototype.getDate = function (this: Date) {
        return new Date(this.getTime() + SIMULATED_OFFSET_MS).getUTCDate();
      };
    });

    afterEach(() => {
      Date.prototype.getFullYear = originalGetFullYear;
      Date.prototype.getMonth = originalGetMonth;
      Date.prototype.getDate = originalGetDate;
    });

    it("buckets by the simulated device-local month, not the UTC month", () => {
      // 2024-01-31T23:00:00.000Z is still January in UTC but already
      // February at a simulated UTC+14 "device local" clock.
      const item = makeItem({ id: "x", kind: "NOTE", occurredAt: "2024-01-31T23:00:00.000Z" });

      const sections = groupTimelineByMonth([item]);

      expect(sections).toEqual([{ title: "2024-02", data: [item] }]);
    });
  });
});

describe("summarizeTimelineValue", () => {
  it("WEIGHT -> grams", () => {
    const item = makeItem({ id: "w1", kind: "WEIGHT", occurredAt: "2024-01-01T00:00:00.000Z", value: { weightGrams: 25000 } });
    expect(summarizeTimelineValue(item)).toBe("25000 g");
  });

  it("NOTE -> verbatim text", () => {
    const item = makeItem({ id: "n1", kind: "NOTE", occurredAt: "2024-01-01T00:00:00.000Z", value: { text: "Ate a bug" } });
    expect(summarizeTimelineValue(item)).toBe("Ate a bug");
  });

  it("VET_VISIT -> reason", () => {
    const item = makeItem({
      id: "v1",
      kind: "VET_VISIT",
      occurredAt: "2024-01-01T00:00:00.000Z",
      value: { reason: "Annual checkup" },
    });
    expect(summarizeTimelineValue(item)).toBe("Annual checkup");
  });

  it("MED_GIVEN with name and dose -> the as-entered string", () => {
    const item = makeItem({
      id: "m1",
      kind: "MED_GIVEN",
      occurredAt: "2024-01-01T00:00:00.000Z",
      value: { reminderEventId: "re1", medNameAsEntered: "Amoxicillin", medDoseAsEntered: "50mg" },
    });
    expect(summarizeTimelineValue(item)).toBe("Amoxicillin — 50mg");
  });

  it("MED_GIVEN with neither name nor dose -> the neutral fallback", () => {
    const item = makeItem({
      id: "m2",
      kind: "MED_GIVEN",
      occurredAt: "2024-01-01T00:00:00.000Z",
      value: { reminderEventId: "re2" },
    });
    expect(summarizeTimelineValue(item)).toBe(strings.timeline.medGivenFallback);
  });

  it("MED_GIVEN with an invalid value -> the neutral fallback (never throws)", () => {
    const item = makeItem({ id: "m3", kind: "MED_GIVEN", occurredAt: "2024-01-01T00:00:00.000Z", value: { bogus: true } });
    expect(summarizeTimelineValue(item)).toBe(strings.timeline.medGivenFallback);
  });

  it("CHECK_REF -> the kind label", () => {
    const item = makeItem({
      id: "c1",
      kind: "CHECK_REF",
      occurredAt: "2024-01-01T00:00:00.000Z",
      value: { checkId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" },
    });
    expect(summarizeTimelineValue(item)).toBe(strings.timeline.kindLabel.CHECK_REF);
  });

  it("returns null when the value fails validation", () => {
    const item = makeItem({ id: "w2", kind: "WEIGHT", occurredAt: "2024-01-01T00:00:00.000Z", value: {} });
    expect(summarizeTimelineValue(item)).toBeNull();
  });
});

describe("extractCheckRefId", () => {
  it("returns the checkId for a valid CHECK_REF", () => {
    const item = makeItem({
      id: "c1",
      kind: "CHECK_REF",
      occurredAt: "2024-01-01T00:00:00.000Z",
      value: { checkId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" },
    });
    expect(extractCheckRefId(item)).toBe("9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
  });

  it("returns null for a malformed CHECK_REF value", () => {
    const item = makeItem({ id: "c2", kind: "CHECK_REF", occurredAt: "2024-01-01T00:00:00.000Z", value: { checkId: "not-a-uuid" } });
    expect(extractCheckRefId(item)).toBeNull();
  });

  it("returns null for a non-CHECK_REF kind", () => {
    const item = makeItem({ id: "n1", kind: "NOTE", occurredAt: "2024-01-01T00:00:00.000Z", value: { text: "hi" } });
    expect(extractCheckRefId(item)).toBeNull();
  });
});
