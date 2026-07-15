import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import type { Job, Queue } from "bullmq";

import { ReminderSchedulerService } from "./reminder-scheduler.service";
import {
  REMINDER_SCHEDULER_ID,
  REMINDER_TICK_JOB_NAME,
  REMINDER_TICK_PATTERN,
  REMINDERS_QUEUE,
} from "./reminders-scheduler.contract";

/**
 * Thin BullMQ wiring for T056 -- ALL business logic lives in
 * `ReminderSchedulerService` (plan "Files to create/modify" / "Risks &
 * decisions" #1). `process()` runs once per minute-tick job (registered by
 * `onApplicationBootstrap` below via `upsertJobScheduler`, idempotent by
 * scheduler id). `onApplicationBootstrap` runs the boot backfill BEFORE
 * registering the repeatable scheduler, per the plan's ordering.
 */
@Injectable()
@Processor(REMINDERS_QUEUE)
export class ReminderSchedulerProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(ReminderSchedulerProcessor.name);

  constructor(
    private readonly scheduler: ReminderSchedulerService,
    @InjectQueue(REMINDERS_QUEUE) private readonly remindersQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log({ event: "reminder_tick_job_start", jobId: job.id });
    await this.scheduler.tick(new Date());
    await this.scheduler.refireSnoozed(new Date());
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.scheduler.backfill(new Date());
    await this.remindersQueue.upsertJobScheduler(
      REMINDER_SCHEDULER_ID,
      { pattern: REMINDER_TICK_PATTERN },
      { name: REMINDER_TICK_JOB_NAME, opts: { removeOnComplete: true, removeOnFail: false } },
    );
    this.logger.log({ event: "reminder_scheduler_registered", schedulerId: REMINDER_SCHEDULER_ID });
  }
}
