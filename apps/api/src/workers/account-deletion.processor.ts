import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import type { Job, Queue } from "bullmq";

import {
  ACCOUNT_DELETION_JOB_NAME,
  ACCOUNT_DELETION_PATTERN,
  ACCOUNT_DELETION_QUEUE,
  ACCOUNT_DELETION_SCHEDULER_ID,
} from "./account-deletion.contract";
import { AccountDeletionService } from "./account-deletion.service";

/**
 * Thin BullMQ wiring for the daily account-deletion sweep (T091 plan step
 * 26) -- ALL business logic lives in `AccountDeletionService`, mirrors
 * `ai-audit-retention.processor.ts` structurally.
 *
 * CLAUDE §6 worker checklist:
 *  - idempotent: `upsertJobScheduler` is keyed by `ACCOUNT_DELETION_SCHEDULER_ID`;
 *    `sweep`/`AccountErasureService.erase` are idempotent by construction.
 *  - retry with backoff: `attempts: 3` + exponential backoff.
 *  - dead-letter: `removeOnFail: false` retains a failed job in BullMQ's
 *    failed set, same as every other queue in this codebase.
 */
@Injectable()
@Processor(ACCOUNT_DELETION_QUEUE)
export class AccountDeletionProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(AccountDeletionProcessor.name);

  constructor(
    private readonly deletion: AccountDeletionService,
    @InjectQueue(ACCOUNT_DELETION_QUEUE) private readonly deletionQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log({ event: "account_deletion_job_start", jobId: job.id });
    const report = await this.deletion.sweep(new Date());
    this.logger.log({
      event: "account_deletion_job_done",
      usersScanned: report.usersScanned,
      usersErased: report.usersErased,
      usersFailed: report.usersFailed,
      batches: report.batches,
      exhausted: report.exhausted,
      exportsPurged: report.exportsPurged,
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.deletionQueue.upsertJobScheduler(
      ACCOUNT_DELETION_SCHEDULER_ID,
      { pattern: ACCOUNT_DELETION_PATTERN },
      {
        name: ACCOUNT_DELETION_JOB_NAME,
        opts: {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      },
    );
    this.logger.log({
      event: "account_deletion_scheduler_registered",
      schedulerId: ACCOUNT_DELETION_SCHEDULER_ID,
    });
  }
}
