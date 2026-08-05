import { Module } from "@nestjs/common";

import { RedisModule } from "../redis/redis.module";
import { AnomalyService } from "./anomaly.service";

/** `AnomalyService` only needs `RedisService` — no `ConfigModule` import (nothing here reads validated env). */
@Module({
  imports: [RedisModule],
  providers: [AnomalyService],
  exports: [AnomalyService],
})
export class AbuseModule {}
