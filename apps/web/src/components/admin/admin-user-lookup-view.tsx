import type { AdminUserSummary } from "@bombaypetcompany/types";

import type { AdminFetchResult } from "../../admin/admin-api";
import { strings } from "../../strings";

/**
 * T111 step 20: a `<form method="get">` email lookup + the summary table.
 * `result === null` means no query has been submitted yet (the initial
 * page load) -- rendered as a calm prompt, never an error state. Renders
 * only ids/codes/counts (D4) -- never a pet name or intake/complaint text.
 */
export function AdminUserLookupView({
  result,
  email,
}: {
  result: AdminFetchResult<AdminUserSummary> | null;
  email: string | undefined;
}) {
  return (
    <section>
      <h2 className="text-lg font-medium">{strings.admin.users.heading}</h2>
      <form method="get" className="mt-2 flex gap-2">
        <label htmlFor="admin-user-email">{strings.admin.users.emailLabel}</label>
        <input id="admin-user-email" name="email" type="email" defaultValue={email ?? ""} />
        <button type="submit">{strings.admin.users.searchLabel}</button>
      </form>

      {renderResultBody(result)}
    </section>
  );
}

function renderResultBody(result: AdminFetchResult<AdminUserSummary> | null) {
  if (result === null) {
    return <p className="mt-4">{strings.admin.users.prompt}</p>;
  }
  if (result.kind === "unconfigured") {
    return <p className="mt-4">{strings.admin.users.unconfigured}</p>;
  }
  if (result.kind === "not-found") {
    return <p className="mt-4">{strings.admin.users.notFound}</p>;
  }
  if (result.kind === "error") {
    return <p className="mt-4">{strings.admin.users.error}</p>;
  }

  const { data } = result;

  return (
    <div className="mt-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt>{strings.admin.users.fields.userId}</dt>
        <dd>{data.userId}</dd>
        <dt>{strings.admin.users.fields.email}</dt>
        <dd>{data.email}</dd>
        <dt>{strings.admin.users.fields.createdAt}</dt>
        <dd>{data.createdAt}</dd>
        <dt>{strings.admin.users.fields.locale}</dt>
        <dd>{data.locale}</dd>
        <dt>{strings.admin.users.fields.region}</dt>
        <dd>{data.region}</dd>
        <dt>{strings.admin.users.fields.analyticsOptOut}</dt>
        <dd>{String(data.analyticsOptOut)}</dd>
        <dt>{strings.admin.users.fields.deletionScheduledAt}</dt>
        <dd>{data.deletionScheduledAt ?? "—"}</dd>
        <dt>{strings.admin.users.fields.householdIds}</dt>
        <dd>{data.householdIds.join(", ") || "—"}</dd>
      </dl>

      <h3 className="mt-4 text-base font-medium">{strings.admin.users.entitlementHeading}</h3>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt>{strings.admin.users.entitlementFields.entitled}</dt>
        <dd>{String(data.entitlement.entitled)}</dd>
        <dt>{strings.admin.users.entitlementFields.source}</dt>
        <dd>{data.entitlement.source}</dd>
      </dl>

      <h3 className="mt-4 text-base font-medium">{strings.admin.users.countersHeading}</h3>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt>{strings.admin.users.counterLabels.pets}</dt>
        <dd>{data.counters.pets}</dd>
        <dt>{strings.admin.users.counterLabels.symptomChecksTotal}</dt>
        <dd>{data.counters.symptomChecksTotal}</dd>
        <dt>{strings.admin.users.counterLabels.symptomChecksFallback}</dt>
        <dd>{data.counters.symptomChecksFallback}</dd>
        <dt>{strings.admin.users.counterLabels.chatThreads}</dt>
        <dd>{data.counters.chatThreads}</dd>
        <dt>{strings.admin.users.counterLabels.chatMessages}</dt>
        <dd>{data.counters.chatMessages}</dd>
        <dt>{strings.admin.users.counterLabels.reminders}</dt>
        <dd>{data.counters.reminders}</dd>
        <dt>{strings.admin.users.counterLabels.healthLogs}</dt>
        <dd>{data.counters.healthLogs}</dd>
        <dt>{strings.admin.users.counterLabels.devices}</dt>
        <dd>{data.counters.devices}</dd>
        <dt>{strings.admin.users.counterLabels.feedbackReports}</dt>
        <dd>{data.counters.feedbackReports}</dd>
        <dt>{strings.admin.users.counterLabels.accountExports}</dt>
        <dd>{data.counters.accountExports}</dd>
        <dt>{strings.admin.users.counterLabels.referralGrantsActive}</dt>
        <dd>{data.counters.referralGrantsActive}</dd>
      </dl>
    </div>
  );
}
