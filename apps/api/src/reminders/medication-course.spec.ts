import { parseRRule } from "@pawcareright/types";

import { buildMedicationCourse, type MedicationCourseSpec } from "./medication-course";
import { occurrencesBetween } from "./occurrences-between";

const FAR_PAST = new Date("2000-01-01T00:00:00.000Z");
const FAR_FUTURE = new Date("2100-01-01T00:00:00.000Z");

/** Sums MATERIALIZABLE occurrences (via `occurrencesBetween`, over an unbounded window) across every sibling spec -- proves COUNT terminates each sibling, not the query window (plan Risk 2). */
function totalOccurrences(specs: MedicationCourseSpec[]): number {
  return specs.reduce((sum, spec) => {
    const parsed = parseRRule(spec.rrule);
    if (!parsed.ok) {
      throw new Error(parsed.reason);
    }
    return sum + occurrencesBetween(parsed.value, spec.startAt, spec.timezone, FAR_PAST, FAR_FUTURE).length;
  }, 0);
}

describe("buildMedicationCourse (T061 AC1)", () => {
  it("2x/day for 10 days -> 2 sibling specs, each FREQ=DAILY;COUNT=10, materializing 20 occurrences total", () => {
    const specs = buildMedicationCourse({
      medNameAsEntered: "As prescribed",
      doseStartAts: ["2026-08-01T09:00:00.000Z", "2026-08-01T21:00:00.000Z"],
      courseLengthDays: 10,
      timezone: "UTC",
      courseId: "course-1",
    });

    expect(specs).toHaveLength(2);
    for (const spec of specs) {
      expect(spec.rrule).toBe("FREQ=DAILY;COUNT=10");
      expect(spec.title).toBe("As prescribed");
      expect(spec.courseId).toBe("course-1");
      expect(spec.type).toBe("MEDICATION");
      expect(spec.active).toBe(true);
    }
    expect(totalOccurrences(specs)).toBe(20);
  });

  it("3x/day for 7 days -> 21 materializable occurrences", () => {
    const specs = buildMedicationCourse({
      medNameAsEntered: "As prescribed",
      doseStartAts: ["2026-08-01T07:00:00.000Z", "2026-08-01T13:00:00.000Z", "2026-08-01T19:00:00.000Z"],
      courseLengthDays: 7,
      timezone: "UTC",
      courseId: "course-2",
    });

    expect(specs).toHaveLength(3);
    expect(totalOccurrences(specs)).toBe(21);
  });

  it("1x/day for 30 days -> 30 materializable occurrences", () => {
    const specs = buildMedicationCourse({
      medNameAsEntered: "As prescribed",
      doseStartAts: ["2026-08-01T09:00:00.000Z"],
      courseLengthDays: 30,
      timezone: "UTC",
      courseId: "course-3",
    });

    expect(specs).toHaveLength(1);
    expect(totalOccurrences(specs)).toBe(30);
  });

  it("all specs share one courseId; medDoseAsEntered propagated when present", () => {
    const specs = buildMedicationCourse({
      medNameAsEntered: "As prescribed",
      medDoseAsEntered: "As instructed",
      doseStartAts: ["2026-08-01T09:00:00.000Z", "2026-08-01T21:00:00.000Z"],
      courseLengthDays: 5,
      timezone: "UTC",
      courseId: "course-4",
    });

    expect(new Set(specs.map((spec) => spec.courseId)).size).toBe(1);
    expect(specs.every((spec) => spec.medDoseAsEntered === "As instructed")).toBe(true);
  });

  it("omitted medDoseAsEntered is not set on any spec", () => {
    const specs = buildMedicationCourse({
      medNameAsEntered: "As prescribed",
      doseStartAts: ["2026-08-01T09:00:00.000Z"],
      courseLengthDays: 5,
      timezone: "UTC",
      courseId: "course-5",
    });

    expect(specs[0]?.medDoseAsEntered).toBeUndefined();
  });

  it("identical doseStartAts instants are de-duped", () => {
    const specs = buildMedicationCourse({
      medNameAsEntered: "As prescribed",
      doseStartAts: [
        "2026-08-01T09:00:00.000Z",
        "2026-08-01T09:00:00.000Z",
        "2026-08-01T21:00:00.000Z",
      ],
      courseLengthDays: 5,
      timezone: "UTC",
      courseId: "course-6",
    });

    expect(specs).toHaveLength(2);
  });
});
