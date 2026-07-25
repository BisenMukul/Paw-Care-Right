// T089 — web (Next.js) Sentry init-options factory. Reads env, defers all
// scrubbing/release/enablement policy to the shared factory (plan D1/D5/D6).
import { baseSentryOptions, buildSentryRelease, type BaseSentryOptions } from "@pawcareright/analytics";

/**
 * Stub-safe by default (plan D5): an empty DSN means `enabled: false` and no
 * call site inits the SDK — local dev, jest, and CI never hit the network.
 * `NEXT_PUBLIC_*` variants are read for the browser bundle; the server-only
 * fallbacks let a deploy set a server-only DSN/version without exposing it
 * to the client bundle if desired (both default the same way otherwise).
 */
export function webSentryOptions(): BaseSentryOptions {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? "";
  const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development";
  const gitSha = process.env.NEXT_PUBLIC_GIT_SHA ?? "dev";
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";

  return baseSentryOptions({
    dsn,
    environment,
    release: buildSentryRelease(version, gitSha),
  });
}
