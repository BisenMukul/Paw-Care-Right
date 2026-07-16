import { Module } from "@nestjs/common";

import { BillingModule } from "../billing/billing.module";
import { RedisModule } from "../redis/redis.module";
import { CostLogService } from "./cost-log.service";
import { BillingEntitlementResolver, ENTITLEMENT_RESOLVER } from "./entitlement";
import { QuotaService } from "./quota.service";

@Module({
  imports: [RedisModule, BillingModule],
  providers: [QuotaService, CostLogService, { provide: ENTITLEMENT_RESOLVER, useClass: BillingEntitlementResolver }],
  exports: [QuotaService, CostLogService, ENTITLEMENT_RESOLVER],
})
export class QuotaModule {}
