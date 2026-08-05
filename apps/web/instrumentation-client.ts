// T089 — browser Sentry init (Next.js App Router `instrumentation-client.ts`
// convention: this file's top-level code runs once, on the client, before
// the app hydrates). Stub-safe by default (plan D5): an empty DSN means
// `webSentryOptions().enabled` is `false` and `Sentry.init` is skipped.
import * as Sentry from "@sentry/nextjs";

import { webSentryOptions } from "./src/observability/options";

type BrowserBeforeSend = NonNullable<Sentry.BrowserOptions["beforeSend"]>;
type BrowserBeforeBreadcrumb = NonNullable<Sentry.BrowserOptions["beforeBreadcrumb"]>;

const options = webSentryOptions();

if (options.enabled) {
  // Adapter casts at this single call site only (plan R1 / interfaces note)
  // — see `instrumentation.ts` for the identical rationale.
  const beforeSend: BrowserBeforeSend = (event) =>
    options.beforeSend(
      event as unknown as Parameters<typeof options.beforeSend>[0],
    ) as unknown as ReturnType<BrowserBeforeSend>;
  // T089 finding F1: closes the console/manual-breadcrumb free-text channel
  // that `beforeSend` alone cannot fully cover.
  const beforeBreadcrumb: BrowserBeforeBreadcrumb = (breadcrumb) =>
    options.beforeBreadcrumb(
      breadcrumb as unknown as Parameters<typeof options.beforeBreadcrumb>[0],
    ) as unknown as ReturnType<BrowserBeforeBreadcrumb>;

  Sentry.init({ ...options, beforeSend, beforeBreadcrumb });
}
