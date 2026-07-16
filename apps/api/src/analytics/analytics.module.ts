import { Module } from "@nestjs/common";

import { AnalyticsService } from "./analytics.service";

/**
 * `AppConfigService` is `@Global()` (config.module.ts) so this module needs
 * no `imports` -- consumers (`BillingModule`, `WorkersModule`) just import
 * `AnalyticsModule` to get `AnalyticsService`.
 */
@Module({
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
