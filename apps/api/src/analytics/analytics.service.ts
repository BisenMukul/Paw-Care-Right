import { Injectable, Logger } from "@nestjs/common";
import { createAnalytics, createHttpTransport, type Analytics, type AnalyticsEventMap, type AnalyticsEventName } from "@pawcareright/analytics";

import { AppConfigService } from "../config/app-config.service";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Server-side PostHog emitter (T078 plan, consent-gated per T091 plan D5).
 * The underlying transport is stub-safe (an empty `POSTHOG_API_KEY` makes it
 * a no-op, so tests/CI never hit the network). `capture` never throws -- a
 * failure inside the analytics client is caught and logged ids-only (CLAUDE
 * §6 "no console.log"/ids-only logs).
 *
 * `captureForUser` (T091 plan step 9) is the server-side half of the
 * analytics opt-out: it reads `User.analyticsOptOut` before delegating to
 * `capture`, and FAILS CLOSED (never emits) both when the user row is
 * missing and when the consent read itself throws -- an unknown consent
 * state must never emit (plan risk R8).
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly analytics: Analytics;

  constructor(
    config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {
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

  async captureForUser<E extends AnalyticsEventName>(
    userId: string,
    event: E,
    properties: AnalyticsEventMap[E],
  ): Promise<void> {
    let optedOut: boolean;

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { analyticsOptOut: true },
      });

      if (user === null) {
        // Unknown user -- fail closed, never emit.
        return;
      }
      optedOut = user.analyticsOptOut;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn({ event: "analytics_consent_read_failed", message });
      // Fail closed -- an unresolvable consent state must never emit.
      return;
    }

    if (optedOut) {
      return;
    }

    this.capture(userId, event, properties);
  }
}
