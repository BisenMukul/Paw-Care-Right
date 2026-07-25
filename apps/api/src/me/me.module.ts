import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { RedisModule } from "../redis/redis.module";
import { StorageModule } from "../storage/storage.module";
import { ACCOUNT_EXPORT_QUEUE } from "../workers/account-export.contract";
import { AccountErasureService } from "./account-erasure.service";
import { AccountExportService } from "./account-export.service";
import { PrivacyController } from "./privacy.controller";
import { PrivacyService } from "./privacy.service";

/**
 * Privacy: consent, export & deletion (T091 plan step 30). Registers the
 * `ACCOUNT_EXPORT_QUEUE` producer side (`PrivacyService.requestExport`
 * enqueues onto it); the CONSUMER side (`AccountExportProcessor`,
 * `AccountDeletionProcessor`) lives in `WorkersModule`, which imports THIS
 * module for `AccountErasureService`/`AccountExportService` -- this module
 * deliberately does NOT import `WorkersModule` (the queue name/job-data
 * contracts live in dependency-free `.contract.ts` files precisely so
 * neither module needs the other), avoiding a circular import.
 */
@Module({
  imports: [
    PrismaModule,
    StorageModule,
    RedisModule,
    BullModule.registerQueue({ name: ACCOUNT_EXPORT_QUEUE }),
  ],
  controllers: [PrivacyController],
  providers: [PrivacyService, AccountErasureService, AccountExportService],
  exports: [PrivacyService, AccountErasureService, AccountExportService],
})
export class MeModule {}
