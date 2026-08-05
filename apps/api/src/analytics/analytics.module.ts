import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { AnalyticsService } from "./analytics.service";

/**
 * `AppConfigService` is `@Global()` (config.module.ts) so this module needs
 * no explicit import for it -- consumers (`BillingModule`, `WorkersModule`)
 * just import `AnalyticsModule` to get `AnalyticsService`. `PrismaModule` is
 * imported (T091 plan step 9) for `captureForUser`'s consent read.
 */
@Module({
  imports: [PrismaModule],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
