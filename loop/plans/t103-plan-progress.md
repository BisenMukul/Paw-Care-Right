# T103 planner progress ledger

- [x] S0 Skeleton plan + ledger written
- [x] S1 Task card (docs/PHASES.md L499-501) + CLAUDE §1a/§2/§7 + PRODUCT_SPEC §8 read
- [x] S2 Event registry inventoried: EXACTLY 3 events in `AnalyticsEventMap` (first_check_completed, paywall_view, trial_start); emitters = check-runner.processor, mobile paywall.tsx, rc-webhook.service; custom HTTP transport => no autocapture, no $pageview/$identify
- [x] S3 T089 Sentry state: `baseSentryOptions`/`buildSentryRelease` (`bombaypetcompany@{version}+{buildId}`), stub-safe on empty DSN; env shapes in .env.example L48-67 (SENTRY_DSN/SENTRY_ENVIRONMENT/GIT_SHA/APP_VERSION, POSTHOG_API_KEY/POSTHOG_HOST)
- [x] S4 Script idioms: apps/mobile/scripts/analyze-bundle.ts (tsx CLI, `eslint-disable no-console -- JUSTIFIED`), apps/api `prisma/seed/tsconfig.json` (tsx --tsconfig runtime paths override to dist/index.cjs); tsx is a devDep of apps/api + apps/mobile only
- [x] S5 Doc-spec idioms: apps/mobile/__tests__/release-runbook-doc.test.ts, packages/analytics/src/store-privacy-doc.spec.ts (section anchors + set-equality drift guard + SECRET_PATTERNS scan)
- [x] S6 Gap analysis complete: activation entry step / trial_to_paid / app_open are NOT tracked -> documented gaps G1-G3, no invented event names in scripts
- [x] S7 Full plan written to loop/plans/T103.plan.md
