import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { AccountExportService } from "../me/account-export.service";
import { ACCOUNT_EXPORT_QUEUE, type AccountExportJobData } from "./account-export.contract";

/**
 * Thin BullMQ wiring for the account-export bundle build (T091 plan step
 * 23) -- ALL business logic lives in `AccountExportService.build`. Jobs are
 * enqueued (with `attempts: 3` + exponential backoff + `removeOnFail: false`)
 * by `PrivacyService.requestExport`. Idempotent by construction:
 * `AccountExportService.build` overwrites the same `exports/<userId>/
 * <exportId>.json` object key on a retry.
 */
@Injectable()
@Processor(ACCOUNT_EXPORT_QUEUE)
export class AccountExportProcessor extends WorkerHost {
  private readonly logger = new Logger(AccountExportProcessor.name);

  constructor(private readonly exportService: AccountExportService) {
    super();
  }

  async process(job: Job<AccountExportJobData>): Promise<void> {
    const { exportId, userId } = job.data;
    this.logger.log({ event: "account_export_job_start", jobId: job.id, exportId });
    await this.exportService.build(exportId, userId);
    this.logger.log({ event: "account_export_job_done", jobId: job.id, exportId });
  }
}
