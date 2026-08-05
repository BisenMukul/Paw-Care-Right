import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import type { Job, Queue } from "bullmq";

import {
  AI_AUDIT_RETENTION_JOB_NAME,
  AI_AUDIT_RETENTION_PATTERN,
  AI_AUDIT_RETENTION_QUEUE,
  AI_AUDIT_RETENTION_SCHEDULER_ID,
} from "./ai-audit-retention.contract";
import { AiAuditRetentionService } from "./ai-audit-retention.service";

/**
 * Thin BullMQ wiring for the `AiAuditLog` 90-day retention sweep (T090 plan
 * step 20) -- ALL business logic lives in `AiAuditRetentionService`, mirrors
 * `reminder-consistency.processor.ts` structurally.
 *
 * CLAUDE §6 worker checklist:
 *  - idempotent: `upsertJobScheduler` is keyed by `AI_AUDIT_RETENTION_SCHEDULER_ID`;
 *    `purge` is idempotent by construction (a second run over already-purged
 *    data deletes 0 rows).
 *  - retry with backoff: `attempts: 3` + exponential backoff --
 *    `QueueModule` sets no `defaultJobOptions` (verified), so this must be
 *    (and is) set in the scheduler's own job opts.
 *  - dead-letter: `removeOnFail: false` retains a failed job in BullMQ's
 *    failed set, same as every other queue in this codebase.
 */
@Injectable()
@Processor(AI_AUDIT_RETENTION_QUEUE)
export class AiAuditRetentionProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(AiAuditRetentionProcessor.name);

  constructor(
    private readonly retention: AiAuditRetentionService,
    @InjectQueue(AI_AUDIT_RETENTION_QUEUE) private readonly retentionQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log({ event: "ai_audit_retention_job_start", jobId: job.id });
    const report = await this.retention.purge(new Date());
    this.logger.log({
      event: "ai_audit_retention_job_done",
      deleted: report.deleted,
      batches: report.batches,
      exhausted: report.exhausted,
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.retentionQueue.upsertJobScheduler(
      AI_AUDIT_RETENTION_SCHEDULER_ID,
      { pattern: AI_AUDIT_RETENTION_PATTERN },
      {
        name: AI_AUDIT_RETENTION_JOB_NAME,
        opts: {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      },
    );
    this.logger.log({
      event: "ai_audit_retention_scheduler_registered",
      schedulerId: AI_AUDIT_RETENTION_SCHEDULER_ID,
    });
  }
}
