import { Module } from "@nestjs/common";

import { AnalyticsModule } from "../analytics/analytics.module";
import { PrismaModule } from "../prisma/prisma.module";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { RcWebhookController } from "./rc-webhook.controller";
import { RcWebhookGuard } from "./rc-webhook.guard";
import { RcWebhookService } from "./rc-webhook.service";
import { ReferralGrantService } from "./referral-grant.service";

/**
 * T072 owns the read-only entitlement path; T073 adds the RC webhook write
 * path; T108 adds `ReferralGrantService`, exported so `HouseholdsModule` can
 * inject it into the invite-accept transaction (no import cycle -- see
 * `households.module.ts`'s doc comment).
 */
@Module({
  imports: [PrismaModule, AnalyticsModule],
  controllers: [BillingController, RcWebhookController],
  providers: [BillingService, RcWebhookService, RcWebhookGuard, ReferralGrantService],
  exports: [BillingService, ReferralGrantService],
})
export class BillingModule {}
