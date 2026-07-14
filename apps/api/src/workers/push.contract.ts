/**
 * Single source of truth for the push-delivery BullMQ queue name and job
 * payload shape (T056), shared by the producer (`ReminderSchedulerService`,
 * this task) and the future T057 consumer. Mirrors `followups.contract.ts`.
 * The payload is deliberately minimal -- T057 loads the event/reminder/
 * devices itself and performs its own per-user collapse-with-count. No
 * processor is registered against this queue here -- it is inert until T057
 * attaches a worker.
 */
export const PUSH_QUEUE = "pawcareright-push";

export const PUSH_JOB_NAME = "reminder-push";

export interface PushJobData {
  reminderEventId: string;
}
