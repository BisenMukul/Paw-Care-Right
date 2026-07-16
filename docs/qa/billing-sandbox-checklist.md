# Billing sandbox QA checklist (T080)

> A step-by-step **human** test script for the founder to run on-device at
> the C2 checkpoint, against BOTH stores (App Store sandbox + Play license
> testing). This is a purchase-QA ops script, not marketing/listing copy
> (that is M10) and not a code change — it verifies the billing surfaces
> built in T071–T079 behave correctly against real store sandboxes. No §5
> safety surface (`<VetDisclaimer/>`, emergency interstitial, red-flag
> rules, hotline numbers, dosing/drug/`diagnos*` copy) is exercised or
> modified by this doc.

## §1 Prerequisites

Do not start scenario ② or later until every box here is checked — most
failures below are actually an unmet prerequisite, not a product bug.

- [ ] **Dev-client build**, not Expo Go. `react-native-purchases` is a
      native module and does not run inside Expo Go — you need a custom
      dev client / EAS build carrying all three native modules that
      currently require a rebuild: `react-native-purchases`,
      `react-native-mmkv`, `react-native-nitro-modules` (`docs/store-setup.md
      §8`). Build with `eas build --profile development` (or a local
      `expo prebuild` + native build); a plain Metro/JS reload is NOT
      sufficient after installing/upgrading any of the three.
- [ ] **RC SDK keys are real, not stub.** Dev boot defaults to
      `stub_ios_key` / `stub_android_key` (`apps/mobile/app.config.js` /
      `apps/mobile/src/config.ts`), which boot the SDK offline but never
      reach RevenueCat. Set `EXPO_PUBLIC_RC_IOS_KEY` and
      `EXPO_PUBLIC_RC_ANDROID_KEY` to the real **public** SDK keys from RC
      dashboard → Project settings → API keys (`docs/store-setup.md §7`)
      before building the dev client used for this checklist.
- [ ] **RC dashboard configured** per `docs/store-setup.md §6`: entitlement
      `plus` exists; all three products (`pawcareright_monthly`,
      `pawcareright_annual`, `pawcareright_family_annual`) are registered on
      their store apps and attached to `plus`; offering `default` is
      published with packages `$rc_monthly` / `$rc_annual` / `family`.
- [ ] **App Store Connect / Play Console** subscriptions are live per
      `docs/store-setup.md §4`/`§5` (both stores' review/activation states
      allow sandbox/license-tester purchases — a product still "Waiting for
      Review" on ASC or not yet "Active" on Play will not appear in the
      sandbox purchase sheet).
- [ ] **A reachable API URL for the RC webhook.** The local dev API
      (`localhost:3000`) cannot receive RC's server-to-server webhook calls.
      Point the RC dashboard's webhook URL (Project settings → Webhooks) at
      a tunneled (e.g. `ngrok http 3000`) or deployed API instance's
      `POST /v1/billing/rc-webhook`, with the `Authorization` header value
      matching that environment's `RC_WEBHOOK_AUTH_TOKEN`
      (`apps/api/src/config/env.schema.ts`). **Scenarios ②③④⑦ cannot pass
      without this** — see §4.
- [ ] **Sandbox tester accounts**: one App Store **Sandbox Apple ID**
      (App Store Connect → Users and Access → Sandbox testers) for iOS, and
      one or more Play Console **license testers** (Play Console → Setup →
      License testing) for Android. Sign into the sandbox/tester account on
      the test device BEFORE attempting a purchase (device Settings → App
      Store → Sandbox Account on iOS; the Play Store on Android will detect
      a license-tester Google account automatically).
- [ ] A **second test account** (and, for ⑥, a second device or a second
      OS-level sandbox/tester identity) is available for restore and family
      scenarios.

## §2 How to read a step

Each numbered scenario below is a sequence of:

**Steps** (what to physically do) → **Expected** (the exact UI: route,
`testID`, or button label you should see) → **Server-side check** (the API
call or DB/webhook fact that proves the state is server-owned, not just a
client illusion) → a **PASS / FAIL** checkbox.

`GET /v1/billing/entitlement` below means: call the API directly (e.g.
`curl -H "Authorization: Bearer <token>" https://<api-host>/v1/billing/entitlement`)
and read the JSON body, which always has the shape
`{ entitled: boolean, source: "own"|"family"|"none", plan: string|null,
expiresAt: string|null, billingIssue: boolean }`.

## §3 Scenarios

### ① Fresh free user sees the paywall after the first check

1. Create a fresh account with no prior purchases. Run exactly ONE symptom
   check to completion, then start a second check from the check tab
   (`home-add-pet-cta`/tab entry → `app/check/index.tsx`, which drives
   `usePaywallOnboardingTrigger`).
2. **Expected:** the trigger fires only because premium status is `free`,
   `completedCheckCount >= 1`, and the paywall hasn't already been shown —
   the `/paywall` modal opens with `params.source: "onboarding"`,
   `testID="paywall-screen"`. On it: annual is highlighted
   (`paywall-plan-annual` + child `paywall-plan-annual-highlight`), the
   monthly card shows the trial badge (`paywall-trial-badge`), a family card
   (`paywall-plan-family`), plus `paywall-restore`, `paywall-maybe-later`,
   `paywall-terms`, `paywall-privacy`.
3. **Server check:** `GET /v1/billing/entitlement` →
   `{ entitled: false, source: "none", plan: null, billingIssue: false }`.
- [ ] PASS  [ ] FAIL — notes: ______________________

### ② Monthly purchase (sandbox) → premium flips

1. On `/paywall`, tap `paywall-trial-cta` (label reads "Start your 7-day
   free trial — then <price>") for product `pawcareright_monthly`. Complete
   the store's sandbox purchase sheet (Face ID / sandbox password prompt on
   iOS; Play's test-purchase dialog on Android).
2. **Expected:** `testID="paywall-success"` notice appears, then the modal
   dismisses (`router.back()`). A second check no longer re-triggers the
   paywall and no 402/upsell sheet appears for check submission (checks
   carry `meta.skipUpsell`).
3. **Server check:** RC fires `INITIAL_PURCHASE` → `POST
   /v1/billing/rc-webhook` (requires the reachable-URL prerequisite in §1 —
   RC dashboard's webhook config pointer is under RC dashboard → Project
   settings → Webhooks, configured against `docs/store-setup.md §6`'s
   entitlement/offering setup) → a new `Subscription` row keyed on the RC
   `app_user_id` (our internal user id). `GET /v1/billing/entitlement` →
   `{ entitled: true, source: "own", plan: "pawcareright_monthly" }`.
- [ ] PASS  [ ] FAIL — notes: ______________________

### ③ 7-day trial start → analytics + entitlement

1. Using a sandbox/tester identity that has NEVER subscribed before,
   confirm the monthly card's CTA shows the trial framing
   (`strings.paywall.trialCtaWithPrice`, e.g. "Start your 7-day free trial —
   then $5.99"). Purchase it.
2. **Expected:** entitlement flips to `entitled: true` with a future
   `expiresAt` (roughly "now + 7 sandbox-compressed days" — see §4).
3. **Server check:** the `trial_start` analytics event is emitted
   **server-side off the RC webhook**, not from a client tap — it fires
   only when the `INITIAL_PURCHASE` webhook event carries RC's
   `period_type: "TRIAL"` (`rc-webhook.service.ts`). Verify it landed via
   PostHog's live-events/debug view for the RC `app_user_id` as the distinct
   id (a purpose-built paywall funnel dashboard is T103, not yet built —
   don't expect one at this checkpoint). `GET /v1/billing/entitlement` →
   `entitled: true`, `expiresAt` in the future.
- [ ] PASS  [ ] FAIL — notes: ______________________

### ④ Cancel in store → persists until expiry, then drops

1. Cancel the active subscription in the store, NOT in the app (the app has
   no cancel button by design — server-owned entitlement, store-owned
   billing): iOS → device Settings → [Apple ID] → Subscriptions; Android →
   Play Store → Profile → Payments & subscriptions → Subscriptions (or the
   `ANDROID_MANAGE_SUBSCRIPTION_URL`
   `https://play.google.com/store/account/subscriptions?package=com.pawcareright.app`).
2. **Expected:** entitlement REMAINS `entitled: true` immediately after
   cancelling — cancellation only stops auto-renewal, it does not revoke
   current access.
3. Wait out the sandbox's compressed renewal clock (see §4 for each store's
   rate) until the period would expire.
4. **Expected after expiry:** entitlement flips to `entitled: false`.
5. **Server check:** RC fires `CANCELLATION` then, at period end,
   `EXPIRATION` → both webhooks land at `POST /v1/billing/rc-webhook` →
   the `Subscription` row's active window closes. `GET
   /v1/billing/entitlement` → `entitled: false` only after the `EXPIRATION`
   webhook has been received — a cancelled-but-not-yet-expired sandbox
   subscription must still read `entitled: true`.
- [ ] PASS  [ ] FAIL — notes: ______________________

### ⑤ Restore on reinstall / second device

1. As the SAME purchaser as ②, reinstall the app (or sign in on a second
   device), open `/paywall` (any `source`) or the Settings screen.
2. Tap `paywall-restore` on the paywall, or `settings-restore` on Settings.
3. **Expected:** `paywall-success` (paywall) or
   `settings-restore-success` (Settings) renders and premium is restored
   with no new purchase; a purchaser with nothing to restore instead sees
   `paywall-restore-none` / `settings-restore-none`.
4. **Server check:** entitlement is unaffected by the reinstall —
   `GET /v1/billing/entitlement` reads the same `Subscription` row as
   before, and the free-tier check/pet counters (server-side/Redis per T075)
   also survive the reinstall, confirming none of this state is
   client-local.
- [ ] PASS  [ ] FAIL — notes: ______________________

### ⑥ Family plan: owner purchase → member premium; leave → revoked

1. As the household owner, on `/paywall` tap `paywall-plan-family`
   (`pawcareright_family_annual`) and complete the sandbox purchase.
2. From Settings → `settings-family` → `app/family.tsx`, tap
   `family-invite-button` and share the generated deep link with a second
   test account; have that account open the link (`app/join/[code].tsx`)
   to join the household.
3. **Expected:** the second member's `GET /v1/billing/entitlement` →
   `{ entitled: true, source: "family" }` with no purchase of their own.
   Confirm ONLY the owner sees `settings-manage` (owner-only purchase
   management) — the member instead sees `settings-family-note`
   ("Your Premium comes from your household's family plan...").
4. Have the member leave: Settings → Family → `family-leave-button` →
   confirm via `family-leave-confirm-button` (the confirm screen shows
   `family-leave-grace` because `entitlement.source === "family"`).
5. **Expected after leaving:** the member's entitlement drops —
   `GET /v1/billing/entitlement` → `entitled: false` for that (now
   separate) household.
- [ ] PASS  [ ] FAIL — notes: ______________________

### ⑦ Billing-issue banner

1. Where the store sandbox supports it, force a billing-issue / grace-period
   state (see §4 — not all stores support decline simulation the same way).
2. **Expected:** RC's `BILLING_ISSUE` webhook flips `billingIssue: true` on
   the entitlement, which renders `billing-issue-banner` (Settings screen
   only) with `billing-issue-fix` (opens manage-subscription) and
   `billing-issue-dismiss`.
3. **Server check:** `GET /v1/billing/entitlement` →
   `billingIssue: true` while `entitled` may still be `true` (grace).
- [ ] PASS  [ ] FAIL — notes: ______________________

### ⑧ Manage-subscription deep links land per platform

1. From the billing-issue banner's `billing-issue-fix`, or Settings'
   `settings-manage` row (visible only when `entitlement.source === "own"`),
   trigger `openManageSubscription()`.
2. **Expected:** iOS opens `https://apps.apple.com/account/subscriptions`;
   Android opens
   `https://play.google.com/store/account/subscriptions?package=com.pawcareright.app`
   — UNLESS RC's `managementUrl` is present on the customer info, in which
   case that URL is used instead (`manage-subscription.ts`). Confirm the
   link lands on the correct native store subscriptions surface, not a
   404/generic store page.
- [ ] PASS  [ ] FAIL — notes: ______________________

### ⑨ Upsell sheet on 402 (adding a 2nd pet as a free user)

1. As a free user with exactly one pet, tap `home-add-pet-cta` and complete
   the add-pet flow through to submission (`app/add-pet/done.tsx`, which
   calls `useCreatePet`).
2. **Expected:** the API returns a `PAYMENT_REQUIRED` (402) error ("Free
   tier is limited to one pet") → the global `UpsellSheet` appears
   (`testID="upsell-sheet"`), with `upsell-see-plans` (→ `/paywall`,
   `source: "upsell"`) and `upsell-dismiss` (`upsell-sheet-backdrop` also
   dismisses).
3. Confirm this sheet NEVER appears on the emergency/red-flag path: the
   check-submission mutation carries `meta.skipUpsell: true`
   (`apps/mobile/src/api/checks-api.ts`), and the emergency/red-flag flow
   structurally cannot produce a 402 in the first place
   (`paywall-emergency-safety` test's guarantee) — this scenario reaffirms
   rather than tests that guarantee; do not attempt to induce a 402 on the
   check-submit path.
- [ ] PASS  [ ] FAIL — notes: ______________________

## §4 Sandbox limitations & honesty notes

Read this BEFORE running ②③④⑦ so a failed webhook wait is not mistaken for
a product bug:

- **Webhooks need a reachable API URL.** The local dev API boot with stub
  RC keys (`stub_ios_key`/`stub_android_key`) never talks to RevenueCat at
  all, and even with real keys, RC cannot reach `localhost`. Point RC's
  webhook config at a tunneled (ngrok) or deployed instance for the
  duration of this checklist, or scenarios ②③④⑦ will appear to "hang" at
  `entitled: false` forever even after a successful store purchase.
- **Store review/activation state matters.** A product not yet "Active"
  (Play) or still under review (ASC) will not offer a sandbox/test purchase
  at all — this is a console-configuration gap, not an app bug.
- **Sandbox renewal clocks are compressed, not real days** — a "7-day
  trial" or "1 month" subscription renews/expires far faster in sandbox
  (Apple's sandbox accelerates renewal periods to minutes; Play's
  license-testing subscriptions also renew on an accelerated schedule).
  Consult each store's current developer documentation for the exact
  compression ratio at test time — do not assume real-world timing, and do
  not fail scenario ④ just because "a week" didn't literally pass.
- **Decline/billing-issue simulation is not equally supported everywhere.**
  Some sandbox/license-testing environments offer an explicit way to force
  a decline or grace-period state (e.g. Play license-testing's
  test-response configuration); others do not have a reliable
  self-service decline trigger. If your current store tooling has no
  decline-simulation path available, mark ⑦ as "not exercised in sandbox
  (store limitation)" rather than FAIL — do not claim SUCCESS or leave it
  unmarked.
- **This checklist covers no listing/marketing copy** (app-store
  description, screenshots, keywords — M10) and no real credentials/`.env`
  secrets are recorded here.

## §5 Sign-off

| Field | Value |
|---|---|
| Date | |
| Tester | |
| Build id (dev-client) | |
| iOS sandbox account used | |
| Android license-tester account used | |
| ① | PASS / FAIL |
| ② | PASS / FAIL |
| ③ | PASS / FAIL |
| ④ | PASS / FAIL |
| ⑤ | PASS / FAIL |
| ⑥ | PASS / FAIL |
| ⑦ | PASS / FAIL / not exercised (store limitation) |
| ⑧ | PASS / FAIL |
| ⑨ | PASS / FAIL |
| Blocker notes | |

This sign-off table is the artifact the founder completes at the C2
checkpoint.
