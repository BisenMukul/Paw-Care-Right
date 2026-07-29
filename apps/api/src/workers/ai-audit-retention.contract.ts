/**
 * Single source of truth for the `AiAuditLog` 90-day retention BullMQ
 * queue/job/scheduler-id/cron/retention constants (T090 plan step 18).
 * Mirrors `reminder-consistency.contract.ts`. No logic here.
 */
export const AI_AUDIT_RETENTION_QUEUE = "bombaypetcompany-ai-audit-retention";

export const AI_AUDIT_RETENTION_JOB_NAME = "ai-audit-retention";

export const AI_AUDIT_RETENTION_SCHEDULER_ID = "ai-audit-retention-daily";

/** 03:30 UTC daily -- off the hourly-tick minute. */
export const AI_AUDIT_RETENTION_PATTERN = "30 3 * * *";

export const AI_AUDIT_RETENTION_DAYS = 90;

export const AI_AUDIT_RETENTION_BATCH_SIZE = 1000;

/** Bounded per run; the next scheduled run continues where this one left off. */
export const AI_AUDIT_RETENTION_MAX_BATCHES = 100;
