import { Module } from "@nestjs/common";

import { BillingModule } from "../billing/billing.module";
import { PrismaModule } from "../prisma/prisma.module";
import { QuotaModule } from "../quota/quota.module";
import { HouseholdsController } from "./households.controller";
import { HouseholdsService } from "./households.service";

/**
 * T108: imports `BillingModule` for its exported `ReferralGrantService`,
 * injected into `HouseholdsService.acceptInvite`'s existing transaction.
 * `BillingModule` does not import `HouseholdsModule` -- no cycle (plan §1.1).
 */
@Module({
  imports: [PrismaModule, QuotaModule, BillingModule],
  controllers: [HouseholdsController],
  providers: [HouseholdsService],
  exports: [HouseholdsService],
})
export class HouseholdsModule {}
