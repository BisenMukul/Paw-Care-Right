// T089 — shared Sentry release naming + init-options factory (plan D1/D2/D5).
//
// Zero new deps: this module has no `@sentry/*` import, only the structural
// `SentryEventLike` type from `./scrub`. Each app (api/web/mobile) spreads
// `baseSentryOptions(...)` into its own SDK's `init(...)` call.
import { scrubBreadcrumb, scrubSentryEvent, type Breadcrumb, type SentryEventLike } from "./scrub";

const DEFAULT_VERSION = "0.0.0";
const DEFAULT_BUILD_ID = "dev";

/**
 * `pawcareright@{version}+{buildId}` — the release-identity SHAPE pinned by
 * CLAUDE.md §1a and OTA_UPDATES §7 (never invent a new scheme). Empty/blank
 * inputs fall back to `"0.0.0"`/`"dev"` (plan D2/D6) so a missing env var
 * never produces a malformed release string.
 */
export function buildSentryRelease(version: string, buildId: string): string {
  const safeVersion = version.trim() !== "" ? version : DEFAULT_VERSION;
  const safeBuildId = buildId.trim() !== "" ? buildId : DEFAULT_BUILD_ID;
  return `pawcareright@${safeVersion}+${safeBuildId}`;
}

export interface BaseSentryOptions {
  dsn: string;
  environment: string;
  release: string;
  enabled: boolean;
  sendDefaultPii: false;
  tracesSampleRate: 0;
  beforeSend: (event: SentryEventLike) => SentryEventLike | null;
  beforeBreadcrumb: (breadcrumb: Breadcrumb) => Breadcrumb | null;
}

/**
 * Stub-safe by default (plan D5, POSTHOG pattern): `enabled` is `false` when
 * `dsn` is empty, so local dev/jest/CI never hit the network and never need
 * a real DSN. `sendDefaultPii` is pinned `false`, `beforeSend` is always the
 * shared scrubber, and `beforeBreadcrumb` is always the shared breadcrumb
 * scrub (T089 finding F1 — closes the console/manual-breadcrumb free-text
 * channel that `beforeSend` alone cannot fully cover) — no call site may
 * override any of these (plan D3/D1). Errors only: `tracesSampleRate: 0`
 * (no perf tracing on this card).
 */
export function baseSentryOptions(input: {
  dsn: string;
  environment: string;
  release: string;
}): BaseSentryOptions {
  return {
    dsn: input.dsn,
    environment: input.environment,
    release: input.release,
    enabled: input.dsn !== "",
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: scrubSentryEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  };
}
