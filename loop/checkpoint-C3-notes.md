# Checkpoint C3 notes — Internal distribution (T101)

## 1. Purpose & scope

This is the `LOOP_PROTOCOL.md` §7 checkpoint artifact for **C3** (internal
distribution). It records what T101 automated, attempted, and could not
attempt in this credential-less container, and hands the founder a single,
ordered, tagged checklist from here to a build being installable from
TestFlight-internal and the Google Play internal testing track.

**What this file is not:**

- Not the store-listing / ASO copy pack, trademark check, or final display
  name / bundle id decision — that is **T102**.
- Not public/production release, and it does not touch
  `submit.production.android.track` — that is **T106**.
- Not OTA/`eas update` policy or rollout — see `docs/OTA_UPDATES.md`
  (T113–T118).

**C3 approval is founder-only.** Nothing in this document, the
`internal-distribution.sh` script, or any test in this repo flips
`checkpoints.C3.approved` — per `LOOP_PROTOCOL.md` §6/§2, that switch is a
human decision made after the founder has actually completed the checklist
below and confirmed a build is installable from both consoles.

## 2. Status summary

| Area | Automated here | Blocked on human |
|---|---|---|
| iOS build | `eas.json` `preview` profile committed; `npx eas-cli@latest build --profile preview --platform ios --non-interactive` documented + attempted (auth boundary, §7) | Apple Developer enrollment, ASC app record, distribution cert/provisioning profile (`eas credentials`), `EXPO_TOKEN`/`eas login` |
| iOS submit | `npx eas-cli@latest submit --profile preview --platform ios --non-interactive` documented + attempted (auth boundary, §7) | ASC API key, export-compliance answer, Internal Testing group + testers |
| Android build | `eas.json` `preview` profile (`app-bundle`, `internal` distribution) committed; build command documented + attempted | Play Developer account, Play App Signing enrolment, `EXPO_TOKEN`/`eas login` |
| Android submit | `submit.preview.android.track: "internal"` committed; `npx eas-cli@latest submit --profile preview --platform android --non-interactive` documented + attempted (auth boundary, §7) | Google Cloud service-account JSON, pre-release declarations, first-upload console caveat (verify) |
| Testers/groups | Founder checklist ordered (§4/§5) | Creating the ASC Internal Testing group and Play internal tester list/opt-in URL — both console-only actions |
| Store declarations | N/A (not automatable; no console access) | Play pre-release declarations (privacy policy URL, app access, ads, content rating, target audience, data safety, health-app applicability) |
| Credentials/secrets | `.gitignore` already excludes `*.p8` / `google-play-service-account*.json` (T099); repo holds zero secret-shaped values (§8 test) | Founder must create and store the ASC API key + Play service-account JSON outside the repo |

## 3. Prerequisites already in place (repo side)

- `apps/mobile/eas.json` `build.preview`: `distribution: "internal"`,
  `channel: "preview"`, `autoIncrement: true`, `credentialsSource: "remote"`,
  `android.buildType: "app-bundle"`.
- `apps/mobile/eas.json` `submit.preview.android.track: "internal"`.
- `apps/mobile/eas.json` `cli.appVersionSource: "remote"` and
  `cli.requireCommit: true` (this is why the automation script in §4/§5
  refuses to run against a dirty git tree).
- Entry point: `pnpm --filter mobile dist:internal` (wraps
  `apps/mobile/scripts/internal-distribution.sh`).
- Full prerequisite detail (env vars, versioning, signing) already lives in
  `docs/release-runbook.md` §§2–5 — cross-referenced here, not restated, to
  avoid drift.

## 4. Apple — TestFlight internal track

- [ ] **[FOUNDER]** Enrol in the Apple Developer Program (the organization needs a D-U-N-S number for an org account).
- [ ] **[FOUNDER]** Register the bundle id `com.bombaypetcompany.app` in the Apple Developer portal with the capabilities `app.config.js` implies: Sign in with Apple (`usesAppleSignIn: true`) and Push Notifications (`expo-notifications`).
- [ ] **[FOUNDER]** Create the App Store Connect app record for `com.bombaypetcompany.app` (display name is provisional until T102/C3 — see `docs/release-runbook.md` §1).
- [ ] **[FOUNDER]** Generate an App Store Connect API key for non-interactive `eas submit`, and store the `.p8` outside this repo (already gitignored, T099).
- [ ] **[FOUNDER]** Run `eas init` (or rename the existing EAS project) to the `bombaypetcompany` slug, then paste the server-assigned `projectId` into `apps/mobile/app.config.js` `extra.eas.projectId` (`docs/release-runbook.md` §9 item 1).
- [ ] **[FOUNDER]** Run `npx eas-cli@latest credentials` to let EAS manage the iOS distribution certificate and provisioning profile (`credentialsSource: "remote"` in `eas.json`).
- [ ] **[AUTOMATED-READY]** Build the iOS `preview` artifact: `npx eas-cli@latest build --profile preview --platform ios --non-interactive` (or run `pnpm --filter mobile dist:internal`, which drives all four commands in order).
- [ ] **[AUTOMATED-READY]** Submit the iOS build to TestFlight: `npx eas-cli@latest submit --profile preview --platform ios --non-interactive`.
- [ ] **[FOUNDER]** Answer the export-compliance question that App Store Connect asks while the build is processing.
- [ ] **[FOUNDER]** Create the Internal Testing group in App Store Connect and add named testers (internal testing does not require Beta App Review).
- [ ] **[FOUNDER]** Sign the Paid Applications Agreement in App Store Connect, add sandbox (Sandbox Testers) accounts for IAP purchases, and configure RevenueCat's App Store credentials (Apple-side counterpart of the §5 Play license-tester step; ties to the standing C2 to-do).
- [ ] **[FOUNDER]** Paste the §6 "What to Test" copy block into the TestFlight build notes.
- [ ] **[FOUNDER]** Install the build on a real device from TestFlight and run the T100 §9-item-8 screenshot capture flow from that build (`docs/release-runbook.md` §9 item 8).

## 5. Google Play — internal testing track

- [ ] **[FOUNDER]** Enrol in the Google Play Developer program (one-time fee + identity verification; the organization needs a D-U-N-S number for an org account).
- [ ] **[FOUNDER]** Create the Play Console app record for `com.bombaypetcompany.app`.
- [ ] **[FOUNDER]** Complete the pre-release declarations: privacy policy URL, app access, ads, content rating, target audience, data safety — and **verify** whether Play's health-app declaration applies to a guidance-only pet-care app (it is not a medical app; confirm current Play policy before answering, do not assume).
- [ ] **[FOUNDER]** Enrol in Play App Signing using the EAS-managed upload key.
- [ ] **[FOUNDER]** Create a Google Cloud service account with "release to testing tracks" permission; store the JSON key outside this repo (`google-play-service-account*.json` is already gitignored, T099) and supply its path to `eas submit` only via a mechanism verified against `eas submit --help` (§7) — never hardcode the path in `eas.json`.
- [ ] **[FOUNDER]** **Verify** the first-upload caveat: Play has historically required the very first artifact for a new package to be uploaded manually through the console before API-based submission works; if `eas submit` rejects the first upload, fall back to a manual console upload.
- [ ] **[AUTOMATED-READY]** Build the Android `preview` artifact: `npx eas-cli@latest build --profile preview --platform android --non-interactive` (or run `pnpm --filter mobile dist:internal`, which drives all four commands in order).
- [ ] **[AUTOMATED-READY]** Submit the Android build (lands on the Play `internal` track per `eas.json` `submit.preview.android.track`): `npx eas-cli@latest submit --profile preview --platform android --non-interactive`.
- [ ] **[FOUNDER]** Create the internal tester list in Play Console and share the opt-in URL with testers.
- [ ] **[FOUNDER]** Add Play license testers for IAP sandbox purchases, and configure RevenueCat's Play Store credentials (ties to the standing C2 to-do).
- [ ] **[FOUNDER]** Verify the app installs correctly from the opt-in link on a real device.

## 6. Beta release notes & "What to Test" copy

<!-- beta-notes:start -->
Thanks for testing Bombay Pet Company! This internal build lets you try:
symptom checks with AI-powered guidance, food and toxin safety lookups,
care reminders for vaccines/parasites/meds, a shared pet health timeline,
and family sharing for multi-person households.

What to test: create a pet profile, run a symptom check end-to-end, add a
care reminder, try food/toxin lookup, and confirm the app behaves sensibly
offline and when a check result comes back uncertain. Please report
anything confusing, slow, or incorrect via the in-app feedback channel.

Bombay Pet Company offers general pet-care guidance, not veterinary care or treatment. Always consult a licensed veterinarian.
<!-- beta-notes:end -->

## 7. Evidence — what was attempted in this environment

**Android `expo export` (T101 Phase A step 2), exit 0:**

```
cd apps/mobile && timeout 900 npx expo export --platform android --output-dir .perf/t101-export/android
```

Result: `exit=0`. Produced `_expo/static/js/android/entry-<hash>.hbc` (9,278,557
bytes), `assets/` (67 hashed files), `metadata.json` (4,370 bytes); total
directory size 16M.

**iOS `expo export` (T101 Phase A step 3), exit 0:**

```
cd apps/mobile && timeout 900 npx expo export --platform ios --output-dir .perf/t101-export/ios
```

Result: `exit=0` (this Linux container was able to run the iOS export path,
unlike a real iOS *build*, which requires macOS/Xcode or EAS's remote
build farm). Produced `_expo/static/js/ios/entry-<hash>.hbc` (9,093,009
bytes), `assets/` (63 hashed files), `metadata.json` (4,110 bytes); total
directory size 15M. Both export directories were deleted after recording
these sizes (T101 plan step 12); they are gitignored (root `.gitignore`
`.perf/` pattern, line 15) and were never committed.

**`eas submit --profile preview --platform android --non-interactive` (Phase A step 5), exit 1:**

```
An Expo user account is required to proceed.

Log in to EAS with email or username (exit and run eas login --help to see other login options)
Input is required, but stdin is not readable. Failed to display prompt: Email or username
    Error: submit command failed.
exit=1
```

**`eas submit --profile preview --platform ios --non-interactive` (Phase A step 6), exit 1:**

```
An Expo user account is required to proceed.

Log in to EAS with email or username (exit and run eas login --help to see other login options)
Input is required, but stdin is not readable. Failed to display prompt: Email or username
    Error: submit command failed.
exit=1
```

Both submit attempts fetched `eas-cli@latest` successfully and failed at the
same auth boundary already recorded for `eas build`/`eas config` in
`docs/release-runbook.md` §8 — not a schema or config error. `npx --yes
eas-cli@latest whoami` was also run to verify the same boundary; it returned
`exit=1` with `Not logged in` (no crash, no invented output).

**`apps/mobile/scripts/internal-distribution.sh --dry-run` (Phase B step 11), exit 0:**

```
internal-distribution: ordered plan (profile: preview, platform: all)
  1. npx eas-cli@latest build --profile preview --platform ios --non-interactive
  2. npx eas-cli@latest build --profile preview --platform android --non-interactive
  3. npx eas-cli@latest submit --profile preview --platform ios --non-interactive
  4. npx eas-cli@latest submit --profile preview --platform android --non-interactive
internal-distribution: see loop/checkpoint-C3-notes.md sections 4-5 for the founder console steps each command depends on.
exit=0
```

**`apps/mobile/scripts/internal-distribution.sh` (real run, no `--dry-run`, Phase B step 11), exit 1:**

```
internal-distribution: no Expo credentials (set EXPO_TOKEN or run `npx eas-cli@latest login`) -- see loop/checkpoint-C3-notes.md section 3
exit=1
```

This is the expected preflight refusal: the script checks for `EXPO_TOKEN` or
a working `npx eas-cli@latest whoami` session before attempting any build,
and neither is present in this container.

**Honest summary:** no signed `.ipa` or `.aab` was produced in this
environment. There is no `EXPO_TOKEN`, no authenticated `eas login` session,
and no App Store Connect / Play Console credentials available here — the
same boundary already documented in `docs/release-runbook.md` §8. Everything
above this line is real command output from this container, not a
simulation.

## 8. Remaining human steps — consolidated checklist

- [ ] **[FOUNDER]** Complete Apple Developer Program enrollment and register `com.bombaypetcompany.app` with Sign in with Apple + Push Notifications capabilities.
- [ ] **[FOUNDER]** Create the App Store Connect app record and generate an ASC API key stored outside the repo.
- [ ] **[FOUNDER]** Run `eas init`/project rename to the `bombaypetcompany` slug and paste the new `projectId` into `apps/mobile/app.config.js`.
- [ ] **[FOUNDER]** Run `npx eas-cli@latest credentials` for iOS distribution cert/provisioning profile and the Android keystore.
- [ ] **[FOUNDER]** Answer the App Store Connect export-compliance question and create the Internal Testing group + testers.
- [ ] **[FOUNDER]** Enrol in the Google Play Developer program and create the Play Console app record.
- [ ] **[FOUNDER]** Complete Play's pre-release declarations, verifying the health-app declaration question against current Play policy rather than assuming.
- [ ] **[FOUNDER]** Enrol in Play App Signing and create the Google Cloud service account (JSON key stored outside the repo), verifying the supply mechanism against `eas submit --help` before wiring it in.
- [ ] **[FOUNDER]** Verify the Play first-upload-via-console caveat and fall back to a manual upload if the API rejects the first artifact.
- [ ] **[FOUNDER]** Create the Play internal tester list, share the opt-in URL, and add license testers for IAP sandbox + RevenueCat Play credentials (standing C2 to-do).
- [ ] **[FOUNDER]** Set `EXPO_TOKEN` (or run `npx eas-cli@latest login`) so `pnpm --filter mobile dist:internal` can pass its credentials preflight.
- [ ] **[FOUNDER]** Create the EAS environment variables listed in `docs/release-runbook.md` §4 (`EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_RC_ANDROID_KEY`, `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_GOOGLE_CLIENT_ID`, `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`).
- [ ] **[FOUNDER]** Set the GitHub repo variable `APP_VERSION` to match `apps/mobile/app.config.js`'s marketing `version` (`docs/release-runbook.md` §5/§9 item 3).
- [ ] **[FOUNDER]** Confirm `staging-api.bombaypetcompany.app` is reachable before inviting any internal tester — the `preview` profile's `EXPO_PUBLIC_API_URL` points every tester at it; an unreachable staging API means every tester sees network errors on first launch. **This is a hard blocker for a usable internal test.**
- [ ] **[FOUNDER]** Re-confirm the final display name and bundle id at **C3**, after T102's trademark pass, before inviting external-facing testers.

## 9. Definition of done for internal distribution

The observable end state: a `preview`-channel build is installable and
launchable by a named tester from TestFlight-internal on iOS, **and** by a
tester from the Play internal-testing opt-in URL on Android, with the
safety surfaces unchanged from what's already in the codebase — the
`<VetDisclaimer/>` component still renders non-dismissibly on every AI
result screen, and the emergency red-flag interstitial still renders before
any AI content. Before **T106** (public/production release), the founder
must additionally flip `submit.production.android.track` in
`apps/mobile/eas.json` from `internal` to `production` — that change is out
of scope here and is not made by this task.
