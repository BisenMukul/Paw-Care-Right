import type { AdminAuditPage } from "@bombaypetcompany/types";

import type { AdminFetchResult } from "../../admin/admin-api";
import { ADMIN_ROUTES } from "../../admin/admin-routes";
import { strings } from "../../strings";

const EM_DASH = "—";

/**
 * T111 step 20: the audit row table (exactly the 11 pinned `AiAuditLog`
 * columns -- ids, enum codes, versions and counts only, never content) +
 * a "Next page" cursor link + a "Newest" back-link.
 */
export function AdminAuditView({ result }: { result: AdminFetchResult<AdminAuditPage> }) {
  if (result.kind === "unconfigured") {
    return <p>{strings.admin.audit.unconfigured}</p>;
  }
  if (result.kind === "error" || result.kind === "not-found") {
    return <p>{strings.admin.audit.error}</p>;
  }

  const { data } = result;

  return (
    <section>
      <h2 className="text-lg font-medium">{strings.admin.audit.heading}</h2>

      {data.rows.length === 0 ? (
        <p className="mt-4">{strings.admin.audit.empty}</p>
      ) : (
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr>
              <th>{strings.admin.audit.columns.id}</th>
              <th>{strings.admin.audit.columns.surface}</th>
              <th>{strings.admin.audit.columns.checkId}</th>
              <th>{strings.admin.audit.columns.threadId}</th>
              <th>{strings.admin.audit.columns.promptVersion}</th>
              <th>{strings.admin.audit.columns.modelId}</th>
              <th>{strings.admin.audit.columns.detectorFlags}</th>
              <th>{strings.admin.audit.columns.costMicroUsd}</th>
              <th>{strings.admin.audit.columns.latencyMs}</th>
              <th>{strings.admin.audit.columns.status}</th>
              <th>{strings.admin.audit.columns.createdAt}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.surface}</td>
                <td>{row.checkId ?? EM_DASH}</td>
                <td>{row.threadId ?? EM_DASH}</td>
                <td>{row.promptVersion}</td>
                <td>{row.modelId}</td>
                <td>{row.detectorFlags.join(", ")}</td>
                <td>{row.costMicroUsd}</td>
                <td>{row.latencyMs ?? EM_DASH}</td>
                <td>{row.status}</td>
                <td>{row.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <nav className="mt-4 flex gap-4">
        <a href={ADMIN_ROUTES.audit}>{strings.admin.audit.newestLabel}</a>
        {data.nextCursor !== null && (
          <a href={`${ADMIN_ROUTES.audit}?cursor=${encodeURIComponent(data.nextCursor)}`}>
            {strings.admin.audit.nextPageLabel}
          </a>
        )}
      </nav>
    </section>
  );
}
