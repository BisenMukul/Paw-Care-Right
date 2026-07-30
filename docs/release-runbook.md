# Release runbook — Bombay Pet Company (mobile)

Started at T099 (EAS build profiles + signing setup). TestFlight/Play execution
is T101; store assets (icons/splash/screenshots) are T100; the final display
name / bundle id decision lands at the **C3** checkpoint after T102's
trademark pass — everything below marked "provisional" depends on that.

## 1. Identifiers & provisional values

| Item | Value | Status |
|---|---|---|
| Display name | `Bombay Pet Company` (via `APP_DISPLAY_NAME` in `packages/config`) | provisional until T102/C3 |
| App slug | `bombaypetcompany` | provisional until T102/C3 |
| Bundle id (iOS + Android) | `com.bombaypetcompany.app` | provisional until T102/C3 |
| EAS project slug | `bombaypetcompany` | provisional until T102/C3 (current `extra.eas.projectId` is a pre-rebrand project — see §9) |
| Marketing version source | `apps/mobile/app.config.js` → `version` | authoritative |

## 2. Prerequisites (founder, one-time)

1. Expo account with access to the project; run `npx eas-cli@latest login` locally, or set `EXPO_TOKEN` as a CI secret for non-interactive builds.
2. Apple Developer Program membership + an App Store Connect app record for `com.bombaypetcompany.app`.
3. Google Play Console app record + a service-account JSON key for automated submission (store it outside the repo — see `.gitignore`'s T099 signing-material block; never commit `google-play-service-account*.json`).
4. `eas init` against a **new** `bombaypetcompany`-slugged EAS project, then paste the server-assigned `projectId` into `apps/mobile/app.config.js` (`extra.eas.projectId`) — see §9 item 1.
5. `eas credentials` to let EAS manage iOS signing (certificates/profiles) and the Android keystore. Both build profiles that need signing use `credentialsSource: "remote"` (see `eas.json`), so EAS is the source of truth for signing material — nothing signing-related is ever committed to this repo.

## 3. Build profiles

| Profile | Distribution | Channel | Android buildType | Audience |
|---|---|---|---|---|
| `development` | internal | `development` | apk | local dev-client builds, simulator/device |
| `preview` | internal | `preview` | app-bundle | internal QA / TestFlight-internal / Play internal track |
| `production` | store | `production` | app-bundle | public store submission |

These match `apps/mobile/eas.json` exactly; the drift-guard test in
`apps/mobile/__tests__/release-runbook-doc.test.ts` fails if a profile is
added to `eas.json` without a matching row here.

## 4. Environment variables per profile

`eas.json env` blocks hold **public, non-secret** values only. Anything
account-specific or secret (API keys, DSNs, client ids) is created as an
**EAS environment variable** scoped to the matching `environment` field
(`development` | `preview` | `production`) and is never written to this repo.

| Variable | development | preview | production | Where it lives |
|---|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://localhost:3000` | `https://staging-api.bombaypetcompany.app` | `https://api.bombaypetcompany.app` | `eas.json env` (public) |
| `EXPO_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` | `https://us.i.posthog.com` | `https://us.i.posthog.com` | `eas.json env` (public) |
| `EXPO_PUBLIC_TERMS_URL` | app.config default | `https://bombaypetcompany.app/terms` | `https://bombaypetcompany.app/terms` | `eas.json env` (public) |
| `EXPO_PUBLIC_PRIVACY_URL` | app.config default | `https://bombaypetcompany.app/privacy` | `https://bombaypetcompany.app/privacy` | `eas.json env` (public) |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | — | per-environment | per-environment | EAS environment variables (secret) |
| `EXPO_PUBLIC_RC_IOS_KEY` | — | per-environment | per-environment | EAS environment variables (secret) |
| `EXPO_PUBLIC_RC_ANDROID_KEY` | — | per-environment | per-environment | EAS environment variables (secret) |
| `EXPO_PUBLIC_POSTHOG_KEY` | — | per-environment | per-environment | EAS environment variables (secret) |
| `EXPO_PUBLIC_SENTRY_DSN` | — | per-environment | per-environment | EAS environment variables (secret) |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | — | build secret | build secret | EAS environment variables (secret; source-map upload only) |

RevenueCat keys must **not** be set to an empty string — `app.config.js`'s
`?? "stub_..."` fallback only triggers on `undefined`, so an empty string
would reach `Purchases.configure()` with a bad key. Sentry/PostHog empty
values are already the intended stub-safe default (T089).

Example (never a real value — `<dsn>` is a literal placeholder token):

```
eas env:create --scope project --environment preview --name EXPO_PUBLIC_SENTRY_DSN --type sensitive --value <dsn>
```

## 5. Versioning

- Marketing `version` (e.g. `1.0.0`) is hand-bumped in `apps/mobile/app.config.js` per release train.
- iOS `buildNumber` / Android `versionCode` are **remote** (`eas.json` `cli.appVersionSource: "remote"`) and auto-incremented by EAS on every build where the profile sets `autoIncrement: true` (`preview`, `production`).
- Inspect or set the remote counters directly with `eas build:version:get` / `eas build:version:set` if a manual correction is ever needed.
- Sentry release contract (T089, unchanged by this task): `bombaypetcompany@{version}+{buildId}`, built by `buildSentryRelease(getAppVersion(), config.gitSha)`. `{version}` is `app.config.js`'s marketing `version`; `{buildId}` is `gitSha` (see §7 fallback chain).
- CI (`.github/workflows/ci.yml`) already reads a GitHub repo variable `APP_VERSION` for its own release-tagging; once a release train bumps the marketing version, set the matching GitHub repo variable `APP_VERSION` to the same value so the two stay in lockstep (see §9 founder to-do).

## 6. Build → submit

```
npx eas-cli@latest build --profile preview --platform all
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --profile production --platform ios
npx eas-cli@latest submit --profile production --platform android
```

- `submit --profile production --platform android` publishes to the Play
  `internal` track (see `eas.json` `submit.production.android.track`).
- `eas submit` will interactively prompt for `ascAppId` / `appleTeamId` (iOS)
  and the Play service-account key path (Android) — these are intentionally
  **absent** from `eas.json` because they are founder/console values that
  must never be invented or hardcoded.
- Pin the eas-cli major version you actually used for a release in this
  runbook's revision history (or the release PR) so builds stay reproducible;
  this repo does not add `eas-cli` as a dependency (see §8/§9 rationale).

## 7. OTA updates

Reference only — channel model, runtime-version policy, staged rollout,
rollback, and publish safety gates are defined in `docs/OTA_UPDATES.md`
(§1, §6, §8) and implemented in T113–T118; this runbook does not restate
them.

Profile ↔ channel mapping: `development` → `development`, `preview` →
`preview`, `production` → `production` (same names, per `eas.json`).

```
npx eas-cli@latest update --branch preview --message "Txxx: summary"
```

This command is available only after T113 installs `expo-updates`.

Note: `docs/OTA_UPDATES.md` still uses pre-REBRAND-1 naming
(`pawcareright@…`, "Paw Care Right +") in its examples; the binding
identifiers are `CLAUDE.md` §1a. That doc is hook-protected and is not
edited here — its rebrand pass is tracked separately.

## 8. Verification status (honest)

No `eas` command has been executed against a real EAS project in this build
environment: there is no `EXPO_TOKEN` and no authenticated `eas login`
session available here, and this repo does not vendor `eas-cli`. A
time-boxed, non-interactive attempt was made during T099 execution:

```
cd apps/mobile && timeout 120 npx --yes eas-cli@latest config --profile preview --platform ios --non-interactive; echo "exit=$?"
```

Recorded result: `eas-cli@latest` fetched successfully over npm and ran, then
failed at the expected auth boundary rather than a schema/config error:

```
An Expo user account is required to proceed.
Either log in with eas login or set the EXPO_TOKEN environment variable if you're using EAS CLI on CI (Learn more: https://docs.expo.dev/accounts/programmatic-access/)
    Error: config command failed.
exit=1
```

`git status` was confirmed clean of any unplanned changes afterward (no CLI
mutation of `eas.json`/`app.config.js` occurred).

The offline gate that stands in for this until a founder runs the real CLI
is `apps/mobile/__tests__/eas-config.test.ts` (validates `eas.json` shape,
enum values, cross-checks against `app.config.js` and `.env.example`, and
scans for secret-shaped values). The founder-run command that truly closes
this loop, once `EXPO_TOKEN`/`eas login` and EAS project access exist:

```
npx eas-cli@latest build --profile preview --platform ios --non-interactive
```

Expected: credential/project resolution proceeds (possibly prompting for
missing founder-only values per §6), with no eas.json/app.config schema
error.

## 9. Founder to-dos

1. Create/rename the EAS project to slug `bombaypetcompany` (`eas init`), then paste the new server-assigned `projectId` into `apps/mobile/app.config.js` `extra.eas.projectId` (one-line edit).
2. `npx eas-cli@latest login` (or set `EXPO_TOKEN` as a CI secret) and run `npx eas-cli@latest build --profile preview --platform ios --non-interactive` once — the real AC1 confirmation; paste the result into the journal.
3. Set GitHub repo variable `APP_VERSION=1.0.0` (mirrors `app.config.js`; `ci.yml` already reads it).
4. Create EAS environment variables per environment (`development`/`preview`/`production`): `EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_RC_ANDROID_KEY`, `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (+ `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` as build secrets). Never in the repo.
5. Confirm or replace the provisional API hostnames (`staging-api.bombaypetcompany.app`, `api.bombaypetcompany.app`) once infra + T102 naming land.
6. Apple Developer + App Store Connect app record for `com.bombaypetcompany.app`; Play Console app + service-account JSON stored outside the repo; run `eas credentials` for iOS signing and the Android keystore.
7. Re-confirm bundle id / display name at **C3** after T102; if they change, `app.config.js` + `packages/config/src/constants.ts` are the only edit sites.
8. Run the 8-shot capture from a `preview` build via the `.claude/skills/emulator-test/SKILL.md` flow (save each as `apps/mobile/store-assets/raw/<shot-id>.png`), then re-run `pnpm --filter mobile store:screenshots` and upload the framed PNGs + `out/copy-blocks.md` copy to App Store Connect / Play Console.
9. Install and wire `expo-splash-screen` (`npx expo install expo-splash-screen`) using the plugin block documented in `apps/mobile/store-assets/README.md` §9, to activate the final splash artwork.
10. Complete the C3 internal-distribution checklist in `loop/checkpoint-C3-notes.md` §§4–5 (Apple Developer + App Store Connect record + ASC API key; Play Console record + declarations + service-account JSON), then run `pnpm --filter mobile dist:internal`.
11. Confirm `staging-api.bombaypetcompany.app` is reachable before inviting internal testers — the `preview` profile points every tester at it.
12. Add internal testers (App Store Connect Internal Testing group; Play internal tester list + opt-in URL) and Play license testers for IAP sandbox.
13. Confirm the operator has `redis-cli` access to the production Redis (or an equivalent console) — §14's kill switches are exercised through it; keep the connection string in the ops vault, never in the repo.
14. Run a **kill-switch fire drill** on staging before launch: flip `checks` off, confirm the app shows the unavailable notice and that the emergency interstitial + hotlines are still reachable, flip it back on; paste the result into the journal.
15. Set the production env baselines `FEATURE_CHECKS=on`, `FEATURE_CHAT=on`, `FEATURE_PAYWALL=on` (a Redis flush must not silently change intent).
16. Record the on-call contact and the user-comms channel that §15's comms step refers to.

## 10. Store assets & screenshots (T100)

Final app icon/splash artwork (all densities) and the 8-shot marketing
screenshot compositor live in `apps/mobile/store-assets/` — see
`apps/mobile/store-assets/README.md` for the full manifest, device
profiles, shot list, and marketing copy blocks (not restated here).

```
pnpm --filter mobile assets:generate
pnpm --filter mobile store:screenshots
```

Honest note: no real device/simulator capture was possible in this build
environment (headless Linux, no staging build) — the 8-shot set is proven
against synthetic captures in `apps/mobile/__tests__/store-screenshot-kit.test.ts`;
closing it against a real `preview` build is a founder to-do (§9 item 8).

## 11. Internal distribution (T101)

TestFlight-internal + Play-internal-track submission is tracked in
`loop/checkpoint-C3-notes.md` — the ordered, founder-tagged checklist and the
evidence of everything attempted in this build environment live there, not
here (avoids duplication/drift). Two entry points:

```
pnpm --filter mobile dist:internal --dry-run
pnpm --filter mobile dist:internal
```

The first prints the ordered build/submit plan offline and always exits 0;
the second runs the real preflight (Expo credentials, clean git tree, then
both `eas build`s followed by both `eas submit`s for the `preview` profile).
Honest note: neither has produced a signed `.ipa`/`.aab` in this environment —
there is no `EXPO_TOKEN`/`eas login` session here, matching the §8 boundary
above; `loop/checkpoint-C3-notes.md` §7 records the verbatim attempt.

## 12. Container coverage & deploy order (T106)

This closes `docs/ARCHITECTURE.md` §7's "production migrations are... documented
in runbook T106". Every container in `docs/ARCHITECTURE.md` §1 (system
context) and §2 (containers table) is covered below — deploy step, the
signal that proves it deployed clean, the rollback action if it didn't, and
whether a §14 kill switch can substitute for a rollback during an incident.

| Container | Deploy step | Verify | Rollback | Kill switch |
|---|---|---|---|---|
| PostgreSQL | `prisma migrate deploy` runs BEFORE `apps/api` is redeployed (expand-then-contract — additive migrations only inside a release train; no destructive/renaming migration ships in the same train as the code that depends on the rename) | Migration exits 0; `prisma migrate status` clean | Roll forward with a corrective migration (never `migrate reset` in production); a destructive migration is never rolled back in place — restore from the last snapshot only as a last resort | — |
| `apps/api` | Deploy the new API image/build after migrations are applied | `GET /v1/health` returns 200; error rate + p95 latency dashboards nominal for 5 min | Redeploy the previous known-good API image (the image tag from the prior release) | `checks`/`chat`/`paywall` via `/v1/config` (§14) |
| workers (same deploy, separate process, `apps/api/src/workers`) | Deploy alongside `apps/api` (same image); let in-flight jobs drain before old workers stop | BullMQ queue depth returns to baseline; no spike in the dead-letter queue; `check-runner`/`image-processor`/`reminder-scheduler`+`push-sender`/`digest-builder`/`answer-cache-warmer` all resume processing | Pause the affected queue (`queue.pause()`), redeploy the previous worker image, resume the queue | `checks`/`chat` kill switches stop new jobs from being enqueued at the API layer; already-queued jobs still drain |
| Redis | Config/version changes only (no app-level migration) | `redis-cli PING` returns `PONG`; BullMQ + `FeatureFlagsService` reads succeed | Restore from the managed Redis provider's snapshot/replica; BullMQ jobs are re-driven from Postgres-persisted `SymptomCheck`/`ChatThread` state where applicable | A Redis outage does not need a "rollback" — `FeatureFlagsService`'s 5s cache + sticky-last-known + env default keep flag resolution safe through a blip (T106 D4) |
| S3/MinIO | Config/bucket-policy changes only | A signed presigned-URL round-trip succeeds (upload + read-back) | Revert the bucket policy/CORS change; object data itself is never migrated destructively | — |
| AI providers (Ollama Cloud + Gemini, via `packages/ai`) | No deploy of the provider itself; a provider/model-id change ships as an `apps/api` config change (`docs/AI_PROVIDERS.md`) | A scripted triage/chat smoke call returns a schema-valid result | Revert the provider/model-id env value; the abstraction in `packages/ai` means this is a config revert, not a code rollback | `checks`/`chat` kill switches (§14) stop new requests reaching the provider entirely |
| Expo Push | No deploy (Expo-hosted); credentials/config changes only | A test push to a staging device token is received | Revert the push credential/config change | — |
| RevenueCat | No deploy (hosted); webhook URL/entitlement-mapping changes only | A sandbox purchase round-trips through `POST /billing/rc-webhook` and updates `Subscription` | Revert the webhook URL/mapping change | `paywall` flag is plumbed (not enforced) — see §14 D7 note |
| PostHog | No deploy (hosted); key/host config only | Events appear in the PostHog live view within a few minutes | Revert the API key/host env value (empty key is the stub-safe no-op default, T089) | — |
| Sentry | No deploy (hosted); DSN/release config only | A test exception appears tagged with the new release (`bombaypetcompany@{version}+{updateId}`) | Revert the DSN env value (empty DSN is the stub-safe no-op default, T089) | — |
| `apps/mobile` | OTA update (JS-only) via `eas update`, OR a new store binary — see §13's decision matrix | OTA: staged rollout metrics nominal (`docs/OTA_UPDATES.md` §6/§8). Binary: store review passes, crash-free rate nominal post-release | OTA: `docs/OTA_UPDATES.md`'s rollback (revert to the previous published update on the channel). Binary: an expedited store resubmission per §13, since a shipped binary cannot be "rolled back" from the store side | A server-side kill switch (§14) can mask a client-side regression in `checks`/`chat` without ANY mobile deploy at all — the fastest mobile-side mitigation available |
| `apps/web` | Standard Next.js redeploy (Vercel/host of choice) | Smoke-test the marketing/SEO pages + the read-only admin auth gate | Redeploy the previous known-good web build/commit | — |
| `packages/ai` | Ships embedded inside the `apps/api` deploy (no separate runtime) | Covered by the `apps/api` verify step above, plus `pnpm test:ai-evals` green pre-deploy | Covered by the `apps/api` rollback above | `checks`/`chat` kill switches |
| `packages/data` | Ships embedded inside whichever app consumes it (`apps/api`, `apps/web`) at that app's next deploy — versioned seed datasets, no independent runtime | Covered by the consuming app's verify step; a dataset version bump is confirmed via its own changelog/version tag | Covered by the consuming app's rollback above | — |

**Deploy order:** `db → api → workers → web → mobile`

1. **db** — apply migrations (`prisma migrate deploy`) against production Postgres. Expand-then-contract discipline: additive changes only ship in the same release train as the code that reads them; a destructive/renaming migration only ships in a LATER train, once nothing still reads the old shape. No destructive migration ever ships inside the same release train as the feature that depends on it.
2. **api** — deploy the new `apps/api` image (workers ride along in the same image/process group). Verify `GET /v1/health` before proceeding.
3. **workers** — let in-flight BullMQ jobs on the old worker process drain, then the new workers pick up processing (same deploy as `api` above; called out separately here because its rollback signal — queue depth — is distinct from the API's).
4. **web** — redeploy `apps/web` (no dependency on the mobile step; safe to run in parallel with mobile once `api`/`db` are confirmed healthy).
5. **mobile** — OTA update or new binary per §13's decision matrix.

Rollback is always **reverse order and layer-scoped**, never "roll everything back": roll back only the layer that regressed, verify, then decide whether upstream layers need anything. See §16 for the copy-pasteable per-layer commands.

## 13. OTA vs binary decision matrix (T106)

| Change type | OTA or binary | Why |
|---|---|---|
| JS-only bug fix / copy change / logic change with no new native module | **OTA** | No native code changed; the JS bundle can update in place on the existing binary's `runtimeVersion` |
| Safety-copy hotfix (e.g. a red-flag/disclaimer string correction) | **OTA**, expedited | Speed matters for a safety-copy fix; still JS-only, so OTA applies — see the incident playbook (§15) for the "bad triage report" path that may need one of these |
| New/updated native dependency, or any `app.config.js` native-config change | **Binary** | Changes the native binary or its `runtimeVersion` fingerprint — OTA cannot ship native code |
| New/changed permission or entitlement (camera, notifications, IAP capability, etc.) | **Binary** | Store review must see the updated permission/entitlement declaration before it reaches users |
| Store metadata (screenshots, description, pricing) | **Neither — store console only** | Not a code change at all; submitted directly to App Store Connect / Play Console, no build required |

The rule that decides everything above: **anything changing native code or the
`runtimeVersion` fingerprint requires a new binary; everything else can OTA.**
Channel model, runtime-version policy, staged-rollout mechanics, and publish
safety gates are defined in `docs/OTA_UPDATES.md` (§1, §6, §8) and are not
restated here (see §7 above). Note again: `docs/OTA_UPDATES.md` still carries
pre-REBRAND-1 naming in its examples — it is hook-protected and is not edited
here; its rebrand pass is tracked separately.

## 14. Feature kill switches (T106)

Three server-enforced kill switches exist behind `GET /v1/config`'s
`features: { checks, chat, paywall }` field — Redis-overridable, env-defaulted,
**no deploy or restart required to flip one**.

- **Keys:** `bombaypetcompany:flags:checks`, `bombaypetcompany:flags:chat`,
  `bombaypetcompany:flags:paywall` (prefix per CLAUDE.md §1a).
- **Resolution:** Redis value `"off"` disables the flag, `"on"` enables it;
  a missing key or any other value falls back to the env default
  (`FEATURE_CHECKS`/`FEATURE_CHAT`/`FEATURE_PAYWALL`, each `on` by default).
  No TTL is ever set on the key — an expiring kill switch would silently
  re-enable a feature mid-incident.
- **Propagation:** each API process caches a resolved flag for up to 5
  seconds (`FLAG_CACHE_TTL_MS`), so a kill reaches every process within
  **≤5 seconds** — no rolling restart, no deploy.
- **Operator commands** (`redis-cli`, not an admin endpoint — see the
  `FeatureFlagsService` doc comment for the full rationale):

  ```
  # Kill:
  redis-cli -u "$REDIS_URL" SET bombaypetcompany:flags:checks off
  redis-cli -u "$REDIS_URL" SET bombaypetcompany:flags:chat off

  # Restore:
  redis-cli -u "$REDIS_URL" DEL bombaypetcompany:flags:checks
  redis-cli -u "$REDIS_URL" DEL bombaypetcompany:flags:chat
  ```

- **Client-visible effect:** a killed `checks`/`chat` route returns HTTP
  `503` with the typed error envelope `{ error: { code: "FEATURE_DISABLED", message, requestId } }`.
  The mobile app also reads `features` off `/v1/config` and shows a
  non-dismissible "temporarily unavailable — contact your vet, or your
  nearest emergency vet service if this can't wait" notice in place of the
  category grid (`checks`) or the composer + quick prompts (`chat`); the
  server-side `503` is the authoritative backstop for any client that never
  saw the updated `/config` (a stale cache, an old build).
- **What stays enforced:** `POST /v1/pets/:petId/checks` (`checks`),
  `POST /v1/chat/threads` + `POST /v1/chat/threads/:id/messages` (`chat`).
- **What is deliberately left UNGATED, and why (CLAUDE.md §7):**
  `GET /v1/checks/:id` and `GET /v1/pets/:petId/checks` stay reachable even
  with `checks` killed — they serve already-produced results, including the
  `redFlag` Emergency-interstitial payload (§7 rule 4: the interstitial and
  its hotline numbers must never be hidden). `POST /v1/checks/:id/followup`
  also stays reachable — it is deterministic and escalation-only (it can
  only RAISE urgency, never lower it), so killing it would remove an
  upward-fail path (§7 rule 5). **Killing `checks` never removes the
  emergency interstitial, hotlines, existing results, or the follow-up
  escalation path.**
- **`paywall` is plumbed but not enforced (D7):** `/v1/config` reports the
  flag and an operator can flip it via the same `redis-cli` mechanism, but
  no route currently branches on it — gating the purchase/entitlement path
  server-side is out of this task's scope (the card's AC only requires
  `checks`/`chat`). Wiring an actual enforcement point for `paywall` is a
  future task, not assumed here.
- **Expected observability noise during a kill:** every blocked request is a
  `503`, and `AllExceptionsFilter` logs every 5xx at error level and reports
  it to Sentry (this is existing, unmodified behavior — not new to the kill
  switch). While `checks`/`chat` is off, expect one Sentry event + one error
  log line **per blocked request**, for the whole duration of the kill. This
  is expected noise, not a new incident — do NOT silence 5xx/Sentry capture
  globally to quiet it down, because that would also hide a REAL `apps/api`
  outage during the same window (a genuine dependency failure reports the
  distinct `SERVICE_UNAVAILABLE` code, e.g. from `GET /v1/health`, never
  `FEATURE_DISABLED` — the two are never confusable in the error envelope,
  T106 checker fix). The correct operator response is to time-box the kill
  (§15's exit step: `DEL` the flag as soon as the underlying issue is
  contained/fixed) rather than suppress the alerting channel.

## 15. Incident playbook (T106)

Each playbook follows **detect → contain → verify → comms → exit**.

### AI provider down

- **Detect:** `packages/ai` provider-call error rate spikes (Sentry/PostHog
  dashboards); `checks` jobs terminate in `FALLBACK` status more than usual;
  chat streams end in the `SAFE_FALLBACK` state more than usual.
- **Contain:** the EXISTING fallback behavior is the first line of defense,
  not a kill switch — `docs/ARCHITECTURE.md` §8's availability target
  ("if AI provider is down, food lookups serve cached/dataset answers and
  checks return the safe fallback; reminders unaffected") already covers
  this, and CLAUDE.md §7 rule 5 (fail upward, never guess) is enforced in
  `packages/ai`'s response-validation path regardless of which provider is
  configured. Only kill `checks`/`chat` via §14 if the FALLBACK/safe-fallback
  path ITSELF starts misbehaving (e.g. serving something other than the safe
  copy) — the provider abstraction in `packages/ai` (`docs/AI_PROVIDERS.md`)
  is the single switch point for a provider/model-id config change if the
  outage is provider-specific and a fallback provider is configured.
- **Verify:** FALLBACK/safe-fallback rate returns to baseline; `pnpm
  test:ai-evals` still green against the current provider config.
- **Comms:** notify the on-call + user-comms channel (§9 founder to-do 16)
  if the outage is user-visible for more than a few minutes.
- **Exit:** once the provider (or its fallback) is confirmed healthy, resume
  normal monitoring; if `checks`/`chat` were killed, `DEL` the flag key(s).

### Bad triage report (content incident)

- **Detect:** a user/founder report, or an eval-harness regression, surfaces
  an unsafe or badly-wrong `checks`/`chat` output.
- **Contain:** kill `checks` (and `chat` if the same defect can reach it)
  FIRST via §14's `redis-cli SET ... off` — this is seconds, not minutes.
- **Scope the blast radius:** query the T090 AI audit trail
  (`apps/api/src/audit/ai-audit.service.ts`, `ai-audit.flags.ts`) for the
  affected prompt/model/time-window to find every other check/message that
  may carry the same defect.
- **Fix:** choose an OTA copy fix (client-side string correction, §13) vs a
  prompt/eval fix in `packages/ai` (server-side). A server-side prompt/eval
  fix must pass `pnpm test:ai-evals` green (golden + red-team sets) before
  the kill switch is lifted — never re-enable on a guess.
- **Verify:** re-run the specific case(s) that surfaced the defect against
  the fixed prompt/eval; confirm `pnpm test:ai-evals` is green.
- **Comms:** notify the on-call + user-comms channel; if any user received
  unsafe content, the comms plan must include a direct outreach step (not
  just a status-page note).
- **Exit:** `redis-cli DEL bombaypetcompany:flags:checks` (and `chat` if
  killed) to restore, then continue monitoring for a recurrence.

### Store rejection

- **Detect:** App Store Connect / Play Console review rejects a submitted
  binary.
- **Contain:** read the rejection reason against `docs/store-listing.md` and
  T097's claims-audit constraint (the subtitle/description must state
  "guidance, not a veterinarian" — never a medical claim); confirm the
  currently-live binary is unaffected (a rejection blocks the NEW
  submission, not the live app).
- **Fix:** if the rejection is about STORE METADATA/COPY only, correct it
  directly in the store console (§13 — no code/build required) and
  resubmit. If it requires a CODE change, decide OTA-vs-binary per §13's
  matrix (a copy-only in-app fix may ship OTA even while the metadata fix
  goes through the console; a behavior/permission fix needs a new binary
  and another review pass).
- **Verify:** the resubmission passes review.
- **Comms:** notify the on-call; if the rejection delays a planned release
  date, the user-comms channel is notified only if the delay is externally
  visible (e.g. a promised launch date slips).
- **Exit:** once approved, proceed with the normal §12 deploy order for
  anything the resubmission bundled.

## 16. Rollback steps per layer (T106)

**Golden rule: kill switch first, rollback second.** A flag flip (§14) is
seconds; a deploy/rollback is minutes. If a `checks`/`chat` regression can be
masked by a kill switch, do that FIRST, then decide whether a rollback is
still needed at all. **No rollback step below may ever disable the
`<VetDisclaimer/>`, the Emergency interstitial, or hotline data** — those are
never behind a kill switch and never part of a rollback (CLAUDE.md §7).

1. **db** — never "rolled back" by reverting a migration in place. Roll
   FORWARD with a corrective migration. A destructive change is only
   recoverable from a snapshot/replica restore (last resort, founder-invoked
   only).
2. **api** — redeploy the previous known-good image/build; confirm
   `GET /v1/health` before declaring the rollback complete.
3. **workers** — pause the affected BullMQ queue, redeploy the previous
   worker image, resume the queue; confirm queue depth returns to baseline.
4. **web** — redeploy the previous known-good `apps/web` build/commit.
5. **mobile OTA** — republish the previous update on the affected channel
   per `docs/OTA_UPDATES.md`'s rollback mechanism (§7 delegates the exact
   command/mechanics there).
6. **mobile binary** — a shipped store binary cannot be pulled back from
   users' devices; mitigate via (a) a kill switch (§14) if the regression is
   in `checks`/`chat`, (b) an OTA hotfix if the regression is JS-only, or
   (c) an expedited new binary submission (§13) if it is native-code/
   permission-related. There is no fourth option — a native regression
   always needs one of these three.
