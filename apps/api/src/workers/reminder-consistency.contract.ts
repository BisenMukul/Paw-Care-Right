/**
 * Single source of truth for the reminder-consistency BullMQ queue name, job
 * name, repeatable-scheduler id, and cron pattern (T062 plan "Files to
 * create/modify"). Mirrors `reminders-scheduler.contract.ts`. A SEPARATE
 * queue/scheduler id from the minute-tick (`reminders-scheduler.contract.ts`)
 * so `ReminderSchedulerProcessor` is left byte-for-byte unchanged (plan
 * decision 1). No logic here.
 */
export const REMINDER_CONSISTENCY_QUEUE = "pawcareright-reminder-consistency";

export const REMINDER_CONSISTENCY_JOB_NAME = "reminder-consistency-check";

export const REMINDER_CONSISTENCY_SCHEDULER_ID = "reminder-consistency-hourly";

export const REMINDER_CONSISTENCY_PATTERN = "0 * * * *";
