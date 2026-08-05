import type { AdminKpisResponse } from "@bombaypetcompany/types";

import type { AdminFetchResult } from "../../admin/admin-api";
import { strings } from "../../strings";

const EM_DASH = "—";

function formatFallbackRate(rate: number | null): string {
  return rate === null ? EM_DASH : `${Math.round(rate * 100)}%`;
}

/**
 * T111 step 20: the KPI table + the MRR-events limitation note + the
 * installs-proxy caveat (both from `strings`, never invented inline).
 * `fallbackRate: null` renders the em-dash placeholder, never a fake "0%"
 * (`render.spec.tsx` pins this).
 */
export function AdminKpisView({ result }: { result: AdminFetchResult<AdminKpisResponse> }) {
  if (result.kind === "unconfigured") {
    return <p>{strings.admin.kpis.unconfigured}</p>;
  }
  if (result.kind === "error" || result.kind === "not-found") {
    return <p>{strings.admin.kpis.error}</p>;
  }

  const { data } = result;

  return (
    <section>
      <h2 className="text-lg font-medium">{strings.admin.kpis.heading}</h2>
      <p className="mt-1 text-sm text-gray-600">{strings.admin.kpis.mrrEventsNote}</p>
      <p className="mt-1 text-sm text-gray-600">{strings.admin.kpis.installsProxyNote}</p>

      {data.daily.length === 0 ? (
        <p className="mt-4">{strings.admin.kpis.empty}</p>
      ) : (
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr>
              <th>{strings.admin.kpis.columns.day}</th>
              <th>{strings.admin.kpis.columns.devicesCreated}</th>
              <th>{strings.admin.kpis.columns.checksCreated}</th>
              <th>{strings.admin.kpis.columns.checksDone}</th>
              <th>{strings.admin.kpis.columns.checksFallback}</th>
              <th>{strings.admin.kpis.columns.fallbackRate}</th>
              <th>{strings.admin.kpis.columns.billingEventsProcessed}</th>
              <th>{strings.admin.kpis.columns.subscriptionsUpdated}</th>
            </tr>
          </thead>
          <tbody>
            {data.daily.map((day) => (
              <tr key={day.day}>
                <td>{day.day}</td>
                <td>{day.devicesCreated}</td>
                <td>{day.checksCreated}</td>
                <td>{day.checksDone}</td>
                <td>{day.checksFallback}</td>
                <td>{formatFallbackRate(day.fallbackRate)}</td>
                <td>{day.billingEventsProcessed}</td>
                <td>{day.subscriptionsUpdated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="mt-6 text-base font-medium">{strings.admin.kpis.tiersHeading}</h3>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt>{strings.admin.kpis.tierLabels.totalUsers}</dt>
        <dd>{data.tiers.totalUsers}</dd>
        <dt>{strings.admin.kpis.tierLabels.premiumSubscriptions}</dt>
        <dd>{data.tiers.premiumSubscriptions}</dd>
        <dt>{strings.admin.kpis.tierLabels.expiredOrInactiveSubscriptions}</dt>
        <dd>{data.tiers.expiredOrInactiveSubscriptions}</dd>
        <dt>{strings.admin.kpis.tierLabels.activeReferralGrants}</dt>
        <dd>{data.tiers.activeReferralGrants}</dd>
      </dl>
    </section>
  );
}
