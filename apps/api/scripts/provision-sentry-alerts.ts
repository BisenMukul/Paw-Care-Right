/**
 * T103 step 7 -- ops-only tsx CLI: upserts the Sentry crash-free session
 * rate < 99% (warn) metric alert rule (see
 * `packages/analytics/src/dashboards/sentry-alerts.ts`) via Sentry's
 * organization alert-rules REST API.
 *
 * Run via `pnpm --filter @bombaypetcompany/api ops:sentry:alerts -- --dry-run`
 * (see apps/api/package.json + apps/api/scripts/tsconfig.json for why this
 * MUST run under `tsx --tsconfig scripts/tsconfig.json`, and why `pnpm build`
 * must run first). See docs/observability-dashboards.md for the full
 * runbook, prerequisites and founder steps.
 *
 * Ops-only env (never added to apps/api/src/config/env.schema.ts or any app
 * runtime schema -- CLAUDE §1a / plan D7):
 *   SENTRY_AUTH_TOKEN   (required for a real run; unused by --dry-run)
 *   SENTRY_ORG          (default "bombaypetcompany")
 *   SENTRY_PROJECT      (required for a real run; unused by --dry-run)
 *   SENTRY_ENVIRONMENT  (required for a real run; unused by --dry-run)
 *   SENTRY_API_HOST     (optional, default https://sentry.io)
 *
 * The rule ships with an EMPTY action list by design (plan D9): attaching a
 * notification target (email/Slack) is a one-time manual UI step, documented
 * as `[FOUNDER-4]`.
 *
 * Idempotent by NAME (plan D6): re-running never creates a duplicate rule.
 */
import { CRASH_FREE_ALERT_NAME, buildCrashFreeAlertRule, type CrashFreeAlertRulePayload } from "@bombaypetcompany/analytics";

const DEFAULT_API_HOST = "https://sentry.io";
const DEFAULT_ORG = "bombaypetcompany";
const TRUNCATE_LEN = 500;

function isDryRun(argv: string[]): boolean {
  return argv.includes("--dry-run");
}

interface RequiredEnv {
  authToken: string;
  org: string;
  project: string;
  environment: string;
  apiHost: string;
}

function readRequiredEnv(): { ok: true; env: RequiredEnv } | { ok: false; missing: string[] } {
  const authToken = process.env.SENTRY_AUTH_TOKEN ?? "";
  const org =
    process.env.SENTRY_ORG !== undefined && process.env.SENTRY_ORG !== "" ? process.env.SENTRY_ORG : DEFAULT_ORG;
  const project = process.env.SENTRY_PROJECT ?? "";
  const environment = process.env.SENTRY_ENVIRONMENT ?? "";
  const apiHost =
    process.env.SENTRY_API_HOST !== undefined && process.env.SENTRY_API_HOST !== ""
      ? process.env.SENTRY_API_HOST
      : DEFAULT_API_HOST;

  const missing: string[] = [];
  if (authToken === "") {
    missing.push("SENTRY_AUTH_TOKEN");
  }
  if (project === "") {
    missing.push("SENTRY_PROJECT");
  }
  if (environment === "") {
    missing.push("SENTRY_ENVIRONMENT");
  }

  if (missing.length > 0) {
    return { ok: false, missing };
  }
  return { ok: true, env: { authToken, org, project, environment, apiHost } };
}

async function failOnHttpError(res: Response, context: string): Promise<never> {
  const bodyText = await res.text();
  const truncated = bodyText.slice(0, TRUNCATE_LEN);
  /* eslint-disable no-console -- JUSTIFIED: ops CLI whose job is to print to stdout */
  console.error(`provision-sentry-alerts: ${context} failed: ${res.status} ${truncated}`);
  /* eslint-enable no-console */
  return process.exit(3);
}

async function findExistingRule(
  baseUrl: string,
  name: string,
  headers: Record<string, string>,
): Promise<{ id: string } | undefined> {
  const res = await fetch(`${baseUrl}/alert-rules/`, { headers });
  if (!res.ok) {
    await failOnHttpError(res, "GET alert-rules");
  }
  const body = (await res.json()) as { id: string; name: string }[];
  return body.find((rule) => rule.name === name);
}

async function upsertAlertRule(
  baseUrl: string,
  headers: Record<string, string>,
  payload: CrashFreeAlertRulePayload,
): Promise<void> {
  const existing = await findExistingRule(baseUrl, payload.name, headers);

  if (existing) {
    const res = await fetch(`${baseUrl}/alert-rules/${existing.id}/`, {
      method: "PUT",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      await failOnHttpError(res, "PUT alert-rules");
    }
    return;
  }

  const res = await fetch(`${baseUrl}/alert-rules/`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await failOnHttpError(res, "POST alert-rules");
  }
}

function printDryRun(): void {
  const projectSlug =
    process.env.SENTRY_PROJECT !== undefined && process.env.SENTRY_PROJECT !== ""
      ? process.env.SENTRY_PROJECT
      : "<SENTRY_PROJECT>";
  const environment =
    process.env.SENTRY_ENVIRONMENT !== undefined && process.env.SENTRY_ENVIRONMENT !== ""
      ? process.env.SENTRY_ENVIRONMENT
      : "<SENTRY_ENVIRONMENT>";
  const payload = buildCrashFreeAlertRule({ projectSlug, environment });
  /* eslint-disable no-console -- JUSTIFIED: ops CLI whose job is to print to stdout */
  console.log("provision-sentry-alerts --dry-run: no network calls made\n");
  console.log("alert rule payload:");
  console.log(JSON.stringify(payload, null, 2));
  console.log("\ntarget: <SENTRY_API_HOST>/api/0/organizations/<SENTRY_ORG>/alert-rules/");
  /* eslint-enable no-console */
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (isDryRun(argv)) {
    printDryRun();
    return;
  }

  const envResult = readRequiredEnv();
  if (!envResult.ok) {
    /* eslint-disable no-console -- JUSTIFIED: ops CLI whose job is to print to stdout */
    console.error(`provision-sentry-alerts: missing required env: ${envResult.missing.join(", ")}`);
    /* eslint-enable no-console */
    process.exit(2);
  }

  const { authToken, org, project, environment, apiHost } = envResult.env;
  const baseUrl = `${apiHost}/api/0/organizations/${org}`;
  const headers = { authorization: `Bearer ${authToken}` };
  const payload = buildCrashFreeAlertRule({ projectSlug: project, environment });

  await upsertAlertRule(baseUrl, headers, payload);

  /* eslint-disable no-console -- JUSTIFIED: ops CLI whose job is to print to stdout */
  console.log(`provision-sentry-alerts: upserted alert rule "${CRASH_FREE_ALERT_NAME}"`);
  /* eslint-enable no-console */
}

main().catch((error: unknown) => {
  /* eslint-disable no-console -- JUSTIFIED: ops CLI whose job is to print to stdout */
  console.error("provision-sentry-alerts: unexpected error", error);
  /* eslint-enable no-console */
  process.exit(1);
});
