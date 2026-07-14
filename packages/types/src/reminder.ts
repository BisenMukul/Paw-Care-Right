import { z } from "zod";

/**
 * Reminder / ReminderEvent shared vocabulary (T053).
 *
 * `apps/api/prisma/schema.prisma`'s `enum ReminderEventStatus` mirrors
 * `REMINDER_EVENT_STATUSES` verbatim and in this exact order, the same way
 * `check-status.ts`'s `CHECK_STATUSES` mirrors `enum CheckStatus`.
 *
 * `Reminder.type` is intentionally NOT a Prisma enum (plan decision 3):
 * ARCHITECTURE §3 leaves the `type` vocabulary open (unlike the closed
 * `status: PENDING|SENT|DONE|SNOOZED|MISSED` set), matching the repo's
 * existing "evolving vocab -> validated String" precedent
 * (`TriageResult.urgency`, `CheckFollowUp.response`). `REMINDER_TYPES` is a
 * conservative starting set the T054 template pack / T060 custom builder /
 * T061 medication subtype can extend without a migration.
 */

export const REMINDER_EVENT_STATUSES = ["PENDING", "SENT", "DONE", "SNOOZED", "MISSED"] as const;
export const reminderEventStatusSchema = z.enum(REMINDER_EVENT_STATUSES);
export type ReminderEventStatus = z.infer<typeof reminderEventStatusSchema>;

export const REMINDER_TYPES = [
  "VACCINE",
  "PARASITE",
  "MEDICATION",
  "GROOMING",
  "DENTAL",
  "VET_VISIT",
  "CUSTOM",
] as const;
export const reminderTypeSchema = z.enum(REMINDER_TYPES);
export type ReminderType = z.infer<typeof reminderTypeSchema>;
