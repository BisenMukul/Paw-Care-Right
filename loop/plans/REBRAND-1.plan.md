# Plan — REBRAND-1: full product rebrand `Paw Care Right +` → `Bombay Pet Company`

## Objective (from card)
Rebrand the entire product from `Paw Care Right +` to `Bombay Pet Company` — display name AND every technical identifier (`pawcareright` → `bombaypetcompany`, `com.pawcareright.app` → `com.bombaypetcompany.app`, `@pawcareright/*` → `@bombaypetcompany/*`, `pawcareright://` → `bombaypetcompany://`, `pawcareright-*` / `pawcareright:` infra names, `pawcareright.app` domain, Sentry release + org/project slugs, EAS slug). All quality gates stay green; zero non-exempt survivors of the old brand.

Founder decisions locked 2026-07-29. Display string is exactly `Bombay Pet Company` — **no trailing `+`**, no suffix.

---

## Locked identifier map (do NOT invent variants)

| Context | Old | New |
|---|---|---|
| Display name (`APP_DISPLAY_NAME`) | `Paw Care Right +` | `Bombay Pet Company` |
| npm/workspace slug, package scope | `pawcareright`, `@pawcareright/*` | `bombaypetcompany`, `@bombaypetcompany/*` |
| iOS/Android bundle id | `com.pawcareright.app` | `com.bombaypetcompany.app` |
| Deep-link scheme | `pawcareright://` | `bombaypetcompany://` |
| S3 bucket | `pawcareright-media` | `bombaypetcompany-media` |
| Redis key prefixes | `pawcareright:` | `bombaypetcompany:` |
| BullMQ queue names | `pawcareright-*` | `bombaypetcompany-*` |
| Mobile persisted-store / SecureStore keys | `pawcareright.*` | `bombaypetcompany.*` |
| Sentry release shape | `pawcareright@{version}+{id}` | `bombaypetcompany@{version}+{id}` |
| Sentry org / project fallbacks | `pawcareright`, `pawcareright-api`, `pawcareright-web`, `pawcareright-mobile` | `bombaypetcompany`, `bombaypetcompany-api`, `bombaypetcompany-web`, `bombaypetcompany-mobile` |
| Web domain placeholder | `pawcareright.app` | `bombaypetcompany.app` |
| Seed/dev emails | `*@pawcareright.local` | `*@bombaypetcompany.local` |
| Postgres role/db/password (dev) | `pawcareright` | `bombaypetcompany` |
| MinIO root user/password (dev) | `pawcareright` / `pawcareright-dev-secret` | `bombaypetcompany` / `bombaypetcompany-dev-secret` |
| Google OAuth dev client id | `pawcareright-dev.apps.googleusercontent.com` | `bombaypetcompany-dev.apps.googleusercontent.com` |
| EAS project slug | `pawcareright` | `bombaypetcompany` |

T102's trademark check now targets "Bombay Pet Company" — **note only, do not perform it in this task.**

---

## HARD CONSTRAINT — hook-protected paths the EXECUTOR MUST SKIP

`.claude/hooks/block_protected_paths.sh` (PreToolUse on Edit|Write) hard-blocks:
`*CLAUDE.md`, `*LOOP_PROTOCOL.md`, `*docs/MODEL_STRATEGY.md`, `*docs/PHASES.md`, `*docs/AI_PROVIDERS.md`, `*docs/OTA_UPDATES.md`, `.claude/*`, `*.env`, `*.env.*` (except `.env.example`).

**The executor must not attempt to edit any of these, and must NOT route around the hook with `sed -i` / Bash / `tee`. Doing so is an automatic checker rejection.** These are applied by the ORCHESTRATOR at finalize time (see "Orchestrator-applied edits" below) or are documented exemptions.

`.env.example` IS editable (explicitly exempted by the hook) and is in scope.

---

## Files to create/modify (exhaustive — executor may touch NOTHING else)

Class legend: **[ID]** lowercase identifier only · **[NAME]** display-name string only · **[BOTH]** · **[SNAP]** snapshot rebaseline · **[GEN]** regenerated, never hand-edited.

### Root / infra
- `package.json` — [ID] root `"name": "pawcareright"` → `bombaypetcompany`
- `pnpm-lock.yaml` — [GEN] regenerate via `pnpm i` ONLY. Never hand-edit.
- `docker-compose.yml` — [ID] POSTGRES_USER/PASSWORD/DB defaults, healthcheck `-U/-d`, MINIO_ROOT_USER/PASSWORD, `mc mb local/pawcareright-media`
- `.env.example` — [BOTH] header comment + POSTGRES_*, MINIO_*, DATABASE_URL, APPLE_CLIENT_ID, GOOGLE_CLIENT_ID, S3_ACCESS_KEY/S3_SECRET_KEY/S3_BUCKET, Sentry release-shape comment
- `.github/workflows/ci.yml` — [ID] postgres service env + health-cmd, `DATABASE_URL`, release-shape comments, MinIO `docker run` creds, `SENTRY_ORG`/`SENTRY_PROJECT` fallbacks, `version: "pawcareright@..."`, all four `pnpm --filter @pawcareright/web ...` invocations
- `README.md` — [BOTH]
- `AI_PROVIDERS.md` (repo-root copy — NOT `docs/AI_PROVIDERS.md`) — [NAME]
- `scripts/scan-secrets.js` — [ID] only if it contains a brand literal; verify with grep first, else leave untouched

### `packages/config`
- `packages/config/src/constants.ts` — [BOTH] `APP_DISPLAY_NAME`, `APP_SLUG`, `BUNDLE_ID`, `DEEPLINK_SCHEME`
- `packages/config/package.json` — [ID] `"name"`
- `packages/config/tsconfig.base.json` — [ID] `paths` entries
- `packages/config/tailwind-preset.mjs` — [NAME] header comment
- `packages/config/eslint.config.mjs` — [NAME] header comment

### `packages/types`
- `packages/types/package.json`, `packages/types/tsconfig.json`, `packages/types/tsconfig.spec.json`, `packages/types/eslint.config.mjs` — [ID]
- `packages/types/src/entitlement.ts`, `packages/types/src/entitlement.spec.ts`, `packages/types/src/care-plan.ts`, `packages/types/src/household.spec.ts`, `packages/types/src/rc-webhook.spec.ts`, `packages/types/src/vet-summary-copy.ts`, `packages/types/src/vet-disclaimer-copy.ts`, `packages/types/src/vet-disclaimer-copy.spec.ts`, `packages/types/src/medication-copy.ts`, `packages/types/src/account-export.spec.ts`, `packages/types/src/chat.ts` — [BOTH]

### `packages/api-client`
- `packages/api-client/package.json`, `packages/api-client/tsconfig.json`, `packages/api-client/tsconfig.spec.json`, `packages/api-client/eslint.config.mjs` — [ID]
- `packages/api-client/src/errors.ts`, `packages/api-client/src/errors.spec.ts`, `packages/api-client/src/online.ts` — [ID]
- `packages/api-client/src/mmkv-persister.ts` — [ID] `DEFAULT_PERSISTER_KEY = "pawcareright-query-cache"`

### `packages/analytics`
- `packages/analytics/package.json`, `packages/analytics/tsconfig.json`, `packages/analytics/tsconfig.spec.json`, `packages/analytics/eslint.config.mjs` — [ID]
- `packages/analytics/src/events.ts`, `packages/analytics/src/sentry/scrub.ts`, `packages/analytics/src/sentry/scrub.spec.ts` — [ID]
- `packages/analytics/src/sentry/options.ts` — [ID] **`buildSentryRelease` template `` `pawcareright@${v}+${b}` ``**
- `packages/analytics/src/sentry/options.spec.ts` — [ID] release-shape pins (T089)

### `packages/data`
- `packages/data/package.json`, `packages/data/tsconfig.json`, `packages/data/tsconfig.spec.json`, `packages/data/eslint.config.mjs` — [ID]
- `packages/data/src/toxins/normalize.ts`, `packages/data/src/toxins/schema.ts`, `packages/data/src/breed-guides/index.ts`, `packages/data/src/care-templates/index.ts`, `packages/data/src/care-templates/schema.ts`, `packages/data/src/care-templates/life-stages.ts`, `packages/data/src/care-templates/care-templates.spec.ts`, `packages/data/src/care-templates/data/base.ts`, `packages/data/src/care-templates/data/vaccine-overlays.ts` — [ID]

### `packages/ai`
- `packages/ai/package.json`, `packages/ai/tsconfig.json`, `packages/ai/tsconfig.spec.json`, `packages/ai/eslint.config.mjs` — [ID]
- `packages/ai/src/env.schema.ts` — [ID]
- `packages/ai/src/triage/types.ts`, `packages/ai/src/triage/run.ts`, `packages/ai/src/triage/run.spec.ts`, `packages/ai/src/triage/build.spec.ts`, `packages/ai/src/triage/exemplars.spec.ts`, `packages/ai/src/triage/extract-json.spec.ts`, `packages/ai/src/triage/schema-text.ts`, `packages/ai/src/triage/system-prompt.ts`, `packages/ai/src/triage/user-turn.ts`, `packages/ai/src/triage/user-turn.spec.ts` — [ID]
- `packages/ai/src/food/types.ts`, `packages/ai/src/food/prompt.ts`, `packages/ai/src/food/cache.ts`, `packages/ai/src/food/service.ts`, `packages/ai/src/food/service.spec.ts` — [ID]
- `packages/ai/src/rules/types.ts`, `packages/ai/src/rules/engine.ts`, `packages/ai/src/rules/rules-table.spec.ts`, `packages/ai/src/rules/emergency-payload-parity.spec.ts` — [ID]
- `packages/ai/src/post-rules/apply-post-rules.ts`, `packages/ai/src/post-rules/apply-post-rules.spec.ts` — [ID]
- `packages/ai/src/chat/types.ts`, `packages/ai/src/chat/build.ts`, `packages/ai/src/chat/nudge.ts`, `packages/ai/src/chat/digest.ts` — [ID]
- `packages/ai/src/content/breed-guide-draft.ts`, `packages/ai/src/content/breed-guide-draft.spec.ts`, `packages/ai/src/content/breed-guide-prompt.ts`, `packages/ai/src/content/generate-breed-guides.ts`, `packages/ai/src/content/breed-guides-safety.spec.ts` — [ID]
- `packages/ai/src/evals/types.ts`, `packages/ai/src/evals/paths.ts`, `packages/ai/src/evals/case-schema.ts`, `packages/ai/src/evals/detector.ts`, `packages/ai/src/evals/detector.spec.ts`, `packages/ai/src/evals/drug-names.ts`, `packages/ai/src/evals/pipeline.ts`, `packages/ai/src/evals/score.ts`, `packages/ai/src/evals/score.spec.ts`, `packages/ai/src/evals/harness.spec.ts`, `packages/ai/src/evals/golden-set.spec.ts`, `packages/ai/src/evals/redteam-set.spec.ts`, `packages/ai/src/evals/medication-copy-safety.spec.ts` — [ID]
- `packages/ai/src/providers/ollama.integration.spec.ts`, `packages/ai/src/providers/gemini-image.integration.spec.ts` — [ID]

### `apps/api` — manifests / configs
- `apps/api/package.json` — [ID] name, 5 workspace deps, **jest `moduleNameMapper` keys `^@pawcareright/config$`, `^@pawcareright/config/env$`, `^@pawcareright/data$`**
- `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json` — [ID] `paths`
- `apps/api/eslint.config.mjs` — [ID]

### `apps/api` — prisma / seed
- `apps/api/prisma/schema.prisma` — [NAME] comment "Ask Paw Care Right +"
- `apps/api/prisma/seed.ts` — [ID] `dev@pawcareright.local`
- `apps/api/prisma/seed/constants.ts` — [ID] `OWNER_EMAIL`, `FAMILY_EMAIL`
- `apps/api/prisma/seed/tsconfig.json` — [ID] `paths`
- `apps/api/prisma/seed/content.ts`, `apps/api/prisma/seed/persist.ts`, `apps/api/prisma/seed/README.md`, `apps/api/prisma/seed/builders/checks.ts`, `apps/api/prisma/seed/builders/health-logs.ts`, `apps/api/prisma/seed/builders/pets.ts`, `apps/api/prisma/seed/builders/reminders.ts` — [ID]

### `apps/api/src`
- `apps/api/src/main.ts`, `apps/api/src/app.setup.ts`
- `apps/api/src/config/env.schema.ts` — [ID] DATABASE_URL / APPLE_CLIENT_ID / GOOGLE_CLIENT_ID / S3_ACCESS_KEY / S3_SECRET_KEY / S3_BUCKET defaults
- `apps/api/src/config/app-config.service.ts`
- `apps/api/src/auth/auth.constants.ts` — [ID] `OTP_KEY_PREFIX`, `RATE_LIMIT_KEY_PREFIX`
- `apps/api/src/auth/social/apple-token-verifier.spec.ts`, `apps/api/src/auth/social/google-token-verifier.spec.ts`
- `apps/api/src/quota/quota.constants.ts` — [BOTH] `QUOTA_KEY_PREFIX`, `COST_DAILY_KEY_PREFIX` + "Ask Paw Care Right +" comment
- `apps/api/src/quota/quota.util.ts`, `apps/api/src/quota/quota.service.spec.ts`, `apps/api/src/quota/entitlement.ts`, `apps/api/src/quota/entitlement.spec.ts`
- `apps/api/src/abuse/abuse.constants.ts` — [ID] `ABUSE_KEY_PREFIX`
- `apps/api/src/abuse/abuse.util.ts`
- `apps/api/src/breeds/breeds.service.ts` — [ID] `pawcareright:breeds:` redis key
- `apps/api/src/breeds/breeds.service.spec.ts`, `apps/api/src/breeds/breeds.controller.ts`
- `apps/api/src/checks/checks.contract.ts` — [ID] `CHECKS_QUEUE`
- `apps/api/src/checks/checks.service.ts`, `apps/api/src/checks/checks.service.spec.ts`, `apps/api/src/checks/check-status.ts`, `apps/api/src/checks/check-status.spec.ts`, `apps/api/src/checks/red-flag-intake.mapper.ts`, `apps/api/src/checks/red-flag-intake.mapper.spec.ts`, `apps/api/src/checks/dto/create-check.dto.ts`, `apps/api/src/checks/dto/list-checks-query.dto.ts`, `apps/api/src/checks/dto/follow-up.dto.ts`
- `apps/api/src/chat/chat.controller.ts`, `apps/api/src/chat/chat.service.ts` — [BOTH] **user-facing 402 message "Ask Paw Care Right + is a premium feature." → "Ask Bombay Pet Company is a premium feature."**
- `apps/api/src/chat/chat.service.spec.ts`, `apps/api/src/chat/chat.module.ts`, `apps/api/src/chat/chat.constants.ts`, `apps/api/src/chat/dto/send-message.dto.ts`
- Queue-name contracts (each holds a `pawcareright-*` literal): `apps/api/src/workers/push.contract.ts`, `apps/api/src/workers/push-receipts.contract.ts`, `apps/api/src/workers/images.contract.ts`, `apps/api/src/workers/followups.contract.ts`, `apps/api/src/workers/reminders-scheduler.contract.ts`, `apps/api/src/workers/reminder-consistency.contract.ts`, `apps/api/src/workers/account-deletion.contract.ts`, `apps/api/src/workers/account-export.contract.ts`, `apps/api/src/workers/ai-audit-retention.contract.ts`
- `apps/api/src/workers/push-sender.service.ts` — [ID] `pawcareright:push:collapse:` key builder
- `apps/api/src/workers/push-sender.service.spec.ts`, `apps/api/src/workers/ai-audit-retention.service.spec.ts` (**pins `"pawcareright-ai-audit-retention"` and the test title "is the pawcareright-prefixed queue name"**), `apps/api/src/workers/workers.module.ts`, `apps/api/src/workers/images.processor.ts`, `apps/api/src/workers/images.processor.spec.ts`, `apps/api/src/workers/check-runner.processor.ts`, `apps/api/src/workers/check-runner.processor.spec.ts`, `apps/api/src/workers/reminder-scheduler.service.ts`, `apps/api/src/workers/reminder-consistency.service.ts`, `apps/api/src/workers/account-deletion.service.ts`, `apps/api/src/workers/account-deletion.service.spec.ts`
- `apps/api/src/billing/billing.controller.ts`, `apps/api/src/billing/billing.service.ts`, `apps/api/src/billing/billing.service.spec.ts`, `apps/api/src/billing/entitlement.util.ts`, `apps/api/src/billing/rc-webhook.service.ts`, `apps/api/src/billing/rc-webhook.service.spec.ts`, `apps/api/src/billing/rc-webhook.state.ts`, `apps/api/src/billing/rc-webhook.state.spec.ts`
- `apps/api/src/households/households.service.ts` — [ID] `pawcareright://join/` deep link
- `apps/api/src/households/households.service.spec.ts`
- `apps/api/src/health-logs/health-logs.service.ts`, `apps/api/src/health-logs/health-logs.service.spec.ts`, `apps/api/src/health-logs/build-vet-summary.ts`, `apps/api/src/health-logs/build-vet-summary.spec.ts`, `apps/api/src/health-logs/dto/create-log.dto.ts`, `apps/api/src/health-logs/dto/list-logs-query.dto.ts`
- `apps/api/src/reminders/reminders.service.ts`, `apps/api/src/reminders/reminders.service.spec.ts`, `apps/api/src/reminders/reminders.controller.ts`, `apps/api/src/reminders/next-fire-at.ts`, `apps/api/src/reminders/next-fire-at.spec.ts`, `apps/api/src/reminders/occurrences-between.ts`, `apps/api/src/reminders/occurrences-between.spec.ts`, `apps/api/src/reminders/medication-course.ts`, `apps/api/src/reminders/medication-course.spec.ts`, `apps/api/src/reminders/template-anchors.ts`, `apps/api/src/reminders/timezone-matrix.spec.ts`, `apps/api/src/reminders/validators/is-rrule.validator.ts`, `apps/api/src/reminders/dto/create-reminder.dto.ts`, `apps/api/src/reminders/dto/update-reminder.dto.ts`, `apps/api/src/reminders/dto/list-reminders-query.dto.ts`, `apps/api/src/reminders/dto/instantiate-template.dto.ts`, `apps/api/src/reminders/dto/template-suggestions-query.dto.ts`
- `apps/api/src/notifications/notification-prefs.controller.ts`, `apps/api/src/notifications/notification-prefs.service.ts`, `apps/api/src/notifications/dto/update-notification-prefs.dto.ts`
- `apps/api/src/me/privacy.controller.ts`, `apps/api/src/me/privacy.service.ts`, `apps/api/src/me/account-export.service.ts`, `apps/api/src/me/account-export.service.spec.ts`
- `apps/api/src/pets/pets.service.spec.ts`
- `apps/api/src/photos/dto/photo-view-urls.dto.ts`
- `apps/api/src/vision/vision.util.ts`, `apps/api/src/vision/vision.util.spec.ts`, `apps/api/src/vision/vision.types.ts`, `apps/api/src/vision/vision-prep.service.spec.ts`
- `apps/api/src/remote-config/remote-config.service.ts`, `apps/api/src/remote-config/remote-config.controller.ts`
- `apps/api/src/analytics/analytics.service.ts`
- `apps/api/src/audit/ai-audit.flags.ts`, `apps/api/src/audit/ai-audit.flags.spec.ts`
- `apps/api/src/observability/sentry.ts`, `apps/api/src/observability/sentry.spec.ts`
- `apps/api/src/common/all-exceptions.filter.ts`, `apps/api/src/common/throttle.config.ts`

### `apps/api/test`
- `apps/api/test/global-setup.ts` — [ID] hardcoded DATABASE_URL fallback
- `apps/api/test/load/checks-load-sanity.ts` — [ID] `DEFAULT_DATABASE_URL` + doc comment
- `apps/api/test/secret-scan.spec.ts` — [ID] placeholder fixtures `POSTGRES_PASSWORD: pawcareright`, `MINIO_ROOT_PASSWORD=pawcareright-dev-secret`
- `apps/api/test/photos-presign-fuzz.e2e-spec.ts` — [ID] `not.toContain("pawcareright-dev-secret")`
- `apps/api/test/auth.e2e-spec.ts` — [ID] `redis.keys("pawcareright:rl:*")`, `redis.keys("pawcareright:otp:*")`
- `apps/api/test/households.e2e-spec.ts` — [ID] deep-link assertion
- `apps/api/test/auth-social.e2e-spec.ts` — [ID] `GOOGLE_TEST_AUDIENCE`
- `apps/api/test/photos.e2e-spec.ts` — [ID] EXIF `Software: "pawcareright-test"`
- `apps/api/test/factories/index.ts`, `apps/api/test/factories/health-logs.ts`
- `apps/api/test/app.e2e-spec.ts`, `apps/api/test/pets.e2e-spec.ts`, `apps/api/test/breeds.e2e-spec.ts`, `apps/api/test/checks.e2e-spec.ts`, `apps/api/test/checks-lifecycle.e2e-spec.ts`, `apps/api/test/chat.e2e-spec.ts`, `apps/api/test/billing.e2e-spec.ts`, `apps/api/test/billing-webhook.e2e-spec.ts`, `apps/api/test/billing-webhook-fuzz.e2e-spec.ts`, `apps/api/test/quota-gating.e2e-spec.ts`, `apps/api/test/rate-limits.e2e-spec.ts`, `apps/api/test/guards.e2e-spec.ts`, `apps/api/test/security.e2e-spec.ts`, `apps/api/test/schema.e2e-spec.ts`, `apps/api/test/reminders.e2e-spec.ts`, `apps/api/test/reminders-schema.e2e-spec.ts`, `apps/api/test/health-logs.e2e-spec.ts`, `apps/api/test/notification-prefs.e2e-spec.ts`, `apps/api/test/devices.e2e-spec.ts`, `apps/api/test/remote-config.e2e-spec.ts`, `apps/api/test/account-privacy.e2e-spec.ts`, `apps/api/test/account-deletion.e2e-spec.ts`, `apps/api/test/seed/demo-seed.e2e-spec.ts`, `apps/api/test/seed/demo-builders.spec.ts`

### `apps/mobile` — manifests / configs
- `apps/mobile/package.json` — [ID] name + 6 workspace deps
- `apps/mobile/tsconfig.json`, `apps/mobile/eslint.config.mjs`, `apps/mobile/tailwind.config.js`
- `apps/mobile/app.config.js` — [ID] `require("@pawcareright/config")`, `termsUrl`/`privacyUrl` (`pawcareright.app`), EAS-slug comment, Sentry `organization`/`project` fallbacks. **Leave `extra.eas.projectId` UUID and `owner` unchanged.**
- `apps/mobile/scripts/measure-cold-start.sh` — [ID]

### `apps/mobile/app` (routes)
`apps/mobile/app/_layout.tsx`, `apps/mobile/app/paywall.tsx`, `apps/mobile/app/family.tsx`, `apps/mobile/app/(auth)/otp.tsx`, `apps/mobile/app/(tabs)/care.tsx`, `apps/mobile/app/(tabs)/settings.tsx`, `apps/mobile/app/(tabs)/timeline.tsx`, `apps/mobile/app/activity/[petId].tsx`, `apps/mobile/app/breeds/[species]/[slug].tsx`, `apps/mobile/app/care-plan/[petId].tsx`, `apps/mobile/app/chat/index.tsx`, `apps/mobile/app/check/index.tsx`, `apps/mobile/app/check/[category].tsx`, `apps/mobile/app/check/emergency/[checkId].tsx`, `apps/mobile/app/check/history/[petId].tsx`, `apps/mobile/app/check/result/[checkId].tsx`, `apps/mobile/app/check/waiting/[checkId].tsx`, `apps/mobile/app/checks/[id].tsx`, `apps/mobile/app/join/[code].tsx`, `apps/mobile/app/note/[petId].tsx`, `apps/mobile/app/pets/[id].tsx`, `apps/mobile/app/reminders/edit.tsx`, `apps/mobile/app/settings/notifications.tsx`, `apps/mobile/app/settings/privacy.tsx`, `apps/mobile/app/vet-visit/[petId].tsx`, `apps/mobile/app/weight/[petId].tsx`

### `apps/mobile/src`
- `apps/mobile/src/strings.ts` — [BOTH] incl. the "Ask Paw Care Right +" comment
- `apps/mobile/src/config.ts`, `apps/mobile/src/startup-guard.ts`
- `apps/mobile/src/auth/secure-store.ts` — [ID] **`pawcareright.auth.accessToken` / `.refreshToken`**
- `apps/mobile/src/analytics/analytics.ts`, `apps/mobile/src/analytics/consent-store.ts`
- `apps/mobile/src/api/client.ts`, `apps/mobile/src/api/query.ts`, `apps/mobile/src/api/agenda-api.ts`, `apps/mobile/src/api/billing-api.ts`, `apps/mobile/src/api/breeds-api.ts`, `apps/mobile/src/api/care-plan-api.ts`, `apps/mobile/src/api/checks-api.ts`, `apps/mobile/src/api/health-logs-api.ts`, `apps/mobile/src/api/households-api.ts`, `apps/mobile/src/api/notification-prefs-api.ts`, `apps/mobile/src/api/pets-api.ts`, `apps/mobile/src/api/privacy-api.ts`, `apps/mobile/src/api/reminders-api.ts`
- `apps/mobile/src/billing/manage-subscription.ts`, `apps/mobile/src/billing/products.ts`, `apps/mobile/src/billing/paywall-queries.ts`, `apps/mobile/src/billing/paywall-shown-store.ts`
- `apps/mobile/src/care/care-score.ts`
- `apps/mobile/src/chat/chat-events.ts`, `apps/mobile/src/chat/chat-events.spec.ts`, `apps/mobile/src/chat/chat-store.ts`, `apps/mobile/src/chat/expo-sse-transport.ts`, `apps/mobile/src/chat/use-chat-stream.ts`
- `apps/mobile/src/checks/category-icons.ts`, `apps/mobile/src/checks/check-history.ts`, `apps/mobile/src/checks/intake.ts`, `apps/mobile/src/checks/intake-descriptors.ts`, `apps/mobile/src/checks/share-payload.ts`, `apps/mobile/src/checks/urgency-display.ts`, `apps/mobile/src/checks/use-check-submission.ts`, `apps/mobile/src/checks/vet-search.ts`
- `apps/mobile/src/config/app-config-cache.ts`, `apps/mobile/src/config/app-config-queries.ts`, `apps/mobile/src/config/hotline-pack.ts`, `apps/mobile/src/config/store-update-url.ts`
- `apps/mobile/src/content/breed-guide-content.ts`
- `apps/mobile/src/health-logs/activity-config.ts`, `apps/mobile/src/health-logs/activity-recents-store.ts`, `apps/mobile/src/health-logs/health-log-forms.ts`, `apps/mobile/src/health-logs/kind-display.ts`, `apps/mobile/src/health-logs/timeline-value.ts`
- `apps/mobile/src/observability/sentry.ts`
- `apps/mobile/src/offline/flush-outbox.ts`, `apps/mobile/src/offline/outbox-store.ts`, `apps/mobile/src/offline/use-network-listener.ts`, `apps/mobile/src/offline/use-outbox-flush.ts`
- `apps/mobile/src/perf/source-map-attribution.ts`
- `apps/mobile/src/pets/active-pet-store.ts`, `apps/mobile/src/pets/add-pet-store.ts`, `apps/mobile/src/pets/pet-age.ts`, `apps/mobile/src/pets/use-active-pet.ts`
- `apps/mobile/src/reminders/schedule-builder.ts`
- `apps/mobile/src/services/preview-fixtures.ts`
- `apps/mobile/src/weight/breed-weight-band.ts`, `apps/mobile/src/weight/weight-unit-store.ts`
- `apps/mobile/src/components/activity-chip-grid.tsx`, `apps/mobile/src/components/activity-quantity-sheet.tsx`, `apps/mobile/src/components/add-vet-visit-form.tsx`, `apps/mobile/src/components/agenda-item.tsx`, `apps/mobile/src/components/app-title.tsx`, `apps/mobile/src/components/breed-autocomplete.tsx`, `apps/mobile/src/components/breed-guide-sections.tsx`, `apps/mobile/src/components/category-grid.tsx`, `apps/mobile/src/components/check-history-row.tsx`, `apps/mobile/src/components/health-log-photo-picker.tsx`, `apps/mobile/src/components/offline-banner.tsx`, `apps/mobile/src/components/pet-header-card.tsx`, `apps/mobile/src/components/pet-switcher.tsx`, `apps/mobile/src/components/schedule-builder.tsx`, `apps/mobile/src/components/species-picker.tsx`, `apps/mobile/src/components/timeline-filter-chips.tsx`, `apps/mobile/src/components/update-gate.tsx`, `apps/mobile/src/components/vet-disclaimer.tsx`
- `apps/mobile/src/components/chat/active-pet-badge.tsx`, `apps/mobile/src/components/chat/chat-composer.tsx`
- `apps/mobile/src/components/home/care-score-card.tsx`, `apps/mobile/src/components/home/pet-hero-card.tsx`, `apps/mobile/src/components/home/today-preview-card.tsx`
- `apps/mobile/src/components/intake/intake-form.tsx`, `apps/mobile/src/components/intake/photo-prompt-question.tsx`, `apps/mobile/src/components/intake/question-renderer.tsx`

### `apps/mobile/__tests__`
`apps/mobile/__tests__/a11y-sweep.test.tsx`, `apps/mobile/__tests__/active-pet-store.test.ts`, `apps/mobile/__tests__/activity-config.test.ts`, `apps/mobile/__tests__/activity-recents-store.test.ts`, `apps/mobile/__tests__/activity-screen.test.tsx`, `apps/mobile/__tests__/add-pet-store.test.ts`, `apps/mobile/__tests__/agenda-screen.test.tsx`, `apps/mobile/__tests__/agenda-tz-drift.test.tsx`, `apps/mobile/__tests__/analytics-consent.test.ts`, `apps/mobile/__tests__/app-config-cache.test.ts`, `apps/mobile/__tests__/app-title.test.tsx`, `apps/mobile/__tests__/auth-flow.test.tsx`, `apps/mobile/__tests__/auth-store.test.ts`, `apps/mobile/__tests__/billing-issue-banner.test.tsx`, `apps/mobile/__tests__/breed-guide-content.test.ts`, `apps/mobile/__tests__/breed-guide-entry.test.tsx`, `apps/mobile/__tests__/breed-guide-safety.test.ts`, `apps/mobile/__tests__/breed-guide-screen.test.tsx`, `apps/mobile/__tests__/breed-guide-sections.test.tsx`, `apps/mobile/__tests__/breed-weight-band.test.ts`, `apps/mobile/__tests__/care-plan-wizard.test.tsx`, `apps/mobile/__tests__/care-score.test.ts`, `apps/mobile/__tests__/care-score-card.test.tsx`, `apps/mobile/__tests__/category-grid.test.tsx`, `apps/mobile/__tests__/chat-screen.test.tsx`, `apps/mobile/__tests__/chat-screen-snapshot.test.tsx`, `apps/mobile/__tests__/chat-stream.test.tsx`, `apps/mobile/__tests__/chat-strings-tone.test.ts`, `apps/mobile/__tests__/chat-theme-a11y.test.tsx`, `apps/mobile/__tests__/check-deeplink-route.test.tsx`, `apps/mobile/__tests__/check-entry-screen.test.tsx`, `apps/mobile/__tests__/check-flow-a11y.test.tsx`, `apps/mobile/__tests__/check-flow-theme.test.tsx`, `apps/mobile/__tests__/check-history.test.ts`, `apps/mobile/__tests__/check-history-screen.test.tsx`, `apps/mobile/__tests__/check-result-screen.test.tsx`, `apps/mobile/__tests__/check-result-snapshot.test.tsx`, `apps/mobile/__tests__/check-submission.test.tsx`, `apps/mobile/__tests__/check-waiting-screen.test.tsx`, `apps/mobile/__tests__/checks-api.test.ts`, `apps/mobile/__tests__/cold-start-budget.test.ts`, `apps/mobile/__tests__/colorful-icon-tiles.test.tsx`, `apps/mobile/__tests__/dual-theme-tokens.test.tsx`, `apps/mobile/__tests__/dynamic-type.test.tsx`, `apps/mobile/__tests__/emergency-interstitial.test.tsx`, `apps/mobile/__tests__/family-screen.test.tsx`, `apps/mobile/__tests__/fonts-nonblocking.test.tsx`, `apps/mobile/__tests__/header-sweep.test.tsx`, `apps/mobile/__tests__/health-log-forms.test.ts`, `apps/mobile/__tests__/health-logs-api.test.ts`, `apps/mobile/__tests__/home-screen.test.tsx`, `apps/mobile/__tests__/intake.test.ts`, `apps/mobile/__tests__/intake-descriptors.test.ts`, `apps/mobile/__tests__/intake-form.test.tsx`, `apps/mobile/__tests__/intake-screen.test.tsx`, `apps/mobile/__tests__/join-route.test.tsx`, `apps/mobile/__tests__/manage-subscription.test.ts`, `apps/mobile/__tests__/no-pawsaathi-branding.test.ts`, `apps/mobile/__tests__/note-screen.test.tsx`, `apps/mobile/__tests__/notification-prefs-screen.test.tsx`, `apps/mobile/__tests__/offline-banner.test.tsx`, `apps/mobile/__tests__/offline-outbox.test.ts`, `apps/mobile/__tests__/paywall-emergency-safety.test.tsx`, `apps/mobile/__tests__/paywall-snapshot.test.tsx`, `apps/mobile/__tests__/pet-home-screen.test.tsx`, `apps/mobile/__tests__/pet-home-snapshot.test.tsx`, `apps/mobile/__tests__/pet-switcher.test.tsx`, `apps/mobile/__tests__/privacy-screen.test.tsx`, `apps/mobile/__tests__/purchases.test.ts`, `apps/mobile/__tests__/question-renderer.test.tsx`, `apps/mobile/__tests__/reduced-motion-gating.test.tsx`, `apps/mobile/__tests__/reminders-vaccines-theme.test.tsx`, `apps/mobile/__tests__/responsive-grids.test.tsx`, `apps/mobile/__tests__/responsive-reading-columns.test.tsx`, `apps/mobile/__tests__/root-layout.test.tsx`, `apps/mobile/__tests__/schedule-builder.test.ts`, `apps/mobile/__tests__/sentry.test.ts`, `apps/mobile/__tests__/settings-manage.test.tsx`, `apps/mobile/__tests__/settings-premium-entry.test.tsx`, `apps/mobile/__tests__/share-payload.test.ts`, `apps/mobile/__tests__/source-map-attribution.test.ts`, `apps/mobile/__tests__/startup-guard.test.ts`, `apps/mobile/__tests__/storage-audit.test.ts`, `apps/mobile/__tests__/strings-detector-lint.test.ts`, `apps/mobile/__tests__/sweep-remaining-theme.test.tsx`, `apps/mobile/__tests__/sweep4-a11y.test.tsx`, `apps/mobile/__tests__/timeline-screen.test.tsx`, `apps/mobile/__tests__/token-storage.test.ts`, `apps/mobile/__tests__/touch-targets.test.tsx`, `apps/mobile/__tests__/upsell-interceptor.test.ts`, `apps/mobile/__tests__/urgency-contrast.test.ts`, `apps/mobile/__tests__/vet-search.test.ts`, `apps/mobile/__tests__/vet-visit-screen.test.tsx`, `apps/mobile/__tests__/weight-screen.test.tsx`, `apps/mobile/__tests__/weight-unit-store.test.ts`

### `apps/mobile/__tests__/__snapshots__` — [SNAP] name-string-only deltas
- `apps/mobile/__tests__/__snapshots__/breed-guide-sections.test.tsx.snap`
- `apps/mobile/__tests__/__snapshots__/chat-screen-snapshot.test.tsx.snap`
- `apps/mobile/__tests__/__snapshots__/paywall-snapshot.test.tsx.snap`
- `apps/mobile/__tests__/__snapshots__/check-result-snapshot.test.tsx.snap`

### `apps/web`
- `apps/web/package.json` — [ID] name + 5 workspace deps
- `apps/web/tsconfig.json`, `apps/web/tsconfig.spec.json`, `apps/web/eslint.config.mjs`, `apps/web/tailwind.config.mjs`
- `apps/web/next.config.mjs` — [ID] `transpilePackages`, Sentry `org`/`project` fallbacks
- `apps/web/lighthouserc.json` — [ID] `startServerCommand` filter
- `apps/web/src/site.ts` — [ID] `SITE_URL = "https://pawcareright.app"`
- `apps/web/src/deep-link.ts` — [ID] the one sanctioned scheme-literal site
- `apps/web/src/strings.ts`, `apps/web/src/strings-detector-lint.spec.ts`
- `apps/web/src/marketing/landing-content.ts`, `apps/web/src/marketing/landing-content.spec.ts`, `apps/web/src/marketing/render.spec.tsx` (**`FORBIDDEN_DISPLAY_NAME` + `BARE_SCHEME_LITERAL` regex**), `apps/web/src/marketing/links.spec.ts`, `apps/web/src/marketing/build-output.spec.ts`
- `apps/web/src/food/page-model.ts`, `apps/web/src/food/page-model.spec.ts`, `apps/web/src/food/params.ts`, `apps/web/src/food/params.spec.ts`, `apps/web/src/food/render.spec.tsx`, `apps/web/src/food/build-output.spec.ts`
- `apps/web/src/legal/legal-content.spec.ts`
- `apps/web/src/observability/options.ts`, `apps/web/src/observability/options.spec.ts`
- `apps/web/src/components/vet-disclaimer.tsx`, `apps/web/src/components/marketing/site-footer.tsx`, `apps/web/src/components/food/app-store-cta.tsx`, `apps/web/src/components/food/emergency-hotline-cta.tsx`
- `apps/web/src/e2e/e2e-gate.spec.ts` — [ID] **pins the CI string `pnpm --filter @pawcareright/web test:e2e` — must change in lockstep with `ci.yml`**
- `apps/web/e2e/smoke.spec.ts` — [ID] **incl. the `execFileSync` child-process script's `require("@pawcareright/types")` specifier (loader workaround)**
- `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`, `apps/web/app/privacy/page.tsx`, `apps/web/app/terms/page.tsx`, `apps/web/app/can-dogs-eat/[item]/page.tsx`, `apps/web/app/can-cats-eat/[item]/page.tsx`

### `docs/` (non-protected only)
`docs/PRODUCT_SPEC.md`, `docs/PRODUCT_OVERVIEW.md`, `docs/ARCHITECTURE.md`, `docs/DEV_SETUP.md`, `docs/PERFORMANCE.md`, `docs/design-system.md`, `docs/store-setup.md`, `docs/store-privacy.md`, `docs/adr/0001-mobile-tls-certificate-pinning.md`, `docs/qa/regression-gate.md`, `docs/qa/billing-sandbox-checklist.md`, `docs/qa/a11y-script.md`, `docs/security/mobile-storage-audit.md`

### `loop/` (bookkeeping — scope-exempt from gate_exec, still listed)
- `loop/loop-state.json` — set `"project": "Bombay Pet Company"`, `"slug": "bombaypetcompany"`, `"bundleId": "com.bombaypetcompany.app"`. **Do NOT touch historical `tasks`/`note` entries.**
- `loop/journal.md` — append the REBRAND-1 iteration entry (new text only; never rewrite history).

---

## Ordered steps

**Step 0 — pre-flight.**
```
cd /home/user/Paw-Care-Right
service postgresql start; service redis-server start
git status --porcelain            # expect a clean tree before starting
git ls-files | grep -v '^loop/' | xargs grep -l -iE 'pawcareright|paw care right' | wc -l   # baseline
```

**Step 1 — brand source of truth.** `packages/config/src/constants.ts`:
```ts
export const APP_DISPLAY_NAME = "Bombay Pet Company" as const; // EXACT: three words, single spaces, NO trailing "+"
export const APP_SLUG = "bombaypetcompany" as const;
export const BUNDLE_ID = "com.bombaypetcompany.app" as const;
export const DEEPLINK_SCHEME = "bombaypetcompany" as const; // scheme name only (no "://")
```
Rewrite the line-1 trailing comment — the current one describes the `+`.

**Step 2 — env schemas & defaults.** `apps/api/src/config/env.schema.ts` (DATABASE_URL, APPLE_CLIENT_ID, GOOGLE_CLIENT_ID, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET), `packages/ai/src/env.schema.ts`, `.env.example`.

**Step 3 — package manifests.** Rename `"name"` in root `package.json` and all 8 workspace `package.json` files; rename every `@pawcareright/*` dependency key; rename the 3 jest `moduleNameMapper` keys in `apps/api/package.json`.

**Step 4 — import rewrites + tsconfig paths.** Global lowercase-token replace (see "Replace strategy"), which simultaneously fixes: every `import … from "@pawcareright/…"`, `packages/config/tsconfig.base.json` `paths`, `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json`, `apps/api/prisma/seed/tsconfig.json`, every `tsconfig*.json` `"extends": "@pawcareright/config/tsconfig.base.json"`, every `eslint.config.mjs`, both `tailwind.config.*`, `apps/web/next.config.mjs` `transpilePackages`.

**Step 5 — CI + tooling configs.** `.github/workflows/ci.yml` (postgres env + health-cmd, DATABASE_URL, MinIO creds, Sentry org/project/version, all four `--filter @pawcareright/web`), `apps/web/lighthouserc.json`, `apps/mobile/scripts/measure-cold-start.sh`. **Update `apps/web/src/e2e/e2e-gate.spec.ts` in the same step** — it string-pins `pnpm --filter @pawcareright/web test:e2e` against `ci.yml`; drift = red suite.

**Step 6 — infra files.** `docker-compose.yml` (postgres user/password/db + healthcheck, MinIO root creds, `mc mb local/bombaypetcompany-media`).

**Step 7 — local infra migration.** Run "Local infra migration" below (new postgres role+db, migrate, restart MinIO with new creds + bucket, optional Redis flush, re-seed). Do this BEFORE any api test run.

**Step 8 — app identity.** `apps/mobile/app.config.js` (name/slug/scheme/bundle already derive from the constants; still fix the `require("@bombaypetcompany/config")` specifier, `termsUrl`/`privacyUrl` domain, EAS-slug comment, Sentry org/project fallbacks). `apps/web/src/site.ts`, `apps/web/src/deep-link.ts`.

**Step 9 — runtime identifier constants.** Redis prefixes (`apps/api/src/auth/auth.constants.ts`, `apps/api/src/quota/quota.constants.ts`, `apps/api/src/abuse/abuse.constants.ts`, `apps/api/src/breeds/breeds.service.ts`, `apps/api/src/workers/push-sender.service.ts`), all nine `*.contract.ts` queue names, `packages/analytics/src/sentry/options.ts` release template, `packages/api-client/src/mmkv-persister.ts`, `apps/mobile/src/auth/secure-store.ts`, all mobile Zustand `name: "pawcareright.*"` persisted-store keys.

**Step 10 — seeds & fixtures.** `apps/api/prisma/seed.ts`, `apps/api/prisma/seed/constants.ts`, `apps/api/prisma/seed/README.md`, seed builders, `apps/api/test/global-setup.ts`, `apps/api/test/load/checks-load-sanity.ts`.

**Step 11 — pinned tests.** Update every assertion/test-title that string-pins the old brand:
`apps/mobile/__tests__/no-pawsaathi-branding.test.ts` (`expect(APP_DISPLAY_NAME).toBe("Bombay Pet Company")`), `apps/mobile/__tests__/storage-audit.test.ts` (`STORE_NAME_PATTERN`, `EXPECTED_PERSISTED_STORE_NAMES`, synthetic fixtures, SecureStore assertions, the two `it(...)` titles that name `pawcareright.`), `apps/api/src/workers/ai-audit-retention.service.spec.ts` (queue pin + `it("is the pawcareright-prefixed queue name")`), `apps/api/src/quota/quota.service.spec.ts`, `apps/api/src/workers/push-sender.service.spec.ts`, `apps/api/src/breeds/breeds.service.spec.ts`, `apps/api/src/households/households.service.spec.ts`, `apps/api/test/auth.e2e-spec.ts`, `apps/api/test/households.e2e-spec.ts`, `apps/api/test/auth-social.e2e-spec.ts`, `apps/api/test/secret-scan.spec.ts`, `apps/api/test/photos-presign-fuzz.e2e-spec.ts`, `packages/analytics/src/sentry/options.spec.ts`, `packages/types/src/household.spec.ts`, `apps/web/src/marketing/render.spec.tsx`, `apps/web/src/strings-detector-lint.spec.ts`, `apps/mobile/__tests__/strings-detector-lint.test.ts`, `apps/mobile/__tests__/chat-strings-tone.test.ts`, `apps/mobile/__tests__/family-screen.test.tsx`.

> In `apps/web/src/marketing/render.spec.tsx`, `FORBIDDEN_DISPLAY_NAME` is deliberately built as `["Paw Care Right", "+"].join(" ")` so the literal never appears in the file that scans for it. **Preserve that trick** — use e.g. `["Bombay", "Pet", "Company"].join(" ")`. Also update `BARE_SCHEME_LITERAL` to `` /["'`]bombaypetcompany["'`]/ `` and its explanatory comment.

**Step 12 — user-facing copy.** `apps/mobile/src/strings.ts`, `apps/web/src/strings.ts`, `apps/api/src/chat/chat.service.ts` + `apps/api/src/chat/chat.controller.ts` ("Ask Paw Care Right + is a premium feature." → "Ask Bombay Pet Company is a premium feature."), `packages/types/src/*copy*.ts`. Verify no component gained a hardcoded display name — it must still arrive via `APP_DISPLAY_NAME`.

**Step 13 — docs.** All files in the `docs/` group above + `README.md` + root `AI_PROVIDERS.md`.

**Step 14 — loop bookkeeping.** `loop/loop-state.json` three fields; append to `loop/journal.md`.

**Step 15 — lockfile.** `pnpm i` (regenerates `pnpm-lock.yaml` under the new package names). **Never hand-edit the lockfile.** Confirm `prisma generate` ran via api `postinstall`; if not, run `pnpm --filter @bombaypetcompany/api prisma:generate`.

**Step 16 — snapshot rebaseline.**
```
timeout 900 pnpm --filter mobile test -- -u > /tmp/mobile-snap.log 2>&1; echo EXIT=$?
git diff --stat apps/mobile/__tests__/__snapshots__/
git diff apps/mobile/__tests__/__snapshots__/ | grep -E '^[-+]' | grep -v '^[-+][-+]' \
  | grep -viE 'paw care right|bombay pet company'
```
The last command MUST print nothing — every snapshot delta must be a display-name-string-only change.

**Step 17 — full gates.** See "Commands to run to self-verify".

**Step 18 — survivor scan.** See "Verification gate".

---

## Replace strategy (per string class)

Apply in this exact order, over the file set listed above only. Never repo-wide-blind.

| # | Pattern | Replacement | Notes |
|---|---|---|---|
| 1 | `Paw Care Right +` | `Bombay Pet Company` | **MUST run before rule 2**, else you get `Bombay Pet Company +`. Source uses a single space before `+`. |
| 2 | `Paw Care Right` | `Bombay Pet Company` | bare occurrences + any rule-1 remnants |
| 3 | `PawCareRight` | `BombayPetCompany` | safety net; expected 0 hits |
| 4 | `paw-care-right` / `paw_care_right` / `PAW_CARE_RIGHT` | `bombay-pet-company` / `bombay_pet_company` / `BOMBAY_PET_COMPANY` | safety net; expected 0 hits **except** absolute paths containing the checkout dir `/home/user/Paw-Care-Right` — see Forbidden zones |
| 5 | `pawcareright` | `bombaypetcompany` | single lowercase-token rule; subsumes `@pawcareright/`, `com.pawcareright.app`, `pawcareright://`, `pawcareright-media`, `pawcareright:quota:`, `pawcareright.app`, `pawcareright.auth.*`, `*@pawcareright.local`, `pawcareright-dev-secret`, `pawcareright-dev.apps.googleusercontent.com` |

Per-file mechanism:
```
sed -i -e 's/Paw Care Right +/Bombay Pet Company/g' \
       -e 's/Paw Care Right/Bombay Pet Company/g' \
       -e 's/PawCareRight/BombayPetCompany/g' \
       -e 's/pawcareright/bombaypetcompany/g' <FILE>
```
Batched form over the tracked, non-exempt set:
```
git ls-files \
  | grep -vE '^(loop/|\.claude/|CLAUDE\.md$|LOOP_PROTOCOL\.md$|docs/(PHASES|MODEL_STRATEGY|AI_PROVIDERS|OTA_UPDATES)\.md$|pnpm-lock\.yaml$)' \
  | xargs grep -l -E 'pawcareright|Paw Care Right|PawCareRight' \
  | xargs sed -i -e 's/Paw Care Right +/Bombay Pet Company/g' \
                 -e 's/Paw Care Right/Bombay Pet Company/g' \
                 -e 's/PawCareRight/BombayPetCompany/g' \
                 -e 's/pawcareright/bombaypetcompany/g'
git diff --stat | tail -5      # eyeball the file count IMMEDIATELY
```
After the batch, hand-review the Step 11/12 files — several need a semantic edit beyond the token swap (dropping the `+` from prose, the `FORBIDDEN_DISPLAY_NAME` join trick, test titles).

### Blind global sed is FORBIDDEN in:
- `.git/` — never
- `loop/journal.md`, `loop/reviews/**`, `loop/plans/**` (including this plan file), `loop/eval-reports/**`, `loop/KICKOFF_PROMPT.md` — historical/immutable records; old brand strings stay
- `node_modules/`, `dist/`, `.next/`, `.expo/`, `.turbo/`, `coverage/` — all gitignored
- `pnpm-lock.yaml` — regenerated by `pnpm i` only
- `CLAUDE.md`, `LOOP_PROTOCOL.md`, `docs/PHASES.md`, `docs/MODEL_STRATEGY.md`, `docs/AI_PROVIDERS.md`, `docs/OTA_UPDATES.md`, `.claude/**` — hook-protected
- The checkout directory name `/home/user/Paw-Care-Right` — **do NOT rename it.** It is not a product identifier; renaming breaks every absolute path, the running services, and the git worktree.

---

## Local infra migration

**Postgres** — create a new role/db; do NOT rename in place:
```
service postgresql start
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE bombaypetcompany LOGIN PASSWORD 'bombaypetcompany';"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE bombaypetcompany OWNER bombaypetcompany;"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d bombaypetcompany -c "GRANT ALL ON SCHEMA public TO bombaypetcompany;"
export DATABASE_URL='postgresql://bombaypetcompany:bombaypetcompany@localhost:5432/bombaypetcompany?schema=public'
timeout 300 pnpm --filter @bombaypetcompany/api prisma:migrate:dev > /tmp/migrate.log 2>&1; echo EXIT=$?
timeout 300 pnpm --filter @bombaypetcompany/api prisma:seed    > /tmp/seed.log    2>&1; echo EXIT=$?
```
The old `pawcareright` role/db stay intact — harmless, and a rollback path.

**Redis** — no migration needed; all keys are ephemeral dev state under the old prefix. Optional cleanup:
```
service redis-server start
redis-cli --scan --pattern 'pawcareright:*' | xargs -r redis-cli del
```

**MinIO** — new root creds + new bucket. Stop the old process, pre-create the bucket as a directory in the filesystem backend, restart:
```
pkill -f 'minio server' || true
mkdir -p /tmp/minio-data/bombaypetcompany-media
MINIO_ROOT_USER=bombaypetcompany MINIO_ROOT_PASSWORD=bombaypetcompany-dev-secret \
  nohup /var/lib/docker/containerd/daemon/io.containerd.snapshotter.v1.overlayfs/snapshots/6/fs/usr/bin/minio \
  server /tmp/minio-data --console-address :9001 > /tmp/minio.log 2>&1 &
sleep 3; curl -sf http://localhost:9000/minio/health/live && echo MINIO_OK
```
If a photos suite still reports a missing bucket, confirm `/tmp/minio-data/bombaypetcompany-media` exists and that the server was (re)started AFTER the `mkdir`.

---

## Tests to write (map to acceptance criteria)

No new test files. Every AC maps to an existing suite whose pinned strings this task updates.

| AC | Test (name / file) | What it asserts |
|---|---|---|
| AC1 display name is exactly `Bombay Pet Company` | `apps/mobile/__tests__/no-pawsaathi-branding.test.ts` — "APP_DISPLAY_NAME is the exact locked display name" | `expect(APP_DISPLAY_NAME).toBe("Bombay Pet Company")`; no trailing `+` |
| AC2 display name never hardcoded in components | `apps/web/src/marketing/render.spec.tsx` — "no hardcoded display name or deep-link scheme (§1a)"; `apps/mobile/__tests__/strings-detector-lint.test.ts`; `apps/web/src/strings-detector-lint.spec.ts` | walks `src`/`app`, fails on any non-spec file containing the display-name literal or a bare quoted scheme token |
| AC3 rendered title comes from the constant | `apps/mobile/__tests__/app-title.test.tsx` — "renders the product display name from the shared constant" | `getByText(APP_DISPLAY_NAME)`; passes unchanged, proving single-sourcing |
| AC4 deep-link scheme renamed everywhere | `apps/api/test/households.e2e-spec.ts`; `apps/api/src/households/households.service.spec.ts`; `packages/types/src/household.spec.ts`; `apps/mobile/__tests__/family-screen.test.tsx`; `apps/mobile/__tests__/join-route.test.tsx` | invite deep link is `bombaypetcompany://join/<code>` |
| AC5 Redis prefixes renamed | `apps/api/src/quota/quota.service.spec.ts`; `apps/api/test/auth.e2e-spec.ts`; `apps/api/src/breeds/breeds.service.spec.ts`; `apps/api/src/workers/push-sender.service.spec.ts` | keys are `bombaypetcompany:quota:*`, `:otp:`, `:rl:otp:`, `:breeds:`, `:push:collapse:` |
| AC6 queue names renamed | `apps/api/src/workers/ai-audit-retention.service.spec.ts` — "is the bombaypetcompany-prefixed queue name" | `AI_AUDIT_RETENTION_QUEUE === "bombaypetcompany-ai-audit-retention"` |
| AC7 Sentry release shape | `packages/analytics/src/sentry/options.spec.ts`; `apps/api/src/observability/sentry.spec.ts`; `apps/mobile/__tests__/sentry.test.ts`; `apps/web/src/observability/options.spec.ts` | `buildSentryRelease` yields `bombaypetcompany@{version}+{buildId}` |
| AC8 mobile storage keys renamed | `apps/mobile/__tests__/storage-audit.test.ts` — "the set of MMKV-persisted store names is pinned…" + "SecureStore keys are the two documented token keys" | every persisted name starts `bombaypetcompany.`; SecureStore keys are `bombaypetcompany.auth.accessToken` / `.refreshToken` |
| AC9 dev/local secret fixtures still not flagged | `apps/api/test/secret-scan.spec.ts`; `apps/api/test/photos-presign-fuzz.e2e-spec.ts` | `bombaypetcompany` / `bombaypetcompany-dev-secret` placeholders pass the scanner; presigned URLs leak no secret |
| AC10 canonical/site URL renamed | `apps/web/src/marketing/links.spec.ts`; `apps/web/src/marketing/build-output.spec.ts`; `apps/web/src/food/build-output.spec.ts`; `apps/web/src/legal/legal-content.spec.ts` | canonical URLs are `https://bombaypetcompany.app/...` |
| AC11 CI job pins stay consistent | `apps/web/src/e2e/e2e-gate.spec.ts` — "contains a web-e2e: job that runs pnpm --filter …/web test:e2e" | `ci.yml` contains `pnpm --filter @bombaypetcompany/web test:e2e`, unconditional |
| AC12 safety copy intact after rename | `apps/mobile/__tests__/check-result-snapshot.test.tsx`; `chat-screen-snapshot.test.tsx`; `breed-guide-sections.test.tsx`; `paywall-snapshot.test.tsx`; `apps/mobile/__tests__/paywall-emergency-safety.test.tsx`; `packages/types/src/vet-disclaimer-copy.spec.ts`; `packages/ai/src/evals/medication-copy-safety.spec.ts` | `<VetDisclaimer/>` still renders; disclaimer / emergency-interstitial / medication copy byte-identical apart from the product name |
| AC13 workspace graph resolves under the new scope | `pnpm typecheck` + `pnpm build` across all 8 workspaces | no unresolved `@bombaypetcompany/*` specifier; jest moduleNameMapper + tsconfig paths align |
| AC14 AI safety evals still pass | `pnpm test:ai-evals` (golden-set + redteam-set) | thresholds unchanged; no safety regression |

---

## Commands to run to self-verify

```
service postgresql start; service redis-server start   # infra can lapse
timeout 900 pnpm i                                     > /tmp/install.log 2>&1; echo EXIT=$?
timeout 900 pnpm typecheck                             > /tmp/tc.log      2>&1; echo EXIT=$?
timeout 900 pnpm lint                                  > /tmp/lint.log    2>&1; echo EXIT=$?
timeout 900 pnpm build                                 > /tmp/build.log   2>&1; echo EXIT=$?
timeout 900 pnpm test                                  > /tmp/test.log    2>&1; echo EXIT=$?
timeout 600 pnpm --filter api test                     > /tmp/api.log     2>&1; echo EXIT=$?
timeout 900 pnpm --filter mobile test                  > /tmp/mob.log     2>&1; echo EXIT=$?
timeout 900 pnpm --filter @bombaypetcompany/web test   > /tmp/web.log     2>&1; echo EXIT=$?
timeout 900 pnpm test:ai-evals                         > /tmp/evals.log   2>&1; echo EXIT=$?
```

### Verification gate — final survivor scan
```
git ls-files | xargs grep -l -iE 'pawcareright|paw care right' | sort
```
Must return **only** these (the exemption allowlist):
```
CLAUDE.md
LOOP_PROTOCOL.md
docs/AI_PROVIDERS.md
docs/MODEL_STRATEGY.md
docs/OTA_UPDATES.md
docs/PHASES.md
.claude/agents/checker.md
.claude/agents/checker.opus.md
.claude/agents/executor.md
.claude/agents/planner.md
.claude/agents/planner.opus.md
.claude/skills/emulator-test/SKILL.md
loop/KICKOFF_PROMPT.md
loop/journal.md
loop/loop-state.json          (historical task notes only — the 3 live fields MUST be new)
loop/eval-reports/…           (any)
loop/plans/…                  (any, incl. loop/plans/REBRAND-1.plan.md)
loop/reviews/…                (any)
```
Anything else is a defect. `docs/security/audit-allowlist.json` was checked and contains **no** brand strings — it needs no entry.

Also assert the new brand actually landed:
```
git ls-files | xargs grep -l 'bombaypetcompany' | wc -l          # expect ~690-710
grep -c 'Bombay Pet Company' packages/config/src/constants.ts    # expect 1
git ls-files | xargs grep -n 'Bombay Pet Company +' | wc -l      # MUST be 0
```

---

## Interfaces/contracts the executor must match

- `packages/config/src/constants.ts` keeps exactly these export names and `as const` types: `APP_DISPLAY_NAME`, `APP_SLUG`, `BUNDLE_ID`, `DEEPLINK_SCHEME`. No new export, no signature change.
- `buildSentryRelease(version: string, buildId: string): string` → `` `bombaypetcompany@${safeVersion}+${safeBuildId}` ``. The SHAPE (`slug@version+build`) is unchanged; only the slug changes.
- Every `*_QUEUE` / `*_KEY_PREFIX` constant keeps its identifier name and type; only the string value changes.
- `vetDisclaimerLine(appName: string)` and all `(appName: string) => …` copy factories keep taking the name as a parameter — never inline the new name.
- `apps/mobile/app.config.js` keeps deriving `name` / `slug` / `scheme` / `ios.bundleIdentifier` / `android.package` from the config constants — never hardcode.
- `strict` + `exactOptionalPropertyTypes` TypeScript everywhere; no `any`, no unjustified `@ts-ignore`, no `console.log`.

---

## Out of scope / do NOT touch

- **Hook-protected paths**: `CLAUDE.md`, `LOOP_PROTOCOL.md`, `docs/PHASES.md`, `docs/MODEL_STRATEGY.md`, `docs/AI_PROVIDERS.md`, `docs/OTA_UPDATES.md`, `.claude/**`. Orchestrator-applied or documented exemptions. **Do not circumvent the hook via Bash/sed/tee.**
- `loop/journal.md` history, `loop/reviews/**`, `loop/plans/**` (prior tasks), `loop/eval-reports/**`, `loop/KICKOFF_PROMPT.md`, git history — historically accurate records; old brand strings stay.
- Hand edits to `pnpm-lock.yaml`.
- Renaming the checkout directory `/home/user/Paw-Care-Right`.
- `extra.eas.projectId` UUID and `owner: "mukbisens-team"` in `apps/mobile/app.config.js`.
- Actually creating the EAS project / Sentry projects / DNS for `bombaypetcompany.app`; performing the T102 trademark check (note it, do not do it).
- Any data migration of existing Postgres rows, S3 objects, or on-device storage (pre-beta; no users).
- Any behavioural, UI, dependency, or copy change beyond substituting the product name. No new features, no refactors, no new packages.
- **Safety surfaces (PRODUCT_SPEC §5)**: disclaimer text, emergency-interstitial ordering, region hotline numbers, dosing prohibitions, safe-fallback copy. Only the product-name token inside them may change; every other word stays byte-identical.

---

## Orchestrator-applied edits (EXECUTOR MUST SKIP — apply verbatim at finalize)

### `CLAUDE.md` line 1
```
# CLAUDE.md — Bombay Pet Company Project Constitution
```

### `CLAUDE.md` §1 — replace line 9 with
```
**Bombay Pet Company** (trademark check is task T102) is a B2C mobile-first AI pet care companion: a "pocket vet + pet life manager" for dog and cat owners worldwide.
```

### `CLAUDE.md` §1a — replace the section body (heading line unchanged) with
```
The product's **display name** is exactly `Bombay Pet Company` (three words, single spaces, no suffix). This string is used **only** in user-facing surfaces: store listings, the app's on-screen title, marketing/legal copy, push-notification sender name, and email. Wherever the display name is rendered, it comes from **one constant** (`APP_DISPLAY_NAME` in `packages/config`) — never hardcode it in components.

Spaces are **illegal or unsafe** in identifiers, so everywhere that isn't user-facing prose uses these fixed technical derivatives — never invent new ones:

| Context | Value |
|---|---|
| npm/repo/workspace name, monorepo root | `bombaypetcompany` |
| iOS/Android bundle id | `com.bombaypetcompany.app` |
| Deep-link scheme | `bombaypetcompany://` |
| S3 bucket, Redis prefixes, queue names | `bombaypetcompany-*` |
| Sentry release | `bombaypetcompany@{version}+{updateId}` |
| Web domain (placeholder until T102) | `bombaypetcompany.app` |
| EAS project slug | `bombaypetcompany` |

Rule: if a value goes into code, config, a URL, a package manifest, or an id → use `bombaypetcompany` (or `com.bombaypetcompany.app`). If it's shown to a human as the product's name → use `Bombay Pet Company` via the shared constant. The final store name + bundle ids are confirmed at the **C3 checkpoint** after the T102 trademark pass; treat both as provisional until then.
```

### `CLAUDE.md` §4 — first line of the repo-layout fence
```
bombaypetcompany/
```

### Not authorized / leave as-is
`docs/PHASES.md` task text, `LOOP_PROTOCOL.md`, `docs/MODEL_STRATEGY.md`, `docs/AI_PROVIDERS.md`, `docs/OTA_UPDATES.md`, `.claude/**`, `loop/KICKOFF_PROMPT.md` — documented exemptions on the survivor allowlist. **Flag to the founder:** `docs/OTA_UPDATES.md §7` pins the Sentry release slug and `docs/PHASES.md` T102/T099 cards name the old brand — both will read stale until separately authorized.

---

## Executor warnings (from the loop ledger — read before starting)

1. **api jest single-file invocations HANG.** Always run the full parallel suite: `timeout 600 pnpm --filter api test > /tmp/log 2>&1; echo EXIT=$?`. Never `pnpm --filter api test -- path/to/one.spec.ts`.
2. **Mutation-proof discipline.** Any proof needing a temporary source mutation must be ONE atomic Bash invocation: backup + `sha1sum` → mutate → verify-applied → run test → restore → `sha1sum` re-verify. **Never `git checkout` on the uncommitted tree** — it would destroy the whole rebrand.
3. **Infra can lapse mid-run.** Re-run `service postgresql start; service redis-server start` and re-check MinIO health before each api suite. MinIO binary: `/var/lib/docker/containerd/daemon/io.containerd.snapshotter.v1.overlayfs/snapshots/6/fs/usr/bin/minio`; new creds `MINIO_ROOT_USER=bombaypetcompany MINIO_ROOT_PASSWORD=bombaypetcompany-dev-secret`; `server /tmp/minio-data --console-address :9001`.
4. **`.claude/hooks/gate_exec.sh` secret-scans added diff lines.** No `AKIA…` / `sk-ant-…` lookalike fixtures. The `bombaypetcompany-dev-secret` placeholder is low-entropy and already passes — keep it in that shape.
5. **Snapshot rebaselines must be name-string-only deltas.** The checker diffs them. Run the Step 16 grep and paste its (empty) output as evidence.
6. **The web Playwright loader defect**: `@pawcareright/types` resolves to 0 keys under the e2e loader; the workaround spawns a `node -e` child process in `apps/web/e2e/smoke.spec.ts`. **That spawned script's `require("@pawcareright/types")` sits inside a template string — sed will catch it, but verify it explicitly**, otherwise the E2E gate fails at runtime with a resolution error rather than a type error.
7. **`exactOptionalPropertyTypes` strict TS everywhere; no `any`.**
8. **`gate_exec.sh` scope check** requires every changed path to appear literally in this plan. The list above is exhaustive — if you find a file needing a change that is NOT listed, STOP and report rather than editing it.
9. Run the batched `sed` from the repo root with the exclusions exactly as written, then `git diff --stat` immediately and eyeball the file count before anything else.

---

## Risks & the decisions the planner made (for the checker to scrutinize)

**D1 — Single lowercase-token rule.** One `s/pawcareright/bombaypetcompany/g` rule instead of per-context rules, because every identifier context derives from that token. *Risk*: a coincidental substring gets rewritten. I grepped all 719 matching files; every occurrence is brand-derived. Checker should spot-check `packages/ai/src/evals/drug-names.ts` and `packages/data/src/toxins/*` — data files where a false positive would be worst.

**D2 — Ordered display-name rules (`Paw Care Right +` before `Paw Care Right`).** *Risk*: reversed, the output is `Bombay Pet Company +`, contradicting the locked "no trailing +" decision, and it would silently pass almost everything (only `no-pawsaathi-branding.test.ts` pins the exact string). Checker must require zero hits for `Bombay Pet Company +`.

**D3 — New Postgres role/db instead of an in-place rename.** Chosen because the services are running with live connections: `ALTER ROLE … RENAME` invalidates the md5 password and `ALTER DATABASE … RENAME` fails while sessions are open. *Risk*: two roles/dbs now exist locally; CI is unaffected (fresh container). Acceptable and reversible.

**D4 — Renaming mobile persisted-store and SecureStore keys.** This orphans on-device data and force-logs-out any existing dev install. Chosen for §1a consistency ("from titles to small details") and because there are no real users pre-beta. *Risk*: a dev tester silently loses local state. The alternative (keep old keys) was rejected — it leaves the old brand in shipped code. Checker should confirm this reading of the card.

**D5 — Checkout directory NOT renamed.** `/home/user/Paw-Care-Right` stays. *Risk*: cosmetic inconsistency. The directory name is not a product identifier and renaming it would break absolute paths, running services, and the git worktree mid-task.

**D6 — `extra.eas.projectId` UUID left unchanged.** It is an EAS-server-assigned id, not a brand string; changing it would point the app at a nonexistent project. The EAS *slug* does change (via `APP_SLUG`), which means the EAS project must be re-created or renamed server-side at T099/T116 — noted, not done here.

### Top 5 ways this breaks
1. **Lockfile / workspace-graph desync.** Renaming `@pawcareright/*` in manifests without `pnpm i` leaves `node_modules` symlinks pointing at the old names; `pnpm typecheck` then fails with hundreds of unresolved-module errors that look like real defects. *Mitigation*: Step 15 before any gate.
2. **jest `moduleNameMapper` / tsconfig `paths` drift.** `apps/api/package.json`'s three mapper keys are anchored regexes (`^@pawcareright/config$`) and five files carry `paths`. Miss one and only the api suite fails, at runtime. *Mitigation*: after Step 4 run `grep -rn 'pawcareright' --include='*.json' apps packages` and expect zero.
3. **CI-pinning test drift.** `apps/web/src/e2e/e2e-gate.spec.ts` reads `.github/workflows/ci.yml` and asserts the exact filter string. Renaming one without the other is a green local run and a red CI. *Mitigation*: Step 5 edits both together.
4. **Postgres/MinIO not migrated before api tests.** `global-setup.ts` falls back to the new DATABASE_URL; if the `bombaypetcompany` role/db/bucket does not exist, the entire api suite fails with a connection error that looks like a code defect and invites wrong fixes. *Mitigation*: Step 7 strictly before Step 17.
5. **Snapshot rebaseline scope creep.** `-u` regenerates snapshots wholesale; unrelated rendering drift gets baked in and the checker rejects the diff. *Mitigation*: Step 16's grep must print nothing; if it prints anything, revert the snapshot files and investigate before re-running.

---

## STATUS: COMPLETE
