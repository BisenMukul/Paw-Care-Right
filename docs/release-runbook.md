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
