import { z } from "zod";

import { REMINDER_EVENT_STATUSES } from "./reminder";

/**
 * Shared shapes for T060's agenda + occurrence-action endpoints (plan
 * decision 8, "Shared agenda + occurrence-action shapes live in
 * `packages/types`"). The api's `RemindersService`'s `AgendaEntry`/
 * `AgendaResponse` interfaces (T055, service-local) are a structural match
 * and stay as-is (mirrors T059's service-local + shared-read-type split) --
 * this module is the single Zod source of truth the mobile client parses/
 * infers against.
 *
 * A virtual (not-yet-materialized) occurrence's status is the literal
 * `"SCHEDULED"` -- distinct from the closed `ReminderEventStatus` set, which
 * only applies once an occurrence has a materialized `ReminderEvent` row.
 */

export const agendaEntryStatusSchema = z.enum([...REMINDER_EVENT_STATUSES, "SCHEDULED"]);
export type AgendaEntryStatus = z.infer<typeof agendaEntryStatusSchema>;

export const agendaEntrySchema = z.object({
  reminderId: z.string(),
  petId: z.string(),
  // `z.string()` (not `reminderTypeSchema`) mirrors the open `Reminder.type`
  // String column (see `./reminder.ts`'s header comment) -- this is a read
  // projection of whatever value is stored, not a write-time constraint.
  type: z.string(),
  title: z.string(),
  dueAt: z.iso.datetime(),
  status: agendaEntryStatusSchema,
  virtual: z.boolean(),
  eventId: z.string().optional(),
  // T061 medication subtype: name/dose exactly as entered, propagated
  // verbatim (never app-authored) so the agenda can show them as a record.
  medNameAsEntered: z.string().optional(),
  medDoseAsEntered: z.string().optional(),
});

export type AgendaEntry = z.infer<typeof agendaEntrySchema>;

export const agendaResponseSchema = z.object({
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  entries: z.array(agendaEntrySchema),
});

export type AgendaResponse = z.infer<typeof agendaResponseSchema>;

export const completeOccurrenceInputSchema = z.object({
  dueAt: z.iso.datetime(),
});

export type CompleteOccurrenceInput = z.infer<typeof completeOccurrenceInputSchema>;

export const snoozeOccurrenceInputSchema = z.object({
  dueAt: z.iso.datetime(),
  snoozeUntil: z.iso.datetime(),
});

export type SnoozeOccurrenceInput = z.infer<typeof snoozeOccurrenceInputSchema>;
