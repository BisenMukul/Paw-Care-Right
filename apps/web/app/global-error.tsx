"use client";

// T089 — App Router global error boundary. Reports the crash to Sentry (via
// the shared, scrubbed pipeline) and renders a minimal, generic fallback.
// This boundary replaces the root layout on a root-level error, so it must
// render its own <html>/<body> (Next.js App Router convention).
//
// T089 finding F6: inline `style={{...}}` is used deliberately here, not
// Tailwind classes — this component can render when the root layout (and
// its `globals.css` import) never mounted, so Tailwind's stylesheet is not
// guaranteed to be present; the fallback must be legible unstyled-CSS-safe.
// Untested by design too: jest's `roots` is `<rootDir>/src` (this repo's
// established test-organization convention, CLAUDE §6), so nothing under
// `app/` is unit-covered — this file's only logic is the `useEffect`
// capture call, which is exercised end to end by the real-SDK specs in
// `apps/api/src/observability/sentry.spec.ts` and this app's own
// `src/observability/options.spec.ts`.
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

import { strings } from "../src/strings";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h1>{strings.globalError.heading}</h1>
          <p>{strings.globalError.body}</p>
          <button type="button" onClick={() => reset()}>
            {strings.globalError.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
