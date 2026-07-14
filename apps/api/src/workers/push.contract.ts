/**
 * Single source of truth for the push-delivery BullMQ queue name and job
 * payload shape (T056), shared by the producer (`ReminderSchedulerService`,
 * this task) and the T057 consumer. Mirrors `followups.contract.ts`.
 * The payload is deliberately minimal -- T057 loads the event/reminder/
 * devices itself and performs its own per-user collapse-with-count.
 *
 * `userId` (T058 checker fix): OPTIONAL, set ONLY on a quiet-hours deferred
 * re-enqueue (`push-sender.service.ts`). When present, `sendForEvent`
 * processes ONLY that one household member instead of the whole household
 * -- the original T056 scheduler job (no `userId`) still fans out to every
 * recipient exactly once. Without this, a deferred job re-running
 * `sendForEvent(reminderEventId)` for one quiet-houred member would
 * reprocess every OTHER co-household member too, double-pushing anyone
 * already sent in the original run (T058 checker BLOCKING finding).
 */
export const PUSH_QUEUE = "pawcareright-push";

export const PUSH_JOB_NAME = "reminder-push";

export interface PushJobData {
  reminderEventId: string;
  userId?: string;
}
