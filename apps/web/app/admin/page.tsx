import type { Metadata } from "next";

import { fetchAdminKpis } from "../../src/admin/admin-api";
import { AdminShell } from "../../src/components/admin/admin-shell";
import { AdminKpisView } from "../../src/components/admin/admin-kpis-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminKpisPage() {
  const result = await fetchAdminKpis();
  return (
    <AdminShell>
      <AdminKpisView result={result} />
    </AdminShell>
  );
}
