import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import type { Job, Queue } from "bullmq";

import { ReminderConsistencyService } from "./reminder-consistency.service";
import {
  REMINDER_CONSISTENCY_JOB_NAME,
  REMINDER_CONSISTENCY_PATTERN,
  REMINDER_CONSISTENCY_QUEUE,
  REMINDER_CONSISTENCY_SCHEDULER_ID,
} from "./reminder-consistency.contract";

/**
 * Thin BullMQ wiring for T062 -- ALL business logic lives in
 * `ReminderConsistencyService` (plan decision 1, mirrors
 * `reminder-scheduler.processor.ts`). `process()` runs once per hourly job
 * (registered by `onApplicationBootstrap` via `upsertJobScheduler`,
 * idempotent by scheduler id) and only logs the report summary -- the
 * report's own per-discrepancy `warn` lines are already emitted by the
 * service. No boot-time immediate scan (plan "Files to create/modify":
 * avoid boot-noise -- the hourly tick suffices).
 */
@Injectable()
@Processor(REMINDER_CONSISTENCY_QUEUE)
export class ReminderConsistencyProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(ReminderConsistencyProcessor.name);

  constructor(
    private readonly consistency: ReminderConsistencyService,
    @InjectQueue(REMINDER_CONSISTENCY_QUEUE) private readonly consistencyQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log({ event: "reminder_consistency_job_start", jobId: job.id });
    const report = await this.consistency.checkConsistency(new Date());
    this.logger.log({
      event: "reminder_consistency_job_done",
      remindersScanned: report.remindersScanned,
      predictedInWindow: report.predictedInWindow,
      materializedInWindow: report.materializedInWindow,
      discrepancyCount: report.discrepancies.length,
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.consistencyQueue.upsertJobScheduler(
      REMINDER_CONSISTENCY_SCHEDULER_ID,
      { pattern: REMINDER_CONSISTENCY_PATTERN },
      { name: REMINDER_CONSISTENCY_JOB_NAME, opts: { removeOnComplete: true, removeOnFail: false } },
    );
    this.logger.log({
      event: "reminder_consistency_scheduler_registered",
      schedulerId: REMINDER_CONSISTENCY_SCHEDULER_ID,
    });
  }
}
