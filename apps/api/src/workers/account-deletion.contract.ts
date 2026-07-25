/**
 * Single source of truth for the account-deletion daily-sweep BullMQ
 * queue/job/scheduler-id/cron/batch constants (T091 plan step 24). Mirrors
 * `ai-audit-retention.contract.ts`'s style. No logic here.
 */
export const ACCOUNT_DELETION_QUEUE = "pawcareright-account-deletion";

export const ACCOUNT_DELETION_JOB_NAME = "account-deletion-sweep";

export const ACCOUNT_DELETION_SCHEDULER_ID = "account-deletion-daily";

/** 04:15 UTC daily -- off every existing scheduler's minute (ai-audit-retention is 03:30). */
export const ACCOUNT_DELETION_PATTERN = "15 4 * * *";

export const ACCOUNT_DELETION_BATCH_SIZE = 100;

/** Bounded per run; the next scheduled run continues where this one left off. */
export const ACCOUNT_DELETION_MAX_BATCHES = 100;
