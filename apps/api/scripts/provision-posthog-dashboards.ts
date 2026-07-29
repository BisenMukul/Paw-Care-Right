/**
 * T103 step 6 -- ops-only tsx CLI: provisions/upserts the three PostHog
 * saved insights (see `packages/analytics/src/dashboards/posthog-insights.ts`)
 * plus a dashboard that groups them, via PostHog's REST API.
 *
 * Run via `pnpm --filter @bombaypetcompany/api ops:posthog:dashboards -- --dry-run`
 * (see apps/api/package.json + apps/api/scripts/tsconfig.json for why this
 * MUST run under `tsx --tsconfig scripts/tsconfig.json`, and why `pnpm build`
 * must run first). See docs/observability-dashboards.md for the full
 * runbook, prerequisites and founder steps.
 *
 * Ops-only env (never added to apps/api/src/config/env.schema.ts or any app
 * runtime schema -- CLAUDE §1a / plan D7):
 *   POSTHOG_PERSONAL_API_KEY  (required for a real run; unused by --dry-run)
 *   POSTHOG_PROJECT_ID        (required for a real run; unused by --dry-run)
 *   POSTHOG_API_HOST          (optional, default https://us.posthog.com --
 *                              the INSIGHT/DASHBOARD api host, NOT the
 *                              ingestion host POSTHOG_HOST/POSTHOG_API_KEY)
 *
 * Idempotent by NAME (plan D6): re-running never creates duplicates.
 */
import {
  ACTIVATION_INSIGHT_NAME,
  DASHBOARD_NAME,
  PAYWALL_INSIGHT_NAME,
  RETENTION_INSIGHT_NAME,
  buildActivationInsight,
  buildDashboardPayload,
  buildPaywallFunnelInsight,
  buildRetentionInsight,
  type InsightPayload,
} from "@bombaypetcompany/analytics";

const DEFAULT_API_HOST = "https://us.posthog.com";
const TRUNCATE_LEN = 500;

interface NamedInsight {
  name: string;
  payload: InsightPayload;
}

function namedInsights(): NamedInsight[] {
  return [
    { name: ACTIVATION_INSIGHT_NAME, payload: buildActivationInsight() },
    { name: PAYWALL_INSIGHT_NAME, payload: buildPaywallFunnelInsight() },
    { name: RETENTION_INSIGHT_NAME, payload: buildRetentionInsight() },
  ];
}

function isDryRun(argv: string[]): boolean {
  return argv.includes("--dry-run");
}

interface RequiredEnv {
  personalApiKey: string;
  projectId: string;
  apiHost: string;
}

function readRequiredEnv(): { ok: true; env: RequiredEnv } | { ok: false; missing: string[] } {
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY ?? "";
  const projectId = process.env.POSTHOG_PROJECT_ID ?? "";
  const apiHost =
    process.env.POSTHOG_API_HOST !== undefined && process.env.POSTHOG_API_HOST !== ""
      ? process.env.POSTHOG_API_HOST
      : DEFAULT_API_HOST;

  const missing: string[] = [];
  if (personalApiKey === "") {
    missing.push("POSTHOG_PERSONAL_API_KEY");
  }
  if (projectId === "") {
    missing.push("POSTHOG_PROJECT_ID");
  }

  if (missing.length > 0) {
    return { ok: false, missing };
  }
  return { ok: true, env: { personalApiKey, projectId, apiHost } };
}

async function failOnHttpError(res: Response, context: string): Promise<never> {
  const bodyText = await res.text();
  const truncated = bodyText.slice(0, TRUNCATE_LEN);
  /* eslint-disable no-console -- JUSTIFIED: ops CLI whose job is to print to stdout */
  console.error(`provision-posthog-dashboards: ${context} failed: ${res.status} ${truncated}`);
  /* eslint-enable no-console */
  return process.exit(3);
}

async function findExisting(
  baseUrl: string,
  resource: "dashboards" | "insights",
  name: string,
  headers: Record<string, string>,
): Promise<{ id: number } | undefined> {
  const res = await fetch(`${baseUrl}/${resource}/?search=${encodeURIComponent(name)}`, { headers });
  if (!res.ok) {
    await failOnHttpError(res, `GET ${resource}`);
  }
  const body = (await res.json()) as { results: { id: number; name: string }[] };
  return body.results.find((row) => row.name === name);
}

async function upsertDashboard(baseUrl: string, headers: Record<string, string>): Promise<number> {
  const payload = buildDashboardPayload();
  const existing = await findExisting(baseUrl, "dashboards", payload.name, headers);

  if (existing) {
    const res = await fetch(`${baseUrl}/dashboards/${existing.id}/`, {
      method: "PATCH",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      await failOnHttpError(res, "PATCH dashboard");
    }
    return existing.id;
  }

  const res = await fetch(`${baseUrl}/dashboards/`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await failOnHttpError(res, "POST dashboard");
  }
  const created = (await res.json()) as { id: number };
  return created.id;
}

async function upsertInsight(
  baseUrl: string,
  headers: Record<string, string>,
  insight: NamedInsight,
  dashboardId: number,
): Promise<void> {
  const existing = await findExisting(baseUrl, "insights", insight.name, headers);
  const body = { ...insight.payload, dashboards: [dashboardId] };

  if (existing) {
    const res = await fetch(`${baseUrl}/insights/${existing.id}/`, {
      method: "PATCH",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      await failOnHttpError(res, "PATCH insight");
    }
    return;
  }

  const res = await fetch(`${baseUrl}/insights/`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    await failOnHttpError(res, "POST insight");
  }
}

function printDryRun(insights: NamedInsight[]): void {
  const dashboardPayload = buildDashboardPayload();
  /* eslint-disable no-console -- JUSTIFIED: ops CLI whose job is to print to stdout */
  console.log("provision-posthog-dashboards --dry-run: no network calls made\n");
  console.log("dashboard payload:");
  console.log(JSON.stringify(dashboardPayload, null, 2));
  for (const insight of insights) {
    console.log(`\ninsight payload (${insight.name}):`);
    console.log(JSON.stringify(insight.payload, null, 2));
  }
  console.log("\ntarget: <POSTHOG_API_HOST>/api/projects/<POSTHOG_PROJECT_ID>/dashboards/ and .../insights/");
  /* eslint-enable no-console */
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const insights = namedInsights();

  if (isDryRun(argv)) {
    printDryRun(insights);
    return;
  }

  const envResult = readRequiredEnv();
  if (!envResult.ok) {
    /* eslint-disable no-console -- JUSTIFIED: ops CLI whose job is to print to stdout */
    console.error(`provision-posthog-dashboards: missing required env: ${envResult.missing.join(", ")}`);
    /* eslint-enable no-console */
    process.exit(2);
  }

  const { personalApiKey, projectId, apiHost } = envResult.env;
  const baseUrl = `${apiHost}/api/projects/${projectId}`;
  const headers = { authorization: `Bearer ${personalApiKey}` };

  const dashboardId = await upsertDashboard(baseUrl, headers);
  for (const insight of insights) {
    await upsertInsight(baseUrl, headers, insight, dashboardId);
  }

  /* eslint-disable no-console -- JUSTIFIED: ops CLI whose job is to print to stdout */
  console.log(`provision-posthog-dashboards: upserted dashboard "${DASHBOARD_NAME}" and ${insights.length} insights`);
  /* eslint-enable no-console */
}

main().catch((error: unknown) => {
  /* eslint-disable no-console -- JUSTIFIED: ops CLI whose job is to print to stdout */
  console.error("provision-posthog-dashboards: unexpected error", error);
  /* eslint-enable no-console */
  process.exit(1);
});
