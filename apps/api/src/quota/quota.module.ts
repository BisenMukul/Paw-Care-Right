import { Module } from "@nestjs/common";

import { RedisModule } from "../redis/redis.module";
import { CostLogService } from "./cost-log.service";
import { ENTITLEMENT_RESOLVER, StaticEntitlementResolver } from "./entitlement";
import { QuotaService } from "./quota.service";

@Module({
  imports: [RedisModule],
  providers: [QuotaService, CostLogService, { provide: ENTITLEMENT_RESOLVER, useClass: StaticEntitlementResolver }],
  exports: [QuotaService, CostLogService, ENTITLEMENT_RESOLVER],
})
export class QuotaModule {}
