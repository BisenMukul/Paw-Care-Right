# Store setup — App Store Connect, Play Console, RevenueCat (T071)

## 1. Purpose & scope

This document configures the two app-store consoles and the RevenueCat
(RC) dashboard so a human can enter the products, prices, and RC wiring for
"Plus" without guessing. Entitlement is **server-owned**: RC webhooks mirror
into the backend `Subscription` model (SPEC §7), and the mobile client
**never self-declares premium**. This task (T071) wires only the client
SDK boot (`apps/mobile/src/billing`) and purchaser identity; it does not
implement the paywall UI (T073), entitlement gating (T072/T074), or the
server-side webhook (`POST /billing/rc-webhook`, out of scope here).

This doc contains **no listing/marketing copy** (app-store description,
screenshots, keywords) — that is reviewed at the M10 checkpoint. It
describes only product-ids, prices, and console mechanics.

## 2. Fixed identifiers table

| Identifier | Value |
|---|---|
| iOS bundle id | `com.pawcareright.app` |
| Android package (bundle id) | `com.pawcareright.app` |
| RevenueCat entitlement id | `plus` |
| RevenueCat offering id | `default` |
| Product id — monthly | `pawcareright_monthly` |
| Product id — annual | `pawcareright_annual` |
| Product id — family (annual) | `pawcareright_family_annual` |
| RC package id — monthly | `$rc_monthly` |
| RC package id — annual | `$rc_annual` |
| RC package id — family | `family` |

These strings are the single source of truth in
`apps/mobile/src/billing/products.ts` (CLAUDE.md §1a naming — no `+`/spaces
in identifiers); a unit test (`__tests__/purchases.test.ts`) pins the
constants against this table so the two can never drift. When configuring
either console or the RC dashboard, copy these values exactly.

## 3. Regional pricing (verbatim from PRODUCT_SPEC.md §7)

| Plan | US anchor | Notes |
|---|---|---|
| Monthly | $5.99 | 7-day trial via onboarding paywall |
| Annual | $39.99 (~44% off) | default-highlighted plan |
| Family (annual) | $59.99 | household-scoped, unlimited members+pets |

- **Regional tiers via RevenueCat offerings** (launch groups): Tier B
  (India, Indonesia, Vietnam, Egypt, Pakistan, Nigeria): ~35–40% of US price
  (e.g., ₹149/mo, ₹999/yr). Tier C (Brazil, Mexico, Turkey, Philippines,
  MENA ex-GCC): ~50–60%. Tier A (US/CA/EU/UK/AU/JP/GCC): anchor.
- Free tier limits per F8; counters are server-side (Redis) so limits
  survive reinstall. Not configured in either store console — enforced in
  `apps/api` (F8/T072), out of scope for this doc.

## 4. App Store Connect — step by step

1. In App Store Connect, open the app record for bundle id
   `com.pawcareright.app` (My Apps → Paw Care Right +).
2. Go to **Monetization → Subscriptions** and create a **subscription
   group** (e.g. "Plus"). Auto-renewable subscriptions in the same group
   let a user upgrade/downgrade between monthly and annual without a new
   purchase flow.
3. Inside that group, add two subscriptions:
   - Product id `pawcareright_monthly`, reference name "Plus Monthly".
   - Product id `pawcareright_annual`, reference name "Plus Annual".
4. Add `pawcareright_family_annual` ("Plus Family Annual"). Recommendation:
   put it in its **own subscription group** ("Plus Family") rather than the
   individual group, since family is a distinct household-scoped tier, not
   an upgrade path from the individual plans — note this choice in the RC
   dashboard step (§6) when attaching products to the `plus` entitlement.
5. For each subscription, set per-region prices using the tier table in §3
   (Tier A/B/C). App Store Connect's price tiers auto-populate most
   currencies from the US anchor; override the Tier B/C regions manually to
   match the ~35–60% ratios above.
6. On `pawcareright_monthly`, add a **7-day free trial** introductory
   offer (SPEC §8's trial→paid funnel: `paywall_view` → `trial_start` →
   `trial_to_paid`). Do not add a trial to the annual or family products
   (trial only gates entry via the monthly plan per the onboarding paywall).
7. Submit each subscription for review alongside the next build; keep
   reference names consistent with §2's identifier table so RC dashboard
   configuration (§6) is unambiguous.

## 5. Google Play Console — step by step

1. In Play Console, open the app for package `com.pawcareright.app`.
2. Go to **Monetize → Products → Subscriptions**. Play's model is one
   **subscription product** containing multiple **base plans** (unlike
   ASC's per-plan products) — to keep parity with the three distinct iOS
   product ids in §2, create **one subscription product per plan** here
   too, each with a single base plan:
   - Product id `pawcareright_monthly`, one base plan (monthly billing).
   - Product id `pawcareright_annual`, one base plan (annual billing).
   - Product id `pawcareright_family_annual`, one base plan (annual
     billing, household-scoped).
3. On the `pawcareright_monthly` base plan, add a **7-day free-trial
   offer** (mirrors the ASC introductory offer in §4.6).
4. For each base plan, set regional prices per the tier table in §3
   (Tier A/B/C); Play Console lets you set a price per country/region
   directly.
5. Activate all three products once pricing is confirmed.

## 6. RevenueCat dashboard — step by step

1. Create a new RC project (e.g. "Paw Care Right +").
2. Add an **iOS app** to the project: supply the App Store Connect shared
   secret (App-Specific Shared Secret, from ASC → App Information → App
   Store Connect API / In-App Purchase). Bundle id `com.pawcareright.app`.
3. Add an **Android app** to the project: supply the Play service-account
   credentials (Google Play Console → API access → service account JSON
   with subscription/order read access). Package `com.pawcareright.app`.
4. Create entitlement `plus`.
5. Register the three store products from §2
   (`pawcareright_monthly`, `pawcareright_annual`,
   `pawcareright_family_annual`) on their respective store apps.
6. Attach all three products to the `plus` entitlement (this is what makes
   RC's `logIn`-identified purchaser resolve to entitlement `plus`
   regardless of which plan they bought).
7. Create offering `default` with three packages:
   - `$rc_monthly` → `pawcareright_monthly`.
   - `$rc_annual` → `pawcareright_annual`; mark this package
     **default-highlighted** in the offering (SPEC §7: annual is the
     default-highlighted plan).
   - Custom package id `family` → `pawcareright_family_annual` (RC has no
     reserved `$rc_*` token for a family tier, hence the custom id — see
     `apps/mobile/src/billing/products.ts`).
8. Publish the `default` offering as the current offering for the project.

## 7. Keys & env wiring (stub vs. real)

- **Dev boot (no real credentials needed):** the mobile app ships built-in
  stub defaults `stub_ios_key` / `stub_android_key` (see
  `apps/mobile/app.config.js` `extra` and `apps/mobile/src/config.ts`). RC's
  `configure()` accepts any non-empty string offline, so the SDK boots and
  the app runs in dev without ever touching the RC dashboard — this is the
  T071 acceptance criterion ("SDK boots in dev with stub keys").
- **Real values:** RC dashboard → Project settings → **API keys** → copy
  the **public** app-specific SDK key for each platform (iOS key, Android
  key — these are safe under `EXPO_PUBLIC_*`, unlike the webhook signing
  secret, which is server-side and out of scope here).
- Supply them as environment variables, either locally
  (`EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_RC_ANDROID_KEY` in the mobile
  app's env) or as EAS build-time secrets/env vars for CI/production
  builds. No code change is required to switch from stub to real keys —
  `app.config.js` reads them at config-evaluation time via
  `process.env.EXPO_PUBLIC_RC_IOS_KEY ?? "stub_ios_key"` (and the Android
  equivalent).

## 8. EAS / dev-client note

`react-native-purchases` is a **native module**: it does not run inside
Expo Go and requires a custom dev client / EAS build to test on-device.
Add it to the project's dev-client rebuild list alongside the other native
modules already requiring a rebuild (`react-native-mmkv`,
`react-native-nitro-modules`) — installing or upgrading
`react-native-purchases` means the next dev build must go through
`eas build --profile development` (or a local `expo prebuild` + native
build) before device testing, not just a JS/Metro reload.

Installed via `npx expo install react-native-purchases` (Expo SDK 57
pairing); see `apps/mobile/package.json` for the pinned version.
