import type { Metadata } from "next";

import { fetchAdminUser } from "../../../src/admin/admin-api";
import { AdminShell } from "../../../src/components/admin/admin-shell";
import { AdminUserLookupView } from "../../../src/components/admin/admin-user-lookup-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const result = email === undefined || email === "" ? null : await fetchAdminUser(email);

  return (
    <AdminShell>
      <AdminUserLookupView result={result} email={email} />
    </AdminShell>
  );
}
