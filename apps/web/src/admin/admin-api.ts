import {
  adminAuditPageSchema,
  adminKpisResponseSchema,
  adminUserSummarySchema,
  type AdminAuditPage,
  type AdminKpisResponse,
  type AdminUserSummary,
} from "@bombaypetcompany/types";

import { parseAdminApiConfig } from "./admin-env";

/**
 * A structural (not nominal) subset of a Zod schema's `safeParse` -- avoids
 * importing `zod` directly in this workspace (it is a transitive dependency
 * via `@bombaypetcompany/types`, not a direct one here); every real
 * `adminXSchema` from `@bombaypetcompany/types` satisfies this shape.
 */
interface SafeParser<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false };
}

/**
 * T111 D2: server-side-only fetchers (never called from a client
 * component -- every admin page/view here is a server component, and
 * `src/admin/readonly.spec.ts` proves no admin file carries a client-
 * component directive). `cache: "no-store"` + a caller-supplied
 * `x-admin-token` header; GET only.
 * Never throws a stack into the page -- every outcome, including a network
 * failure, an unreachable API, or a schema-invalid body, resolves to a
 * typed `AdminFetchResult` the view can render a calm state for.
 */
export type AdminFetchResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "not-found" }
  | { kind: "unconfigured" }
  | { kind: "error"; code: string };

async function adminFetch<T>(path: string, schema: SafeParser<T>): Promise<AdminFetchResult<T>> {
  const config = parseAdminApiConfig(process.env);
  if (config === null) {
    return { kind: "unconfigured" };
  }

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method: "GET",
      cache: "no-store",
      headers: { "x-admin-token": config.adminToken },
    });
  } catch {
    return { kind: "error", code: "NETWORK_ERROR" };
  }

  if (response.status === 404) {
    return { kind: "not-found" };
  }
  if (!response.ok) {
    return { kind: "error", code: String(response.status) };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: "error", code: "INVALID_JSON" };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { kind: "error", code: "INVALID_SCHEMA" };
  }

  return { kind: "ok", data: parsed.data };
}

export function fetchAdminKpis(days?: number): Promise<AdminFetchResult<AdminKpisResponse>> {
  const query = days === undefined ? "" : `?days=${encodeURIComponent(String(days))}`;
  return adminFetch(`/v1/admin/kpis${query}`, adminKpisResponseSchema);
}

export function fetchAdminUser(email: string): Promise<AdminFetchResult<AdminUserSummary>> {
  return adminFetch(`/v1/admin/users/lookup?email=${encodeURIComponent(email)}`, adminUserSummarySchema);
}

export function fetchAdminAudit(params: {
  limit?: number;
  cursor?: string;
}): Promise<AdminFetchResult<AdminAuditPage>> {
  const searchParams = new URLSearchParams();
  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.cursor !== undefined) {
    searchParams.set("cursor", params.cursor);
  }
  const queryString = searchParams.toString();
  return adminFetch(`/v1/admin/ai-audit${queryString ? `?${queryString}` : ""}`, adminAuditPageSchema);
}
