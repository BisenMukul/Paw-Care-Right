import { Injectable, Logger } from "@nestjs/common";
import { createAnalytics, createHttpTransport, type Analytics, type AnalyticsEventMap, type AnalyticsEventName } from "@pawcareright/analytics";

import { AppConfigService } from "../config/app-config.service";

/**
 * Server-side PostHog emitter (T078 plan). Server events are NOT
 * consent-gated in v1 (decision 4/R1 -- server consent propagation is
 * T091's scope); the underlying transport is stub-safe (an empty
 * `POSTHOG_API_KEY` makes it a no-op, so tests/CI never hit the network).
 * `capture` never throws -- a failure inside the analytics client is
 * caught and logged ids-only (CLAUDE §6 "no console.log"/ids-only logs).
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly analytics: Analytics;

  constructor(config: AppConfigService) {
    this.analytics = createAnalytics({
      transport: createHttpTransport({
        apiKey: config.posthogApiKey,
        host: config.posthogHost,
        onError: (error) => {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn({ event: "analytics_transport_error", message });
        },
      }),
    });
  }

  capture<E extends AnalyticsEventName>(distinctId: string, event: E, properties: AnalyticsEventMap[E]): void {
    try {
      this.analytics.capture(distinctId, event, properties);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn({ event: "analytics_emit_failed", analyticsEvent: event, message });
    }
  }
}
