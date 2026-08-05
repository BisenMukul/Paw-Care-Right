import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { getTextProvider, loadAiEnv } from "@bombaypetcompany/ai";

import { AnalyticsModule } from "../analytics/analytics.module";
import { AiAuditModule } from "../audit/ai-audit.module";
import { CHECKS_QUEUE } from "../checks/checks.contract";
import { MeModule } from "../me/me.module";
import { PrismaModule } from "../prisma/prisma.module";
import { QuotaModule } from "../quota/quota.module";
import { RedisModule } from "../redis/redis.module";
import { StorageModule } from "../storage/storage.module";
import { VisionModule } from "../vision/vision.module";
import { ACCOUNT_DELETION_QUEUE } from "./account-deletion.contract";
import { AccountDeletionProcessor } from "./account-deletion.processor";
import { AccountDeletionService } from "./account-deletion.service";
import { ACCOUNT_EXPORT_QUEUE } from "./account-export.contract";
import { AccountExportProcessor } from "./account-export.processor";
import { AI_AUDIT_RETENTION_QUEUE } from "./ai-audit-retention.contract";
import { AiAuditRetentionProcessor } from "./ai-audit-retention.processor";
import { AiAuditRetentionService } from "./ai-audit-retention.service";
import { TRIAGE_TEXT_MODEL_ID, TRIAGE_TEXT_PROVIDER } from "./check-runner.tokens";
import { CheckRunnerProcessor } from "./check-runner.processor";
import { EXPO_PUSH_CLIENT, SdkExpoPushClient } from "./expo-push.client";
import { FOLLOWUPS_QUEUE } from "./followups.contract";
import { IMAGES_QUEUE } from "./images.contract";
import { ImagesProcessor } from "./images.processor";
import { PUSH_QUEUE } from "./push.contract";
import { PUSH_RECEIPTS_QUEUE } from "./push-receipts.contract";
import { PushReceiptsProcessor } from "./push-receipts.processor";
import { PushSenderService } from "./push-sender.service";
import { PushProcessor } from "./push.processor";
import { REMINDER_CONSISTENCY_QUEUE } from "./reminder-consistency.contract";
import { ReminderConsistencyProcessor } from "./reminder-consistency.processor";
import { ReminderConsistencyService } from "./reminder-consistency.service";
import { ReminderSchedulerProcessor } from "./reminder-scheduler.processor";
import { ReminderSchedulerService } from "./reminder-scheduler.service";
import { REMINDERS_QUEUE } from "./reminders-scheduler.contract";

@Module({
  imports: [
    StorageModule,
    PrismaModule,
    VisionModule,
    QuotaModule,
    RedisModule,
    AnalyticsModule,
    AiAuditModule,
    // `MeModule` exports `AccountErasureService`/`AccountExportService`
    // (consumed by `AccountDeletionProcessor`/`AccountExportProcessor`
    // below). `MeModule` itself does NOT import `WorkersModule` (the
    // queue tokens live in these dependency-free `.contract.ts` files) --
    // no circular import (T091 plan step 30).
    MeModule,
    BullModule.registerQueue(
      { name: IMAGES_QUEUE },
      { name: CHECKS_QUEUE },
      { name: FOLLOWUPS_QUEUE },
      { name: REMINDERS_QUEUE },
      { name: PUSH_QUEUE },
      { name: PUSH_RECEIPTS_QUEUE },
      { name: REMINDER_CONSISTENCY_QUEUE },
      { name: AI_AUDIT_RETENTION_QUEUE },
      { name: ACCOUNT_EXPORT_QUEUE },
      { name: ACCOUNT_DELETION_QUEUE },
    ),
  ],
  providers: [
    ImagesProcessor,
    CheckRunnerProcessor,
    ReminderSchedulerService,
    ReminderSchedulerProcessor,
    PushSenderService,
    PushProcessor,
    PushReceiptsProcessor,
    ReminderConsistencyService,
    ReminderConsistencyProcessor,
    AiAuditRetentionService,
    AiAuditRetentionProcessor,
    AccountExportProcessor,
    AccountDeletionService,
    AccountDeletionProcessor,
    { provide: EXPO_PUSH_CLIENT, useClass: SdkExpoPushClient },
    { provide: TRIAGE_TEXT_PROVIDER, useFactory: () => getTextProvider() },
    { provide: TRIAGE_TEXT_MODEL_ID, useFactory: () => loadAiEnv().AI_TEXT_MODEL },
  ],
})
export class WorkersModule {}
