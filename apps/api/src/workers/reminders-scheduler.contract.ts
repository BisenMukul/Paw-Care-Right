/**
 * Single source of truth for the reminder-scheduler BullMQ queue name, tick
 * job name, repeatable-scheduler id, and cron pattern (T056 plan "Files to
 * create/modify"). Mirrors `followups.contract.ts`/`images.contract.ts`. No
 * logic here.
 */
export const REMINDERS_QUEUE = "pawcareright-reminders";

export const REMINDER_TICK_JOB_NAME = "reminder-tick";

export const REMINDER_SCHEDULER_ID = "reminder-minute-tick";

export const REMINDER_TICK_PATTERN = "* * * * *";
