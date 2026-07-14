import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { PUSH_QUEUE, type PushJobData } from "./push.contract";
import { PushSenderService } from "./push-sender.service";

/**
 * Thin BullMQ wiring for T057 -- ALL business logic lives in
 * `PushSenderService` (plan "Files to create/modify").
 */
@Injectable()
@Processor(PUSH_QUEUE)
export class PushProcessor extends WorkerHost {
  private readonly logger = new Logger(PushProcessor.name);

  constructor(private readonly sender: PushSenderService) {
    super();
  }

  async process(job: Job<PushJobData>): Promise<void> {
    this.logger.log({ event: "push_job_start", jobId: job.id });
    // `userId` is set only on a quiet-hours deferred re-enqueue (T058
    // checker fix) -- when present, only that one member is (re)processed,
    // never the whole household (see `push.contract.ts`).
    await this.sender.sendForEvent(job.data.reminderEventId, job.data.userId);
  }
}
