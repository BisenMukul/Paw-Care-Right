/**
 * Single source of truth for the follow-up-prompt BullMQ queue name and job
 * payload shape (T051), shared by the producer (`CheckRunnerProcessor`, this
 * task) and the future P5 consumer. Mirrors `images.contract.ts`/
 * `checks.contract.ts`. No processor is registered against this queue here
 * -- the delayed job is inert until P5 attaches a worker.
 */
export const FOLLOWUPS_QUEUE = "pawcareright-followups";

export const FOLLOWUP_JOB_NAME = "followup-prompt";

export interface FollowUpJobData {
  checkId: string;
}
