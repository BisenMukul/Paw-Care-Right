import type { ReactNode } from "react";

import { strings } from "../../strings";
import { ADMIN_ROUTES } from "../../admin/admin-routes";

/**
 * T111 step 20: the shared shell every `/admin*` page renders inside.
 * A server component (no client-component directive); renders no shared
 * disclaimer component (this surface shows no §5 AI-result content -- see
 * `disclaimer-placement.spec.tsx`'s amended carve-out and
 * `render.spec.tsx`'s "no view renders the disclaimer" pin).
 */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{strings.admin.shell.heading}</h1>
      <p role="note" className="mt-1 text-sm text-gray-600">
        {strings.admin.shell.note}
      </p>
      <nav className="mt-4 flex gap-4">
        <a href={ADMIN_ROUTES.kpis}>{strings.admin.shell.navKpis}</a>
        <a href={ADMIN_ROUTES.users}>{strings.admin.shell.navUsers}</a>
        <a href={ADMIN_ROUTES.audit}>{strings.admin.shell.navAudit}</a>
      </nav>
      <div className="mt-6">{children}</div>
    </main>
  );
}
