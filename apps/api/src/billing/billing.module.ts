import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { RcWebhookController } from "./rc-webhook.controller";
import { RcWebhookGuard } from "./rc-webhook.guard";
import { RcWebhookService } from "./rc-webhook.service";

/** T072 owns the read-only entitlement path; T073 adds the RC webhook write path. */
@Module({
  imports: [PrismaModule],
  controllers: [BillingController, RcWebhookController],
  providers: [BillingService, RcWebhookService, RcWebhookGuard],
  exports: [BillingService],
})
export class BillingModule {}
