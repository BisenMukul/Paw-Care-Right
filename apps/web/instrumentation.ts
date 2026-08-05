// T089 — server/edge Sentry init (Next.js App Router `instrumentation.ts`
// convention). Stub-safe by default (plan D5): `webSentryOptions()` is
// `enabled: false` on an empty DSN, so `register()` never calls
// `Sentry.init` locally, in jest, or in CI without a real DSN.
import * as Sentry from "@sentry/nextjs";

import { webSentryOptions } from "./src/observability/options";

type NodeBeforeSend = NonNullable<Sentry.NodeOptions["beforeSend"]>;
type NodeBeforeBreadcrumb = NonNullable<Sentry.NodeOptions["beforeBreadcrumb"]>;

export async function register(): Promise<void> {
  const options = webSentryOptions();

  if (!options.enabled) {
    return;
  }

  // Adapter casts at this single call site only (plan R1 / interfaces note):
  // the shared scrubber/breadcrumb-scrubber are typed against structural
  // types so `packages/analytics` stays free of any `@sentry/*` import.
  const beforeSend: NodeBeforeSend = (event) =>
    options.beforeSend(event as unknown as Parameters<typeof options.beforeSend>[0]) as unknown as ReturnType<
      NodeBeforeSend
    >;
  // T089 finding F1: closes the console/manual-breadcrumb free-text channel
  // that `beforeSend` alone cannot fully cover.
  const beforeBreadcrumb: NodeBeforeBreadcrumb = (breadcrumb) =>
    options.beforeBreadcrumb(
      breadcrumb as unknown as Parameters<typeof options.beforeBreadcrumb>[0],
    ) as unknown as ReturnType<NodeBeforeBreadcrumb>;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({ ...options, beforeSend, beforeBreadcrumb });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({ ...options, beforeSend, beforeBreadcrumb });
  }
}

export const onRequestError = Sentry.captureRequestError;
