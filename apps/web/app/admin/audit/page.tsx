import type { Metadata } from "next";

import { fetchAdminAudit } from "../../../src/admin/admin-api";
import { AdminShell } from "../../../src/components/admin/admin-shell";
import { AdminAuditView } from "../../../src/components/admin/admin-audit-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminAudit(cursor === undefined ? {} : { cursor });

  return (
    <AdminShell>
      <AdminAuditView result={result} />
    </AdminShell>
  );
}
