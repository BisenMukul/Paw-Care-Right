import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { Redis } from "ioredis";

import { AppConfigService } from "../config/app-config.service";

/**
 * BullMQ root configuration, imported once in `AppModule`. Uses its own
 * dedicated `ioredis` connection (`maxRetriesPerRequest: null`, required by
 * BullMQ's blocking commands) rather than the shared `RedisService` client,
 * which is tuned for the app's own cache/rate-limit usage
 * (`maxRetriesPerRequest: 1`) and must not be reused here.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        connection: new Redis(config.redisUrl, { maxRetriesPerRequest: null }),
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
