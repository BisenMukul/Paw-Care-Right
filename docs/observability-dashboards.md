# Observability dashboards & alerts (T103)

PostHog activation/paywall/retention saved insights + dashboard, and a
Sentry crash-free session rate alert rule, provisioned by two idempotent
tsx CLIs in `apps/api/scripts/`. The pure payload builders they call live in
`packages/analytics/src/dashboards/` (`posthog-insights.ts`,
`sentry-alerts.ts`) and are unit-tested there; this doc is the manual-steps
runbook the task card asks for.

## 1. Scope

**Automated by this task** (committed, tested, runnable without any live
project):
- The three PostHog insight payloads + one dashboard payload
  (`packages/analytics/src/dashboards/posthog-insights.ts`).
- The Sentry crash-free `<99%` warn alert-rule payload
  (`packages/analytics/src/dashboards/sentry-alerts.ts`).
- Two `tsx` CLIs that upsert those payloads against a real PostHog/Sentry
  project by name (`apps/api/scripts/provision-posthog-dashboards.ts`,
  `apps/api/scripts/provision-sentry-alerts.ts`).

**Not automated — `[FOUNDER]`** (no PostHog/Sentry project, personal API key
or auth token exists in this build environment):
- Creating the staging PostHog project + personal API key.
- Creating the Sentry org/project + auth token.
- Running the two CLIs for real against staging.
- Attaching a Sentry notification action (email/Slack) to the created rule.
- Emitting staging events, confirming they land in the funnel, and
  screenshotting it for the T103 journal entry (§7).

## 2. Tracked events

The entire tracked surface is `packages/analytics/src/events.ts`'s
`AnalyticsEventMap` — exactly three events, no autocapture (no PostHog SDK,
see `packages/analytics/src/http-transport.ts`, so there is no `$pageview`
or `$screen` either):

| Event | Properties | Emitted from |
|---|---|---|
| `first_check_completed` | `checkId`, `householdId`, `status: "DONE"\|"FALLBACK"`, `urgency` | `apps/api/src/workers/check-runner.processor.ts` |
| `paywall_view` | `source: "onboarding"\|"settings"`, `householdId?` | `apps/mobile/app/paywall.tsx` |
| `trial_start` | `householdId`, `plan: string \| null` | `apps/api/src/billing/rc-webhook.service.ts` |

## 3. Known gaps (G1-G3) and the follow-up card

<!-- BEGIN:gaps -->
PRODUCT_SPEC §8 ("PostHog events locked at T078") describes an activation
funnel, a 3-step conversion funnel and D1/D7/D30 app-open retention. None of
those match the three events above exactly, so the insights below are
deliberate, documented approximations — never invented event names:

| Gap | What the card implies | What ships instead |
|---|---|---|
| **G1** | An activation entry event (`signup_completed` / `pet_created` / install) | No such event is tracked; the activation insight is a **trends** insight over `first_check_completed` (unique users, broken down by `status`), not an entry→activation funnel. |
| **G2** | A 3rd conversion step, `trial_to_paid` (SPEC §8 target ≥45%) | Not tracked (`rc-webhook.service.ts` emits only `trial_start`); the paywall funnel ships as the real 2-step `paywall_view → trial_start` (SPEC §8 target ≥8%). |
| **G3** | `app_open`-based D1/D7/D30 retention | No `app_open` event is tracked; the retention cohort uses `first_check_completed` as **both** the target and the returning event — a proxy for engagement, not app-open retention. |

Closing these gaps means adding `signup_completed`/`pet_created`/`app_open`/
`trial_to_paid` events, which touches the auth/pets/billing services, the
mobile app, the T091 consent path, and the T092 store-privacy Appendix A
drift guard — a different, larger card than T103 (CLAUDE §2 rule 2: follow
the task card, no scope creep). A dedicated follow-up tracking card should be
scheduled before the beta metrics review (`[FOUNDER-6]`) to close G1-G3.
<!-- END:gaps -->

## 4. PostHog: prerequisites and provisioning

**Prerequisites**
1. A PostHog project (staging, then production) and a personal API key with
   scopes `project:read`, `insight:write`, `dashboard:write` (`[FOUNDER-1]`).
2. `pnpm build` from the repo root — the CLI loads
   `packages/analytics/dist/index.cjs`, which must exist before `tsx` runs
   (see `apps/api/scripts/tsconfig.json`'s header comment).

**Ops-only env** (local shell only — never committed, never in `eas.json`,
never added to `apps/api/src/config/env.schema.ts` or any other app runtime
env schema):

<!-- BEGIN:posthog-env -->
| Var | Required for a real run? | Default |
|---|---|---|
| `POSTHOG_PERSONAL_API_KEY` | yes | — |
| `POSTHOG_PROJECT_ID` | yes | — |
| `POSTHOG_API_HOST` | no | `https://us.posthog.com` (the insight/dashboard API host — **not** the ingestion host `POSTHOG_HOST`/`POSTHOG_API_KEY`) |
<!-- END:posthog-env -->

**Commands**
```
pnpm build
pnpm --filter @bombaypetcompany/api ops:posthog:dashboards -- --dry-run   # prints payloads, exit 0, no env required
pnpm --filter @bombaypetcompany/api ops:posthog:dashboards                # applies against the real project
```

## 5. PostHog: the three insights

All four names below are the exact upsert keys (`packages/analytics/src/dashboards/posthog-insights.ts`):
dashboard **`Bombay Pet Company — Activation & Retention`**, containing:

| Insight | Kind | Events / steps | Target metric (PRODUCT_SPEC §8) |
|---|---|---|---|
| `Activation: first_check_completed (trend)` | Trends (unique users, broken down by `status`, trailing 30 days) | `first_check_completed` | Proxy for activation (gap G1) |
| `Paywall funnel: paywall_view -> trial_start` | Funnel (ordered) | `paywall_view` → `trial_start` | Conversion ≥8% (gap G2: stops before `trial_to_paid`, target ≥45%) |
| `Retention: first_check_completed (weekly)` | Retention (weekly, 8 periods) | target = returning = `first_check_completed` | Proxy for D1/D7/D30 app-open retention (gap G3) |

## 6. Sentry: crash-free session rate `<99%` warn rule

`packages/analytics/src/dashboards/sentry-alerts.ts`'s
`buildCrashFreeAlertRule` produces a metric alert rule named
**`Crash-free session rate < 99% (warn)`**:
- `dataset: "metrics"`, `aggregate: "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"`.
- `thresholdType: 1` (below), one trigger `label: "warning"`,
  `alertThreshold: 99`, `resolveThreshold: 99.5`, `timeWindow: 60` (minutes).
- `environment`/`projects` are supplied by the CLI from `SENTRY_ENVIRONMENT`/`SENTRY_PROJECT`.

**Prerequisites**
1. The Sentry org (`bombaypetcompany`) + project slugs, and an auth token
   with `alert:write` + `project:read` scopes (`[FOUNDER-2]`).

**Ops-only env** (same rules as §4 — local shell only, never in a runtime
env schema):

<!-- BEGIN:sentry-env -->
| Var | Required for a real run? | Default |
|---|---|---|
| `SENTRY_AUTH_TOKEN` | yes | — |
| `SENTRY_PROJECT` | yes | — |
| `SENTRY_ENVIRONMENT` | yes | — |
| `SENTRY_ORG` | no | `bombaypetcompany` |
| `SENTRY_API_HOST` | no | `https://sentry.io` |
<!-- END:sentry-env -->

**Commands**
```
pnpm build
pnpm --filter @bombaypetcompany/api ops:sentry:alerts -- --dry-run   # prints the payload, exit 0, no env required
pnpm --filter @bombaypetcompany/api ops:sentry:alerts                # applies against the real org/project
```

`[FOUNDER-4]` The rule ships with an **empty action list** by design (the
API alone cannot fully express a notification target for every org): after
running the command for real, open the created rule in the Sentry UI and
attach an email/Slack notification action.

## 7. `[FOUNDER]` Staging verification (AC2 evidence)

`[FOUNDER-3]`/`[FOUNDER-5]`: this is the only step that produces the card's
"staging events visible in funnel" evidence — it cannot be produced in the
build container (no staging project, no keys, no staging build).

1. Export `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`,
   `SENTRY_AUTH_TOKEN`, `SENTRY_PROJECT`, `SENTRY_ENVIRONMENT` in a local
   shell (never commit them).
2. Run `pnpm --filter @bombaypetcompany/api ops:posthog:dashboards` then
   `pnpm --filter @bombaypetcompany/api ops:sentry:alerts` for real.
3. From a staging build, trigger one `paywall_view` (open the paywall
   screen) and one `trial_start` (start a trial).
4. In the PostHog UI: **Project → Insights → `Paywall funnel:
   paywall_view -> trial_start`** (or open it via the
   **`Bombay Pet Company — Activation & Retention`** dashboard). Confirm the
   staging events appear in the funnel.
5. Screenshot the funnel insight and attach the screenshot to the T103
   journal entry.

## 8. Re-running / idempotency and exit codes

Both CLIs are idempotent by **name**: they `GET`/list the existing
dashboard/insights/alert-rule, match on the exact committed `name` above,
and `PATCH`/`PUT` when found instead of creating a duplicate. Re-running
either command against the same project is always safe.

Exit codes (both CLIs):
- `0` — success, including every `--dry-run` invocation (no network calls).
- `2` — a required env var is missing (message: `missing required env: <NAMES>`).
- `3` — the provider API returned a non-2xx response (message includes the
  status code and a truncated response body; never the credential).

**If you get exit 3 with a 400 (R2 — payload schema drift):** the JSON payload
shapes in `packages/analytics/src/dashboards/` were written against the
PostHog REST API (`/api/projects/:id/insights/`, `/api/projects/:id/dashboards/`)
and Sentry metric-alert API (`/api/0/organizations/:org/alert-rules/`) as
documented at authoring time (2026-07-29) and were **never applied against a
live project from this environment** (§9). Provider schemas drift. On a 400:
run `--dry-run`, compare the printed payload field-by-field against the
provider's current API reference for that endpoint, and adjust the builder in
`packages/analytics/src/dashboards/` (the event names and thresholds are
test-pinned; the surrounding envelope shape is not — known most-likely
mismatches: retention `targetEntity`/`returningEntity` entity key,
`InsightVizNode` query wrapping, funnel-step `order`, Sentry `query` field).
The alert threshold (`99`) and every event name are the load-bearing,
test-guarded values — keep them identical through any reshaping.

## 9. Honest statement — what was actually executed here

<!-- BEGIN:honesty -->
**No PostHog or Sentry API call was executed in this build environment.**
There is no `POSTHOG_PERSONAL_API_KEY`, no `POSTHOG_PROJECT_ID`, no
`SENTRY_AUTH_TOKEN`, no `SENTRY_PROJECT`, and no staging build emitting
events here — §7 is `[FOUNDER]`-only. The commands that WERE executed
(keyless, offline except for the dry-run's own `pnpm build`):

```
pnpm build
pnpm --filter @bombaypetcompany/api ops:posthog:dashboards -- --dry-run
pnpm --filter @bombaypetcompany/api ops:sentry:alerts -- --dry-run
pnpm --filter @bombaypetcompany/api ops:posthog:dashboards
pnpm --filter @bombaypetcompany/api ops:sentry:alerts
```

The first three exit `0` and print the exact payloads above; the last two
(no env vars set) exit `2` with `missing required env: ...`.
<!-- END:honesty -->
