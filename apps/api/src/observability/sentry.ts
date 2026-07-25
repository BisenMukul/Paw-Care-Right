// T089 — Sentry init + capture helper for the API (plan D1/D5/D8).
//
// SAFETY (CLAUDE §7 / plan "Safety statement"): the shared `baseSentryOptions`
// factory (from `@pawcareright/analytics`) pins `beforeSend` to the shared
// scrubber and `sendDefaultPii: false` — no call site here may override
// either. Only 5xx / non-`HttpException` errors are ever reported (plan
// D8); the request object itself is never passed to Sentry, only the error
// and a `requestId` tag.
import { Logger } from "@nestjs/common";
import {
  baseSentryOptions,
  buildSentryRelease,
  type Breadcrumb,
  type SentryEventLike,
} from "@pawcareright/analytics";
import * as Sentry from "@sentry/node";

import type { AppConfigService } from "../config/app-config.service";

const logger = new Logger("Sentry");

type NodeBeforeSend = NonNullable<Sentry.NodeOptions["beforeSend"]>;
type NodeBeforeBreadcrumb = NonNullable<Sentry.NodeOptions["beforeBreadcrumb"]>;

/**
 * Stub-safe by default (plan D5, POSTHOG pattern): a blank `SENTRY_DSN`
 * means `baseSentryOptions(...).enabled` is `false` and `Sentry.init` is
 * never called — local dev, jest, and CI never hit the network and never
 * need a real DSN.
 */
export function initApiSentry(config: AppConfigService): void {
  const release = buildSentryRelease(config.appVersion, config.gitSha);
  const options = baseSentryOptions({
    dsn: config.sentryDsn,
    environment: config.sentryEnvironment,
    release,
  });

  if (!options.enabled) {
    return;
  }

  // Adapter casts at this single call site only (plan R1 / interfaces note):
  // the shared scrubber/breadcrumb-scrubber are typed against structural
  // types so `packages/analytics` never imports `@sentry/*` (zero new deps
  // there). The real SDK shapes are compatible; only `exactOptionalPropertyTypes`
  // disagrees about a couple of optional fields (e.g. `user.id: string |
  // number` vs. our `string`) — never `any`, never weakened in the shared
  // package.
  const beforeSend: NodeBeforeSend = (event) =>
    options.beforeSend(event as unknown as SentryEventLike) as unknown as Sentry.ErrorEvent | null;
  // T089 finding F1: `beforeBreadcrumb` closes the console/manual-breadcrumb
  // free-text channel that `beforeSend` alone cannot fully cover (see
  // `packages/analytics/src/sentry/scrub.ts`'s `scrubBreadcrumb`).
  const beforeBreadcrumb: NodeBeforeBreadcrumb = (breadcrumb) =>
    options.beforeBreadcrumb(breadcrumb as unknown as Breadcrumb) as unknown as Sentry.Breadcrumb | null;

  Sentry.init({ ...options, beforeSend, beforeBreadcrumb });
}

/**
 * Reports `error` to Sentry tagged with `requestId` ONLY — never the raw
 * request/response objects (plan D8: intake text/chat content live in the
 * request body, which never reaches this call site in the first place).
 * Fails closed: any SDK failure is caught here so a Sentry outage can never
 * break the caller (the `AllExceptionsFilter`'s response envelope).
 */
export function captureApiException(error: unknown, requestId: string): void {
  try {
    if (!Sentry.isInitialized()) {
      return;
    }
    Sentry.withScope((scope) => {
      scope.setTag("requestId", requestId);
      Sentry.captureException(error);
    });
  } catch (captureError) {
    logger.warn(`Sentry capture failed: ${String(captureError)}`);
  }
}
