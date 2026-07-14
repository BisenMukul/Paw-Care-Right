import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { getTextProvider, loadAiEnv } from "@pawcareright/ai";

import { CHECKS_QUEUE } from "../checks/checks.contract";
import { PrismaModule } from "../prisma/prisma.module";
import { QuotaModule } from "../quota/quota.module";
import { StorageModule } from "../storage/storage.module";
import { VisionModule } from "../vision/vision.module";
import { TRIAGE_TEXT_MODEL_ID, TRIAGE_TEXT_PROVIDER } from "./check-runner.tokens";
import { CheckRunnerProcessor } from "./check-runner.processor";
import { FOLLOWUPS_QUEUE } from "./followups.contract";
import { IMAGES_QUEUE } from "./images.contract";
import { ImagesProcessor } from "./images.processor";
import { PUSH_QUEUE } from "./push.contract";
import { ReminderSchedulerProcessor } from "./reminder-scheduler.processor";
import { ReminderSchedulerService } from "./reminder-scheduler.service";
import { REMINDERS_QUEUE } from "./reminders-scheduler.contract";

@Module({
  imports: [
    StorageModule,
    PrismaModule,
    VisionModule,
    QuotaModule,
    BullModule.registerQueue(
      { name: IMAGES_QUEUE },
      { name: CHECKS_QUEUE },
      { name: FOLLOWUPS_QUEUE },
      { name: REMINDERS_QUEUE },
      { name: PUSH_QUEUE },
    ),
  ],
  providers: [
    ImagesProcessor,
    CheckRunnerProcessor,
    ReminderSchedulerService,
    ReminderSchedulerProcessor,
    { provide: TRIAGE_TEXT_PROVIDER, useFactory: () => getTextProvider() },
    { provide: TRIAGE_TEXT_MODEL_ID, useFactory: () => loadAiEnv().AI_TEXT_MODEL },
  ],
})
export class WorkersModule {}
