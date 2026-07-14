import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { PUSH_RECEIPTS_QUEUE, type PushReceiptJobData } from "./push-receipts.contract";
import { PushSenderService } from "./push-sender.service";

/**
 * Thin BullMQ wiring for T057 -- ALL business logic lives in
 * `PushSenderService` (plan "Files to create/modify").
 */
@Injectable()
@Processor(PUSH_RECEIPTS_QUEUE)
export class PushReceiptsProcessor extends WorkerHost {
  private readonly logger = new Logger(PushReceiptsProcessor.name);

  constructor(private readonly sender: PushSenderService) {
    super();
  }

  async process(job: Job<PushReceiptJobData>): Promise<void> {
    this.logger.log({ event: "push_receipt_job_start", jobId: job.id });
    await this.sender.checkReceipts(job.data.tickets);
  }
}
