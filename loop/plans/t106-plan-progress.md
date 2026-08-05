# T106 Plan Progress Ledger

- [start] Skeleton written; beginning investigation.
- [1] Read T106 card (PHASES 511-513) + docs/release-runbook.md (11 sections, T099/T100/T101 state, drift guard exists) -> decision: EXTEND runbook.
- [2] T073/T074/T079 config: `GET /v1/config` = `apps/api/src/remote-config/*`, env-only (AppConfigService), no DB. Types: `packages/types/src/config.ts` `appConfigResponseSchema` is `.strict()`. Mobile: `apps/mobile/src/config/app-config-queries.ts` (`fetchAppConfig`/`useAppConfig`, DEFAULT_APP_CONFIG fail-open) + `app-config-cache.ts` (MMKV, hand-rolled validator).
- [3] Error envelope: `packages/types/src/error-codes.ts` (8 codes, spec pins exact list) + `apps/api/src/common/all-exceptions.filter.ts` STATUS_TO_CODE (no 503 mapping -> would fall to INTERNAL).
- [4] ARCHITECTURE containers: §2 table (api, workers, mobile, web, packages/ai, packages/data) + §1 context deps (PG, Redis, S3/MinIO, AI providers, Expo Push, RevenueCat, PostHog, Sentry). §7 explicitly defers prod migrations to "runbook T106".
- [5] Gating points: `checks.controller.ts` (POST create / GET list / GET :id / POST followup), `chat.controller.ts` (POST threads / POST messages). RedisService has get/set/del/setNx (read-only use => no new method needed).
- [6] `submitFollowUp` verified deterministic (`raiseUrgency`, no AI) -> must stay UNGATED (escalation path). `GET /checks/:id` carries the redFlag payload -> must stay UNGATED.
- [7] Mobile surfaces: `app/check/index.tsx` (CategoryGrid), `app/chat/index.tsx` (composer/quick-prompts + persistent VetDisclaimer), `src/checks/use-check-submission.ts` (402->quota, else error). Existing harnesses: check-entry-screen, chat-screen, emergency-interstitial, check-submission, app-config-{queries,cache}, release-runbook-doc.
- [8] `env.schema.ts` has no boolean idiom -> plan uses `z.enum(["on","off"])`. `test/remote-config.e2e-spec.ts` pins the config body with exact `toEqual` -> must be updated.
- [9] PLAN WRITTEN IN FULL: 10 locked design decisions (D1-D10), 21 ordered steps, 41-file inventory (34 modify / 7 create / 1 conditional, no migration, no new deps), AC->proof map, gates, top-5 risks, founder delta, verbatim executor warnings. STATUS: COMPLETE.
