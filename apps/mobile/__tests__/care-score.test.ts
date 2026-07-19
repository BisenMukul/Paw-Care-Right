import type { AgendaEntry } from "@pawcareright/types";

import { computeCareScore } from "../src/care/care-score";

/** `now` frozen for every test (FIDELITY-1 plan: determinism via injected `now`). */
const NOW = new Date("2026-01-15T12:00:00.000Z");

function entry(overrides: Partial<AgendaEntry> & { dueAt: string; status: AgendaEntry["status"] }): AgendaEntry {
  return {
    reminderId: "reminder-1",
    petId: "pet-1",
    type: "VACCINE",
    title: "Rabies booster",
    virtual: false,
    ...overrides,
  };
}

describe("computeCareScore — no data / insufficient", () => {
  it("empty entries array -> insufficient (never a fake 100)", () => {
    const result = computeCareScore({ entries: [], now: NOW });
    expect(result).toEqual({ kind: "insufficient" });
  });

  it("entries all dueAt in the future (none due yet) -> insufficient, never penalised/never a fake score", () => {
    const entries: AgendaEntry[] = [
      entry({ reminderId: "r1", dueAt: "2026-01-16T09:00:00.000Z", status: "SCHEDULED" }),
      entry({ reminderId: "r2", dueAt: "2026-01-20T09:00:00.000Z", status: "SCHEDULED" }),
    ];
    const result = computeCareScore({ entries, now: NOW });
    expect(result).toEqual({ kind: "insufficient" });
  });

  it("non-vacuity: a broken formula that returned a fake value on no-data would fail this assertion", () => {
    const result = computeCareScore({ entries: [], now: NOW });
    expect(result.kind).toBe("insufficient");
    // A `{kind:"score", value:100}` fake result must NOT satisfy this shape.
    expect(result).not.toEqual({ kind: "score", value: 100, bucket: "onTrack" });
  });
});

describe("computeCareScore — partial completion + bucket boundaries", () => {
  it("computes the correct percentage and bucket for a partial window", () => {
    // 3 due in-window entries, 2 DONE -> round(2/3*100) = 67 -> someToLog
    const entries: AgendaEntry[] = [
      entry({ reminderId: "r1", dueAt: "2026-01-10T09:00:00.000Z", status: "DONE" }),
      entry({ reminderId: "r2", dueAt: "2026-01-11T09:00:00.000Z", status: "DONE" }),
      entry({ reminderId: "r3", dueAt: "2026-01-12T09:00:00.000Z", status: "MISSED" }),
    ];
    const result = computeCareScore({ entries, now: NOW });
    expect(result).toEqual({ kind: "score", value: 67, bucket: "someToLog" });
  });

  it("boundary: value 79 -> someToLog", () => {
    // 79 DONE out of 100 due (round-safe integers).
    const entries: AgendaEntry[] = [
      ...Array.from({ length: 79 }, (_, i) =>
        entry({ reminderId: `done-${i}`, dueAt: "2026-01-12T09:00:00.000Z", status: "DONE" }),
      ),
      ...Array.from({ length: 21 }, (_, i) =>
        entry({ reminderId: `missed-${i}`, dueAt: "2026-01-12T09:00:00.000Z", status: "MISSED" }),
      ),
    ];
    const result = computeCareScore({ entries, now: NOW });
    expect(result).toEqual({ kind: "score", value: 79, bucket: "someToLog" });
  });

  it("boundary: value 80 -> onTrack", () => {
    const entries: AgendaEntry[] = [
      ...Array.from({ length: 80 }, (_, i) =>
        entry({ reminderId: `done-${i}`, dueAt: "2026-01-12T09:00:00.000Z", status: "DONE" }),
      ),
      ...Array.from({ length: 20 }, (_, i) =>
        entry({ reminderId: `missed-${i}`, dueAt: "2026-01-12T09:00:00.000Z", status: "MISSED" }),
      ),
    ];
    const result = computeCareScore({ entries, now: NOW });
    expect(result).toEqual({ kind: "score", value: 80, bucket: "onTrack" });
  });

  it("boundary: value 40 -> someToLog", () => {
    const entries: AgendaEntry[] = [
      ...Array.from({ length: 40 }, (_, i) =>
        entry({ reminderId: `done-${i}`, dueAt: "2026-01-12T09:00:00.000Z", status: "DONE" }),
      ),
      ...Array.from({ length: 60 }, (_, i) =>
        entry({ reminderId: `missed-${i}`, dueAt: "2026-01-12T09:00:00.000Z", status: "MISSED" }),
      ),
    ];
    const result = computeCareScore({ entries, now: NOW });
    expect(result).toEqual({ kind: "score", value: 40, bucket: "someToLog" });
  });

  it("boundary: value 39 -> catchUp", () => {
    const entries: AgendaEntry[] = [
      ...Array.from({ length: 39 }, (_, i) =>
        entry({ reminderId: `done-${i}`, dueAt: "2026-01-12T09:00:00.000Z", status: "DONE" }),
      ),
      ...Array.from({ length: 61 }, (_, i) =>
        entry({ reminderId: `missed-${i}`, dueAt: "2026-01-12T09:00:00.000Z", status: "MISSED" }),
      ),
    ];
    const result = computeCareScore({ entries, now: NOW });
    expect(result).toEqual({ kind: "score", value: 39, bucket: "catchUp" });
  });
});

describe("computeCareScore — all-complete", () => {
  it("every due entry DONE -> value 100, onTrack", () => {
    const entries: AgendaEntry[] = [
      entry({ reminderId: "r1", dueAt: "2026-01-10T09:00:00.000Z", status: "DONE" }),
      entry({ reminderId: "r2", dueAt: "2026-01-12T09:00:00.000Z", status: "DONE" }),
    ];
    const result = computeCareScore({ entries, now: NOW });
    expect(result).toEqual({ kind: "score", value: 100, bucket: "onTrack" });
  });
});

describe("computeCareScore — only DONE counts as done", () => {
  it("SNOOZED/SCHEDULED/PENDING/SENT/MISSED (past-due) all count as due-but-not-done", () => {
    const entries: AgendaEntry[] = [
      entry({ reminderId: "r1", dueAt: "2026-01-10T09:00:00.000Z", status: "DONE" }),
      entry({ reminderId: "r2", dueAt: "2026-01-11T09:00:00.000Z", status: "SNOOZED" }),
      entry({ reminderId: "r3", dueAt: "2026-01-12T09:00:00.000Z", status: "PENDING" }),
      entry({ reminderId: "r4", dueAt: "2026-01-13T09:00:00.000Z", status: "SENT" }),
      entry({ reminderId: "r5", dueAt: "2026-01-14T09:00:00.000Z", status: "MISSED" }),
    ];
    // 1 DONE out of 5 due -> round(1/5*100) = 20 -> catchUp
    const result = computeCareScore({ entries, now: NOW });
    expect(result).toEqual({ kind: "score", value: 20, bucket: "catchUp" });
  });
});

describe("computeCareScore — window exclusion", () => {
  it("entries older than the trailing 7-day window are excluded", () => {
    const entries: AgendaEntry[] = [
      // Outside the window (more than 6 days before startOfDay(NOW)).
      entry({ reminderId: "old", dueAt: "2026-01-01T09:00:00.000Z", status: "MISSED" }),
      entry({ reminderId: "recent", dueAt: "2026-01-14T09:00:00.000Z", status: "DONE" }),
    ];
    const result = computeCareScore({ entries, now: NOW });
    expect(result).toEqual({ kind: "score", value: 100, bucket: "onTrack" });
  });
});

describe("computeCareScore — determinism", () => {
  it("identical input + now yields identical output across repeated calls", () => {
    const entries: AgendaEntry[] = [
      entry({ reminderId: "r1", dueAt: "2026-01-10T09:00:00.000Z", status: "DONE" }),
      entry({ reminderId: "r2", dueAt: "2026-01-11T09:00:00.000Z", status: "MISSED" }),
    ];
    const first = computeCareScore({ entries, now: NOW });
    const second = computeCareScore({ entries, now: new Date(NOW.getTime()) });
    expect(first).toEqual(second);
  });
});
