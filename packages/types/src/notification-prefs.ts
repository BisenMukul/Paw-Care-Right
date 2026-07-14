import { z } from "zod";

import { reminderTypeSchema } from "./reminder";

/**
 * Shared shapes for T058's per-user notification preferences: per-type
 * on/off (`disabledTypes` — items missing from the array are implicitly
 * ON) plus an optional all-or-nothing "quiet hours" window. The window is
 * exposed to clients as a single nested `quietHours` object (rather than
 * three loose fields) so a partial window (e.g. a `start` with no `tz`) is
 * a single well-formed reject at the schema boundary — see
 * `apps/api/src/notifications/dto/update-notification-prefs.dto.ts`, which
 * mirrors this shape with class-validator for the Nest `ValidationPipe`.
 */

export const QUIET_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const quietTimeSchema = z.string().regex(QUIET_TIME_REGEX, "Expected HH:mm (24-hour)");

const quietHoursSchema = z.object({
  start: quietTimeSchema,
  end: quietTimeSchema,
  timezone: z.string().min(1),
});

export const notificationPrefsSchema = z.object({
  disabledTypes: z.array(reminderTypeSchema),
  quietHours: quietHoursSchema.nullable(),
});

export const updateNotificationPrefsSchema = notificationPrefsSchema;

export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;
export type UpdateNotificationPrefsInput = z.infer<typeof updateNotificationPrefsSchema>;
