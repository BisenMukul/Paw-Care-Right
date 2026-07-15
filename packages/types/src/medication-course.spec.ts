import { createMedicationCourseInputSchema, medicationCourseResponseSchema } from "./medication-course";

const VALID_INPUT = {
  medNameAsEntered: "As prescribed",
  medDoseAsEntered: "As instructed",
  doseStartAts: ["2026-08-01T09:00:00.000Z", "2026-08-01T21:00:00.000Z"],
  courseLengthDays: 10,
  timezone: "UTC",
};

describe("createMedicationCourseInputSchema", () => {
  it("accepts a valid course input", () => {
    expect(createMedicationCourseInputSchema.parse(VALID_INPUT)).toEqual(VALID_INPUT);
  });

  it("accepts medDoseAsEntered absent (optional)", () => {
    const { medNameAsEntered, doseStartAts, courseLengthDays, timezone } = VALID_INPUT;
    const payload = { medNameAsEntered, doseStartAts, courseLengthDays, timezone };
    expect(createMedicationCourseInputSchema.parse(payload)).toEqual(payload);
  });

  it("rejects empty doseStartAts", () => {
    const payload = { ...VALID_INPUT, doseStartAts: [] };
    expect(createMedicationCourseInputSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects courseLengthDays: 0", () => {
    const payload = { ...VALID_INPUT, courseLengthDays: 0 };
    expect(createMedicationCourseInputSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects courseLengthDays: 366", () => {
    const payload = { ...VALID_INPUT, courseLengthDays: 366 };
    expect(createMedicationCourseInputSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects a non-ISO doseStartAts entry", () => {
    const payload = { ...VALID_INPUT, doseStartAts: ["not-a-date"] };
    expect(createMedicationCourseInputSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects a missing medNameAsEntered", () => {
    const { medDoseAsEntered, doseStartAts, courseLengthDays, timezone } = VALID_INPUT;
    const payload = { medDoseAsEntered, doseStartAts, courseLengthDays, timezone };
    expect(createMedicationCourseInputSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects more than 12 doseStartAts", () => {
    const payload = { ...VALID_INPUT, doseStartAts: Array.from({ length: 13 }, () => "2026-08-01T09:00:00.000Z") };
    expect(createMedicationCourseInputSchema.safeParse(payload).success).toBe(false);
  });
});

describe("medicationCourseResponseSchema", () => {
  it("accepts a valid response", () => {
    const payload = { courseId: "course-1", reminderCount: 2 };
    expect(medicationCourseResponseSchema.parse(payload)).toEqual(payload);
  });

  it("rejects a missing reminderCount", () => {
    expect(medicationCourseResponseSchema.safeParse({ courseId: "course-1" }).success).toBe(false);
  });
});
