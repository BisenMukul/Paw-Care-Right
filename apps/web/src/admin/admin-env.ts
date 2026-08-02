/**
 * T111 D1/D2: pure env parsers for the `/admin` mini-dashboard. Callers pass
 * `process.env` explicitly (never read here directly) so these stay
 * trivially jest-testable with no module-load side effects. Neither
 * function ever reads a client-exposed (Next.js public-prefixed) env-var
 * name -- both the basic-auth password and the admin API token must never
 * be inlinable into client JS (`src/admin/readonly.spec.ts` proves this).
 *
 * Fail-closed (D1): a missing/empty/whitespace-only password, or an
 * allowlist that parses to zero entries, returns `null` ("closed") from
 * `parseAdminAuthConfig` -- every `/admin*` request is then 401 regardless
 * of what the caller sends. Same posture for `parseAdminApiConfig`: an
 * empty/missing `ADMIN_API_TOKEN` returns `null` (mirrors the T117
 * `AdminTokenGuard`'s empty-token fail-closed default on the API side).
 */

export interface AdminAuthConfig {
  readonly allowedEmails: readonly string[];
  readonly password: string;
}

export interface AdminApiConfig {
  readonly baseUrl: string;
  readonly adminToken: string;
}

const DEFAULT_ADMIN_API_BASE_URL = "http://localhost:3000";

type EnvSource = Record<string, string | undefined>;

export function parseAdminAuthConfig(env: EnvSource): AdminAuthConfig | null {
  const password = env.ADMIN_DASHBOARD_PASSWORD;
  if (password === undefined || password.trim() === "") {
    return null;
  }

  const allowedEmailsRaw = env.ADMIN_ALLOWED_EMAILS;
  if (allowedEmailsRaw === undefined) {
    return null;
  }

  const allowedEmails = allowedEmailsRaw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);

  if (allowedEmails.length === 0) {
    return null;
  }

  return { allowedEmails, password };
}

export function parseAdminApiConfig(env: EnvSource): AdminApiConfig | null {
  const adminToken = env.ADMIN_API_TOKEN;
  if (adminToken === undefined || adminToken.trim() === "") {
    return null;
  }

  const baseUrlRaw = env.ADMIN_API_BASE_URL;
  const baseUrl = baseUrlRaw === undefined || baseUrlRaw.trim() === "" ? DEFAULT_ADMIN_API_BASE_URL : baseUrlRaw;

  return { baseUrl, adminToken };
}
