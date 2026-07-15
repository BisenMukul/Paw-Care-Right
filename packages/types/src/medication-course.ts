import { z } from "zod";

/**
 * `createMedicationCourseInputSchema` (T061 plan decisions 1/9): the mobile
 * client sends a free-text name/dose exactly as entered, plus one computed
 * UTC instant per daily dose time and the course length in days.
 * `apps/api/src/reminders/medication-course.ts`'s `buildMedicationCourse`
 * expands this into one sibling `Reminder` per (de-duped) dose time, each
 * `FREQ=DAILY;COUNT=<courseLengthDays>` -- a reminder CADENCE, never dosing
 * math or advice (CLAUDE §7 rule 2).
 */
export const createMedicationCourseInputSchema = z.object({
  medNameAsEntered: z.string().min(1).max(120),
  medDoseAsEntered: z.string().max(120).optional(),
  doseStartAts: z.array(z.iso.datetime()).min(1).max(12),
  courseLengthDays: z.number().int().min(1).max(365),
  timezone: z.string(),
});

export type MedicationCourseInput = z.infer<typeof createMedicationCourseInputSchema>;

export const medicationCourseResponseSchema = z.object({
  courseId: z.string(),
  reminderCount: z.number().int(),
});

export type MedicationCourseResponse = z.infer<typeof medicationCourseResponseSchema>;
