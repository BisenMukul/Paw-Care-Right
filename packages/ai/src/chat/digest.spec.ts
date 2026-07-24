import { scanUnsafeText } from "../evals/detector";
import { buildTimelineDigest, DIGEST_MAX_CHARS } from "./digest";
import type { TimelineDigestInput } from "./types";

function emptyInput(): TimelineDigestInput {
  return { weights: [], checks: [], notes: [], medicationDoseCount: 0 };
}

function richInput(): TimelineDigestInput {
  return {
    weights: [
      { occurredAt: new Date("2026-05-01T00:00:00.000Z"), grams: 20000 },
      { occurredAt: new Date("2026-07-20T00:00:00.000Z"), grams: 20500 },
    ],
    checks: [
      { createdAt: new Date("2026-07-18T00:00:00.000Z"), tier: "MONITOR" },
      { createdAt: new Date("2026-06-01T00:00:00.000Z"), tier: null },
    ],
    notes: [
      { occurredAt: new Date("2026-07-19T00:00:00.000Z"), text: "Seemed a bit tired after the walk." },
      { occurredAt: new Date("2026-06-15T00:00:00.000Z"), text: "Ate all his breakfast, playful all day." },
    ],
    medicationDoseCount: 6,
  };
}

describe("buildTimelineDigest", () => {
  it("is deterministic (same input => same output)", () => {
    expect(buildTimelineDigest(richInput())).toBe(buildTimelineDigest(richInput()));
  });

  it("renders explicit 'none recorded' lines for every empty source", () => {
    const digest = buildTimelineDigest(emptyInput());
    expect(digest).toMatch(/No weight entries recorded\./);
    expect(digest).toMatch(/No symptom checks recorded\./);
    expect(digest).toMatch(/No notes recorded\./);
    expect(digest).toMatch(/Medication doses recorded \(last 90 days\): 0/);
  });

  it("keeps the fixed section order: header, weight, checks, notes, medication count", () => {
    const digest = buildTimelineDigest(richInput());
    const headerIdx = digest.indexOf("TIMELINE (LAST 90 DAYS, RECORDED FACTS ONLY)");
    const weightIdx = digest.indexOf("Weight:");
    const checksIdx = digest.indexOf("Symptom checks:");
    const notesIdx = digest.indexOf("Notes:");
    const medIdx = digest.indexOf("Medication doses recorded");

    expect(headerIdx).toBeLessThan(weightIdx);
    expect(weightIdx).toBeLessThan(checksIdx);
    expect(checksIdx).toBeLessThan(notesIdx);
    expect(notesIdx).toBeLessThan(medIdx);
  });

  it("never emits a medication name or dose, even when medicationDoseCount is large", () => {
    const digest = buildTimelineDigest({ ...richInput(), medicationDoseCount: 42 });
    expect(digest).toMatch(/Medication doses recorded \(last 90 days\): 42/);
    expect(digest).not.toMatch(/mg|ml|tablet|capsule|ibuprofen|acetaminophen/i);
  });

  it("respects the DIGEST_MAX_CHARS cap even with a very large number of checks/notes", () => {
    const manyChecks = Array.from({ length: 50 }, (_, i) => ({
      createdAt: new Date(2026, 5, 1 + i),
      tier: "MONITOR" as const,
    }));
    const manyNotes = Array.from({ length: 50 }, (_, i) => ({
      occurredAt: new Date(2026, 5, 1 + i),
      text: `Note number ${i} with some reasonably long descriptive text about the pet's day.`,
    }));

    const digest = buildTimelineDigest({
      weights: richInput().weights,
      checks: manyChecks,
      notes: manyNotes,
      medicationDoseCount: 3,
    });

    expect(digest.length).toBeLessThanOrEqual(DIGEST_MAX_CHARS);
    expect(digest.endsWith("Medication doses recorded (last 90 days): 3")).toBe(true);
  });

  it("scans clean via scanUnsafeText on a rich fixture", () => {
    expect(scanUnsafeText(buildTimelineDigest(richInput()))).toEqual([]);
  });
});
