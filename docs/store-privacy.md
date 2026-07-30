# store-privacy.md — Store privacy declarations prep (T092)

**Status: PROVISIONAL until checkpoint C3.** The store display name (`Bombay Pet Company`) and bundle id (`com.bombaypetcompany.app`) are provisional until confirmed after T102's trademark pass (CLAUDE.md §1a) — every submission built from this document must be re-checked against whatever T102/C3 finalizes. Every block below marked `LEGAL-REVIEW (C3)` needs counsel or founder sign-off before it is entered into App Store Connect / Play Console; nothing in this document is a final legal position.

This document is internal store-submission preparation. It contains no medical, dosing, diagnostic, or user-facing guidance language, and it does not restate any AI result or safety copy. See `docs/store-setup.md` (T071) for console mechanics (how to actually fill in the forms) and `apps/web/src/legal/privacy-document.ts` (rendered via `apps/web/src/strings.ts`, T086) for the published, user-facing privacy policy text. This document is the code-derived cross-check against that published text, not a replacement for it.

---

## 1. How this document was derived

Every row below is derived **from the code that actually runs**, not from memory of the product spec or the shipped policy — the shipped policy (`apps/web/src/strings.ts:143-261`) is used only as a **cross-check**: where it disagrees with the code, the code's answer is what appears in the tables, and the disagreement itself is logged in §8, not silently reconciled or fixed here (that is a legally-reviewed copy change, out of scope for this card).

To re-verify any row, re-run the commands in §9 and re-read the file at the cited anchor. If the code has changed since this document was written, trust the code and treat this document as stale until updated — the drift guard (`packages/analytics/src/store-privacy-doc.spec.ts`) automatically fails CI when the PostHog appendix (Appendix A.1) or a cited code-anchor path drifts, but it cannot detect every kind of drift (e.g. a changed Sentry option), so §9's manual re-run is still required periodically and whenever the trigger list in §9 fires.

---

## 2. Data inventory

| Data type | What exactly | Code anchor | Purpose | Linked to user? | Shared? (store definition + recipients) | Retention | User control |
|---|---|---|---|---|---|---|---|
| Account email | `User.email` | `apps/api/prisma/schema.prisma:66-97` | Sign-in, account identity, transactional/legal email | Yes | No (processor) — recipients: none beyond our own infra today (no email provider is wired yet, see §7) | Until account deletion (+30-day grace, `ACCOUNT_DELETION_GRACE_DAYS`, `packages/types/src/account-privacy.ts:11`) | `DELETE /me` (`apps/api/src/me/privacy.controller.ts:54-61`); export via `POST /me/export` |
| Social sign-in identifiers | `User.appleSub` / `User.googleSub` | `apps/api/prisma/schema.prisma:66-97` | Authentication only | Yes | No (processor) — recipients: Apple / Google (as the OAuth/Sign-in-with-Apple provider itself, not a data recipient of ours) | Until account deletion (+30-day grace) | Same as above |
| Locale / region | `User.locale`, `User.region` | `apps/api/prisma/schema.prisma:71-72` | Localization, regional pricing/emergency numbers | Yes | No (processor) — recipients: none | Until account deletion (+30-day grace) | Same as above |
| Household membership | `Household`, `Membership` | `apps/api/prisma/schema.prisma:99-127` | Family sharing feature | Yes | No (processor) — recipients: none | Until account/household deletion | Leave household; `DELETE /me` |
| Push token | `Device.expoPushToken` | `apps/api/prisma/schema.prisma:129-139` | Deliver reminder push notifications | Yes | No (processor) — recipients: Expo push service | Until account deletion (+30-day grace) or device re-registration | `DELETE /me`; OS-level notification permission toggle |
| Pet profile | `Pet` (species, breedSlug, name, sex, neutered, birthDate/ageEstimateMonths, weightGrams, photoKey) | `apps/api/prisma/schema.prisma:173-195` | Core pet-profile feature, personalizes reminders/guidance | Indirectly (via household, not a named "user" field) | No (processor) — recipients: object storage (photo only), AI providers (structured attributes **and the pet's own name** — a `- Name: ${pet.name}` line is built directly into the triage prompt, `packages/ai/src/triage/user-turn.ts:86` — the closest thing to a free-text identifier this table sends to a third party, for guidance generation, see §3) | Until pet/household deletion | Edit/delete pet in-app; `DELETE /me` cascades per household role (see §7) |
| Symptom-check intake | `SymptomCheck.intakeJson`, `.photoKeys` | `apps/api/prisma/schema.prisma:214-244` | Generates AI triage guidance (never a diagnosis) | Yes (`createdById`) | Yes for the AI providers — recipients: Ollama Cloud (text+vision, intake text and photos), see §3/§6 `LEGAL-REVIEW (C3)` on processor-vs-third-party status | Until account/household deletion (hard-erased by the T091 cascade, not time-boxed separately) | `DELETE /me`; export via `POST /me/export` |
| Triage result | `TriageResult.resultJson`, `.urgency`, `.confidence` | `apps/api/prisma/schema.prisma:246-256` | Displays guidance to the user, powers follow-up | Yes (via `SymptomCheck`) | No beyond the AI provider that generated it (already counted above) | Same as `SymptomCheck` (cascade) | Same as `SymptomCheck` |
| Health-log entries | `HealthLog.valueJson`, `.photoKeys` (weight, meals, notes, vet visits, meds given, activity) | `apps/api/prisma/schema.prisma:321-336` | User-maintained pet health timeline | Yes (via `Pet`/household) | No (processor) — recipients: object storage (photos only) | Until pet/household deletion | Edit/delete entries in-app; `DELETE /me` |
| Reminders (incl. medication as entered) | `Reminder.title`, `.medNameAsEntered`, `.medDoseAsEntered`, rrule/schedule fields | `apps/api/prisma/schema.prisma:267-289` | Care/medication reminders. **Records what a vet prescribed; never suggests a dose** (CLAUDE §7 rule 2) | Yes (via `Pet`/household) | **Yes for `Reminder.title` — which for medication-course reminders IS the medication name — No (processor) for everything else.** `medDoseAsEntered` and schedule fields never leave our infra (recipients: none). `medNameAsEntered` has no independent egress path, **but** medication-course creation copies it verbatim into `Reminder.title` (`apps/api/src/reminders/medication-course.ts:66`; the mobile medication form submits no separate title — `apps/mobile/src/components/medication-course-form.tsx:104-116`), so for every medication-course reminder the pushed title **is** the medication name as entered (`LEGAL-REVIEW (C3)` — on a store form, "medication names are never disclosed to a third party" would be FALSE; a content-free medication push body is the §8b UX question). `Reminder.title` — the user's own free text — is embedded **verbatim** in the push notification `body` whenever exactly one enabled-type due event survives the notification-preference filter for a user in a given minute (`push-sender.service.ts:194-196`) (`buildReminderPushBody`, `apps/api/src/workers/push-sender.service.ts:34-38`, consumed at `push-sender.service.ts:196,209-215`), and that `body` is sent to **Expo's push relay service**, which then delivers it onward through **Apple's APNs (iOS) / Google's FCM (Android)** — three recipients of user content, not just of the `Device.expoPushToken` delivery token. When 2+ reminders collapse into one push, the body is instead the content-free `"{count} care reminders due"` string. See §3 "Expo push" for the full derivation. | Until pet/household deletion | Edit/delete reminders in-app; `DELETE /me` |
| Chat messages | `ChatMessage.content`, `.status`, `.nudgeCategory` | `apps/api/prisma/schema.prisma:392-406` | "Ask Bombay Pet Company" feature — AI guidance chat | Yes (via `ChatThread.createdById`) | Yes for the AI providers — recipients: Ollama Cloud (message content), see §3/§6 | Until account/household deletion (hard-erased by T091 cascade) | `DELETE /me`; export via `POST /me/export` |
| Subscription / purchase record | `Subscription.rawEventJson` (entire RevenueCat webhook body), entitlement/plan/status | `apps/api/prisma/schema.prisma:347-363` | Entitlement mirror for premium features | Yes (`rcAppUserId` == `User.id`) | No (processor per Play's definition; see §3/§6 `LEGAL-REVIEW (C3)` on RC's own processor terms) — recipients: RevenueCat | Until account deletion — cascade-deleted with the `User`/`Household` row (`onDelete: Cascade`, `schema.prisma:359-360`); **no separate time-boxed expiry job exists for this table** (verified: `apps/api/src/workers/account-deletion.service.ts` only purges `AccountExport`, never touches `Subscription`) | `DELETE /me` |
| AI audit log | `AiAuditLog` (ids, prompt/model versions, detector flag codes, cost, latency — **no content columns**) | `apps/api/prisma/schema.prisma:408-425,453-472` | Safety/quality audit trail, cost tracking | Loosely (`checkId`/`threadId`, no direct FK) | No — internal only | 90 days, `AiAuditRetentionService`'s sweep | Not directly user-facing (contains no content to export/delete beyond the automatic 90-day sweep; also hard-deleted by the T091 erasure cascade, `account-erasure.service.ts:294-298`) |
| Account export bundle | `AccountExport.objectKey` (a full personal-data JSON in S3) | `apps/api/prisma/schema.prisma:439-451` | Fulfils the user's own data-portability request | Yes | No — recipient is the requesting user only (presigned URL) | `ACCOUNT_EXPORT_RETENTION_DAYS` = 7 days (`packages/types/src/account-privacy.ts:14`), purged by the same daily sweep (`account-deletion.service.ts:117-138`) | `POST /me/export` requests it; auto-expires after 7 days |
| Refresh tokens | `RefreshToken.tokenHash` (hashed, not raw) | `apps/api/prisma/schema.prisma:157-171` | Session/auth | Yes | No — internal only | Until expiry/rotation/account deletion | Sign-out; `DELETE /me` |
| Notification preferences | `UserNotificationPrefs` (disabled types, quiet hours, timezone) | `apps/api/prisma/schema.prisma:146-155` | Lets user tune reminder delivery | Yes | No — internal only | Until account deletion | Settings screen; `DELETE /me` |
| Analytics events | `AnalyticsEventMap` (`first_check_completed`, `paywall_view`, `trial_start`, `ota_available`, `ota_downloaded`, `ota_applied`) — ids + coarse enums/numbers only, **never free text/photos/AI-result fields** | `packages/analytics/src/events.ts:20-51` | Product analytics + OTA rollout health (T117, `docs/OTA_UPDATES.md` §7) | Yes (`distinctId` = backend user UUID, never an email — see §3) | Yes — recipient: PostHog (self-hosted-or-cloud analytics processor) | Vendor-side (PostHog project retention setting) — `LEGAL-REVIEW (C3)`, not code-derivable | Settings analytics toggle (`useConsentStore` client-side, `User.analyticsOptOut` server-side, both fail-closed) |
| Device app-version / OTA update id (T117) | `Device.appVersion`, `Device.otaUpdateId` — machine version identifiers, no new PII | `apps/api/prisma/schema.prisma` | Coarse `/v1/meta/client-versions` admin-read cross-check for the T111 dashboard (§7 D5: PostHog `ota_applied` is the authoritative adoption curve, this is a coarse cross-check over push-registered devices only) | Yes (via `Device.userId`) | No (processor) — recipients: none beyond our own infra | Same as the owning `Device` row (until account deletion +30-day grace, or token re-registration) | Same as the `Device` row above (`DELETE /me`); erased by the existing `Device` cascade — no new model, so no erasure-guard edit was needed |
| Crash/error reports | Post-scrub Sentry event (see §3/Appendix A.2) | `packages/analytics/src/sentry/scrub.ts` | Crash/error diagnostics | No user identifier reaches Sentry at all (no `Sentry.setUser` call anywhere in the codebase — verified by grep, see §9) | Yes — recipient: Sentry | Vendor-side (Sentry project retention setting) — `LEGAL-REVIEW (C3)` | Analytics/error reporting is not independently toggleable from the analytics consent switch today — a gap, see §8 |

---

## 3. Third-party recipients

### PostHog
What it receives: exactly the six typed events in `AnalyticsEventMap` (`packages/analytics/src/events.ts:20-51`) — `first_check_completed { checkId, householdId, status, urgency }`, `paywall_view { source, householdId? }`, `trial_start { householdId, plan }`, and (T117, `docs/OTA_UPDATES.md` §7) `ota_available { channel, currentUpdateId }`, `ota_downloaded { channel, currentUpdateId, critical }`, `ota_applied { updateId, fromUpdateId, latencyMs }` — plus the standard PostHog `capture` wire envelope (`api_key`, `event`, `distinct_id`, `properties`, `timestamp`, `packages/analytics/src/http-transport.ts:20-41`). `distinct_id` is always the backend `User.id` UUID: the mobile emitter reads `useAuthStore.getState().user?.id` (`apps/mobile/src/analytics/analytics.ts:26-32`), the check worker passes `userId` (`apps/api/src/workers/check-runner.processor.ts:93`), and the RC-webhook emitter passes `event.app_user_id`, which is the same backend `User.id` because `identifyPurchaser` calls `Purchases.logIn(backendUserId)` (`apps/mobile/src/billing/purchases.ts:143-154`; consumed at `apps/api/src/billing/rc-webhook.service.ts:96-106`). **PostHog therefore never receives an email address, name, or free-text field** — see the compile-time guard note below.

What it provably does not receive + the guard: any event name or property not declared in `AnalyticsEventMap` is a `tsc` compile error, proven by `events.spec.ts`'s `@ts-expect-error` cases (`packages/analytics/src/events.ts:20-51`) — the "typed-event-map compile gate" (D4). This guarantees no free text, photo, or AI-result field (`summary`/`possibleCauses`/`redFlagsToWatch`/`homeCare`/`doNot`/`vetQuestions`) can ever be added to a PostHog payload without a corresponding, reviewable interface change (which this same document's drift guard, §D5, would then also require updating).

Two gates independently control emission: the client `useConsentStore` (default ON, `apps/mobile/src/analytics/consent-store.ts`, gates the mobile emitter only) and the server `User.analyticsOptOut` flag read fail-closed by `AnalyticsService.captureForUser` (`apps/api/src/analytics/analytics.service.ts:50-81` — an unresolvable consent read, or a missing user row, means "never emit," not "assume opted in").

Honesty note: a PostHog capture is an HTTPS POST, so PostHog's own ingest infrastructure sees the **client IP address** of the request regardless of what is in the JSON payload above. Whether that IP is retained, GeoIP-resolved, or discarded is a PostHog **project setting**, not a fact this codebase controls — `LEGAL-REVIEW (C3)`.

Retention/ownership: vendor-side (PostHog project setting) — `LEGAL-REVIEW (C3)`.

### Sentry
What it receives: a heavily scrubbed error event. `sendDefaultPii: false` and `tracesSampleRate: 0` are pinned in the shared factory (`packages/analytics/src/sentry/options.ts:44-59`), consumed identically by all three apps (`apps/api/src/observability/sentry.ts:31-59`, `apps/mobile/src/observability/sentry.ts:31-72`, `apps/web/src/observability/options.ts` + `apps/web/instrumentation.ts` / `apps/web/instrumentation-client.ts`) — no call site may override `beforeSend`/`beforeBreadcrumb`. What survives: `event_id`, `message`/`exception` (redacted, see below), `level`, `release`, `environment`, and `user.id` **only if the SDK itself ever calls `Sentry.setUser`** — which it never does anywhere in this codebase (`rg -n "setUser" apps packages` returns no matches, verified §9) — so in practice **no user identifier reaches Sentry at all**. The api additionally tags `requestId` only (`apps/api/src/observability/sentry.ts:68-80`).

What it provably does not receive + the guard: `request.data`/`cookies`/`query_string`/`env`/any unenumerated field is dropped **by omission** because `scrubRequest` rebuilds `request` as an allowlist of `url` (truncated at `?`), `method`, and 4 allowlisted headers (`scrubSentryEvent`, `packages/analytics/src/sentry/scrub.ts:139-163`) — a new SDK field can never leak because it is never copied in the first place. Breadcrumb `message` is dropped wholesale on every breadcrumb regardless of category, and `console`-category breadcrumbs are dropped entirely (`scrub.ts:171-210`) — this closes the channel where `@nestjs/common`'s `ConsoleLogger`/`console.error` calls would otherwise leak an arbitrary formatted log line and its raw argument array as a Sentry breadcrumb. Every remaining string in the event is walked and redacted for `Bearer ...` tokens, JWT-shaped strings, and email addresses (`redactDeep`/`redactString`, `scrub.ts:78-127`). Any internal scrub failure returns `null` (drops the event) — fail closed.

Nuance (not swept under the rug): the mobile `captureError(error, context)` helper's `context` argument is **not structurally dropped** the way `request.data` is — it survives as `Sentry.setContext("error_context", context)` (`apps/mobile/src/observability/sentry.ts:79-95`) and is only protected by the same pattern-level string redaction as everything else. Its two real call sites pass `{ componentStack }` (`apps/mobile/src/error-boundary.tsx:24`) and `{ isFatal }` (`apps/mobile/src/startup-guard.ts:55`) — neither is free-form user content today, but this is a narrower guarantee than `request.data`'s structural drop, and a future call site that passes free text would not be caught structurally. Recorded here as a finding, not fixed (out of scope for a doc-only card).

Retention/ownership: vendor-side (Sentry project setting) — `LEGAL-REVIEW (C3)`.

### RevenueCat
What the SDK receives: the backend `User.id` as RC's `appUserID` (`Purchases.configure({ appUserID: null })` then `identifyPurchaser` → `native.logIn(userId)`, `apps/mobile/src/billing/purchases.ts:107-154`), plus whatever the underlying store SDK (App Store/Play Billing) itself sends to RevenueCat for the transaction: receipt/purchase token, product id, price/currency, store country, and device/platform metadata (standard RC SDK behavior, not separately configurable in this codebase). Verified by grep that no email/name/attribute call exists: `rg -n "setAttributes|setEmail|setDisplayName|setPhoneNumber" apps/mobile` returns no `setAttributes`/`setDisplayName`/`setPhoneNumber` matches at all, and its only `setEmail` matches (2 hits, both in `apps/mobile/app/(auth)/email.tsx:16,75`) are the same unrelated local component `useState` setter in the sign-in email screen, not an RC call — the grep scope above is `apps/mobile` only (not the whole repo), and re-scoping it repo-wide (`apps/mobile apps/api packages`) surfaces no additional hits either.

What the webhook delivers: RevenueCat POSTs to `POST /billing/rc-webhook`, and the **entire raw event body is persisted verbatim** as `Subscription.rawEventJson` (`apps/api/src/billing/rc-webhook.service.ts:76-89`; column at `apps/api/prisma/schema.prisma:355`). This is the one place in the first-party data model where a third party's full payload — not a curated subset — is stored. Retention: cascade-deleted only when the owning `Household` or `User` row is deleted (`onDelete: Cascade`, `schema.prisma:359-360`, exercised by `apps/api/src/me/account-erasure.service.ts:135-145,188-195`); verified against `apps/api/src/workers/account-deletion.service.ts` that **no other sweep or expiry job ever touches `Subscription`** — it has no time-boxed retention independent of account deletion.

Retention/ownership of what RC itself keeps: vendor-side (RC's own retention/DPA terms) — `LEGAL-REVIEW (C3)`.

### AI providers (Ollama Cloud / Gemini)
Per `docs/AI_PROVIDERS.md` and `packages/ai/src/providers/types.ts`, this is the **largest third-party disclosure in the product**: symptom-intake text and pet attributes (`TextGenerateOptions.prompt`/`.messages`), photos attached to a symptom check (`VisionGenerateOptions.images[]`, base64 or URL), and chat message content are sent to **Ollama Cloud** for triage/food-safety/chat text and vision reasoning; **Gemini** is used only for non-safety image generation (breed illustrations/marketing art) and never receives triage/health content. No app module calls a vendor SDK directly — only `packages/ai`'s provider registry does (`docs/AI_PROVIDERS.md §2`).

What it provably does not receive: dosing instructions or drug-administration recommendations are never generated or requested (CLAUDE §7 rule 2; enforced by the safety system prompt + red-team evals, `packages/ai` — not re-verified in this doc-only card, no `packages/ai` file is in this card's file list).

Retention/ownership: **not code-derivable** — these are the vendors' own terms. Do not assert a retention period as fact. `LEGAL-REVIEW (C3)`.

### Object storage (S3-compatible / MinIO)
What it receives: pet photos, symptom-check photos, health-log photos, and full account-export JSON bundles (`apps/api/src/storage/storage.service.ts`). Retention: tied to the owning row's lifecycle — erased by the T091 cascade (`account-erasure.service.ts`'s `listKeys`/`deleteObjects` calls) or, for export bundles specifically, by the 7-day `ACCOUNT_EXPORT_RETENTION_DAYS` sweep (`account-deletion.service.ts:117-138`). Not a third party in the "vendor with its own use of the data" sense — it is infrastructure we operate/contract, holding exactly what the product stores.

### Expo push
What it receives: `Device.expoPushToken`, plus the actual notification content — a fixed `title` (`APP_DISPLAY_NAME`, never user data) and a `body` string. **The `body` is not always content-free.** `buildReminderPushBody` (`apps/api/src/workers/push-sender.service.ts:34-38`) returns a content-free `{count} care reminders due` string when 2+ reminders collapse into one push, but returns `Care reminder: {singleTitle}` when exactly one reminder is due — and `singleTitle` is the user's own free-text `Reminder.title`, read and forwarded **verbatim**, never summarized or redacted (`push-sender.service.ts:196`, embedded into the outgoing message at `:209-215`). No symptom-check, health-log, or chat content is ever put in a push body — only a reminder title, in this one path. **For medication-course reminders that title IS the medication name as entered** (creation copies `medNameAsEntered` verbatim into `Reminder.title`, `apps/api/src/reminders/medication-course.ts:66`, and the mobile form submits no separate title — `apps/mobile/src/components/medication-course-form.tsx:104-116`), so a lone due dose produces `Care reminder: <medication name>` transiting Expo → APNs/FCM (`LEGAL-REVIEW (C3)`, §8b). Expo's push relay is the direct recipient of that body; Expo then delivers the notification onward through **Apple's APNs** (iOS) or **Google's FCM** (Android) to reach the device, so both are also recipients of the reminder title in the single-reminder case. Retention: until token rotation or account deletion.

---

## 4. Apple privacy nutrition labels

| Data type (Apple category → type) | Collected? | Linked to user? | Used for tracking? | Purposes | Our data (from §2) |
|---|---|---|---|---|---|
| Contact Info → Email Address | Yes | Yes | No | App Functionality, Account Management | `User.email` |
| Identifiers → User ID | Yes | Yes | No | App Functionality | `User.id` (backend UUID; also the PostHog `distinct_id` and RC `appUserID`) |
| Identifiers → Device ID | Yes (see reasoning) | Yes | No | App Functionality | `Device.expoPushToken` is a push-delivery token, not a hardware/advertising device identifier, but Apple's own taxonomy treats push tokens as falling under this category when linked to a user for delivery purposes — declared here rather than omitted, since App Functionality use of a device-scoped token is exactly what this category anticipates |
| User Content → Photos or Videos | Yes | Yes | No | App Functionality | `Pet.photoKey`, `SymptomCheck.photoKeys`, `HealthLog.photoKeys` |
| User Content → Other User Content | Yes | Yes | No | App Functionality | Symptom-check intake text, chat message content, health-log notes, reminder titles/med-as-entered fields — note: `Reminder.title` also reaches Expo's push relay and, onward, Apple's own APNs / Google's FCM verbatim when it is the sole due reminder in a push — and for medication-course reminders that title IS `medNameAsEntered`, the medication name (§2 Reminders row, §3 Expo push, §8b) — this is the one row in this table whose content is also disclosed to a delivery-chain recipient beyond our own infra/AI providers |
| Usage Data → Product Interaction | Yes | Yes | No (see §4.2) | Analytics | The 3 `AnalyticsEventMap` events (Appendix A.1) |
| Diagnostics → Crash Data | Yes | No (see §3 Sentry — no `setUser` call anywhere) | No | App Functionality | Sentry post-scrub events |
| Diagnostics → Other Diagnostic Data | Yes | No | No | App Functionality | Sentry `requestId` tag (api only), performance/latency is NOT collected (`tracesSampleRate: 0`) |
| Purchases → Purchase History | Yes | Yes | No | App Functionality | `Subscription` mirror + RC SDK purchase records |
| Pet health data (symptom checks, triage results, health-log entries, med-as-entered) | Yes | Yes | No | App Functionality | See §4.1 below — classification is provisional |

### 4.1 Open question — how pet health data maps

Apple's "Health & Fitness → Health" category is scoped, by Apple's own published definition, to *the user's own* health/medical data (HealthKit data, Clinical Health Records, health research data, or "user-provided health or medical data" **about the person**). Symptom intake, triage results, health-log entries, and medication-as-entered records in this product describe an **animal**, not the user filling out the form. The app makes no HealthKit call anywhere in the codebase.

- **Candidate mapping A (provisional default): "Other Data."** Argument: the data is not about the user's own health per Apple's stated scope; the app touches no HealthKit API; "Other Data" with purpose "App Functionality" and "linked to user" = yes, "used for tracking" = no, accurately describes what the data is and how it is used without importing HealthKit-shaped review expectations the app does not warrant.
- **Candidate mapping B (over-declaration alternative): "Health & Fitness → Health."** Argument: a health-adjacent, symptom-and-triage product may read as user-health-like to a reviewer regardless of the "about an animal, not the user" technicality, and choosing the stricter category up front removes any risk of an App Review rejection for under-declaring — at the cost of inviting HealthKit-shaped scrutiny (and user expectations) for an app that implements no HealthKit integration.

**Provisional answer: Mapping A ("Other Data")** — this is the reading Apple's own published text supports. **`LEGAL-REVIEW (C3)`: counsel or the founder must confirm this classification before submission; this document does not settle it.**

**Cross-store note:** the identical ambiguity applies to Google Play's "Health and fitness → Health info" category (§5) — Play's category is likewise oriented around the *user's own* health, and this product's data is about an animal. §5 records the same provisional/`LEGAL-REVIEW (C3)` treatment for its category choice, and §8b carries a dedicated row so both stores are resolved together by counsel, not one settled while the other stays open.

### 4.2 Tracking

"Data Used to Track You: **none**" — evidenced by the step-5 negative greps (§9): no location API import (`expo-location`/`getCurrentPosition`/`Geolocation`: no matches), no ad/tracking SDK or ATT usage (`expo-tracking-transparency`/`AdSupport`/IDFA/`advertisingId`/`appsflyer`/`adjust`/`branch`: no matches — the only incidental grep hits were the unrelated English words "adjust"/"branch" in code comments/strings and a "facebook" hit that is Sign-in-with-Facebook social auth in a test file, `apps/api/test/auth-social.e2e-spec.ts:344`, not an ads/tracking SDK), and no ad network dependency in any `package.json`.

`LEGAL-REVIEW (C3)`: this "none" answer describes what **our code** does. Whether PostHog, Sentry, or RevenueCat's own SDK configuration could constitute "tracking" under Apple's definition (e.g. cross-app/cross-site correlation) is a function of **their** configuration and terms, not something this codebase can prove a negative about — flagged, not asserted as settled.

---

## 5. Google Play Data Safety

| Data type (Play category → type) | Collected | Shared | Processed ephemerally | Required or optional | Purposes |
|---|---|---|---|---|---|
| Personal info → Email address | Yes | No | No | Required | Account management |
| Personal info → User IDs | Yes | No | No | Required | App functionality, analytics |
| Photos | Yes | No (processors only — S3, AI providers per §3/§6) | No | Optional (photos are optional on a symptom check/health log) | App functionality |
| App activity → Other user-generated content | Yes | **Yes for `Reminder.title`** (Expo push relay → Apple APNs/Google FCM, verbatim, when it is the sole due reminder in a push — §2 Reminders row, §3 Expo push) — No (processors only) for everything else in this category | No | Required for core features | App functionality |
| App activity → App interactions | Yes | Yes — PostHog | No | Optional (analytics opt-out exists) | Analytics |
| Financial info → Purchase history | Yes | No (processor — RevenueCat; see §3/§6 `LEGAL-REVIEW (C3)` on RC's own terms) | No | Required for premium features | App functionality |
| App info and performance → Crash logs | Yes | Yes — Sentry | No | Required (cannot be disabled independently — see §8 gap) | Analytics/diagnostics |
| Health and fitness → Health info **(category choice itself is provisional — `LEGAL-REVIEW (C3)`, see below)** (pet symptom/triage/health-log data) | Yes | Yes for the AI providers (§3/§6, `LEGAL-REVIEW (C3)` on processor-vs-third-party status), No otherwise | No | Required for core features | App functionality |

**The "Health and fitness → Health info" category choice above is provisional, not settled** — the same ambiguity §4.1 refuses to settle for Apple applies here: Play's "Health info" definition is, like Apple's "Health & Fitness → Health," oriented around a person's own health, and this product's symptom/triage/health-log data is about an animal, not the user. Declaring it under Play's "Health info" category (rather than a plainer "App activity" bucket) is exactly §4.1's Mapping-B (over-declaration) reasoning, adopted here as the provisional default because Play's own category name is a closer semantic fit than any alternative in its fixed taxonomy — but **which category is correct is a counsel decision, not a code fact**, cross-referenced in §4.1 and logged as its own row in §8b so C3 resolves both stores together rather than one being settled while the other is flagged.

Security-section answers:
- **Data encrypted in transit?** Yes, as a **deployment property** (HTTPS termination at the load balancer/CDN in front of the api and web apps) — this is not something asserted inside the application code itself; the app's own HTTP clients target `https://` base URLs by configuration, but TLS termination and enforcement live in the deployment layer, not in a line of code this document can cite.
- **Can users request data deletion?** Yes. In-app path: `DELETE /me` (`apps/api/src/me/privacy.controller.ts:54-61`), surfaced in Settings → Privacy & data. Email route: the published policy's contact address (`apps/web/src/strings.ts:254-259`) for anything the in-app flow does not cover (e.g. an owner of a shared household with other members, which the in-app flow rejects with a 409 and requires manual handling).
- **Optional/declinable collection:** the analytics opt-out (`useConsentStore` / `User.analyticsOptOut`) is the one collection category the user can decline while continuing to use the app's core features.

### 5.1 Known gaps
Play's Data Safety section also expects a publicly reachable **web deletion-request URL** as an alternative/companion to the in-app flow. The web app (`apps/web`) currently ships no such page — what exists today is the privacy-policy contact email (`apps/web/src/strings.ts:254-259`) and the in-app `DELETE /me` flow. This is recorded here as a gap for the founder/C3 to resolve (build a `/privacy/delete-request` page or equivalent before Play submission); **building it is out of scope for this doc-prep card.**

---

## 6. What we do NOT collect

| Not collected | Guard that makes it true | Pinning test |
|---|---|---|
| Location data | No location API is imported anywhere: `rg -n "expo-location\|getCurrentPosition\|Geolocation" apps packages` returns no matches (§9) | None dedicated — absence is structural (no dependency, no import) |
| Advertising/tracking identifiers (IDFA, AAID, etc.) | No ad/tracking SDK or ATT usage anywhere: `rg -n "expo-tracking-transparency\|AdSupport\|IDFA\|advertisingId\|appsflyer\|adjust\|branch"` returns no real matches (§9) | None dedicated — absence is structural |
| Contacts / calendar / microphone access | No corresponding Expo module or permission declared: `rg -n "expo-contacts\|expo-calendar\|expo-av\|NSMicrophone\|READ_CONTACTS" apps` returns no matches; `apps/mobile/app.config.js` declares no such permission overrides | None dedicated — absence is structural |
| Raw payment-instrument data (card numbers, IBANs) | Never touches api code: `rg -n "card\|iban\|paymentMethod" apps/api/src` (excluding specs) returns no *real* matches — only 2 incidental hits of the English word "card" in code comments (`apps/api/src/checks/check-status.ts:4`, in "task's **card**"; `apps/api/src/workers/images.processor.ts:65`, in "this task's **card** scopes") — all payment handling is delegated to the App Store/Play Billing/RevenueCat SDK, which this codebase never intermediates | None dedicated — absence is structural |
| Free-text/PII in PostHog events | The typed-event-map compile gate: an unknown event name or a property not declared in `AnalyticsEventMap` is a `tsc` compile error | `packages/analytics/src/events.spec.ts` (`@ts-expect-error` cases) |
| Request bodies / cookies / query strings in Sentry | `scrubRequest`'s structural allowlist (`url` truncated at `?`, `method`, 4 allowlisted headers only) | `packages/analytics/src/sentry/scrub.spec.ts` |
| Console/log-line free text in Sentry breadcrumbs | `scrubBreadcrumb`'s wholesale `message` drop + `console`-category drop | `packages/analytics/src/sentry/scrub.spec.ts` |
| Any user identifier in Sentry (`user.id`/email) | `sendDefaultPii: false` pinned + no call site anywhere calls `Sentry.setUser` (verified by grep, §9) | `packages/analytics/src/sentry/options.spec.ts` |
| Analytics events for a user who opted out | Two independent fail-closed gates: client `useConsentStore` (mobile emitter) and server `AnalyticsService.captureForUser` reading `User.analyticsOptOut` (fails closed on missing user or read error) | `apps/api/src/analytics/analytics.service.spec.ts`; `apps/mobile/__tests__/analytics-consent.test.ts` |
| Email/name/attributes sent to RevenueCat | No `setAttributes`/`setEmail`/`setDisplayName`/`setPhoneNumber` call anywhere in `apps/mobile` (verified by grep, §9) — RC only receives the backend user UUID via `logIn` | None dedicated — absence is structural |
| Dosing instructions sent to or generated by AI providers | Enforced by the safety system prompt + red-team evals in `packages/ai` (CLAUDE §7 rule 2) — not re-verified in this doc-only card since no `packages/ai` file is in this card's file list | `packages/ai`'s own eval harness (`pnpm test:ai-evals`), out of scope here |

---

## 7. User controls and retention (T091)

- **Analytics opt-out:** `GET/PUT /me/privacy` (`apps/api/src/me/privacy.controller.ts:31-45`), backed by `accountPrivacySettingsSchema`/`updateAccountPrivacySettingsSchema` (`packages/types/src/account-privacy.ts:19-28`). Mirrored client-side by `useConsentStore`.
- **Full data export:** `POST /me/export` (`privacy.controller.ts:47-52`) builds an ownership-filtered JSON bundle (user, household, pets, checks+results+follow-ups, health logs, reminders+events, chat threads+messages, notification prefs, subscription mirror, devices, photo download links) — `apps/api/src/me/account-export.service.ts:95-275`. Bundle expires and is purged after `ACCOUNT_EXPORT_RETENTION_DAYS` = 7 days (`packages/types/src/account-privacy.ts:14`), same daily sweep as deletion (`apps/api/src/workers/account-deletion.service.ts:117-138`). Delivery today is a dev-log link stub only — no email provider is wired yet (`account-export.service.ts:66-85`); a founder-tracked gap, not fixed here.
- **Account deletion + grace:** `DELETE /me` (`privacy.controller.ts:54-61`) schedules `User.deletionScheduledAt` = now + `ACCOUNT_DELETION_GRACE_DAYS` = 30 days (`packages/types/src/account-privacy.ts:11`); a sign-in during the window cancels it. A daily sweep (`AccountDeletionService.sweep`, `account-deletion.service.ts:51-115`) hard-erases every user whose grace period has elapsed via `AccountErasureService.erase` (`apps/api/src/me/account-erasure.service.ts`), which cascades DB rows, hard-deletes `AiAuditLog` rows by id (no FK), and deletes the associated S3 object keys (photos + any pending export). An `OWNER` of a shared household with other members is rejected (409) and must be handled manually — a known, documented limitation, not a bug.
- **What survives in a shared household:** for a `MEMBER` (not the sole `OWNER`), the household, its pets, health logs and reminders survive; only the leaving member's own checks/chat threads/quota counters/refresh tokens/devices/export rows/subscription mirror are erased. For the sole `OWNER` of a household with no other members, the entire household (pets, health logs, reminders) is erased with the account.
- **Export-bundle expiry:** see above — 7 days, same sweep as account deletion.

---

## 8. Discrepancies and open items

### 8a. Discrepancies found against the shipped policy (`apps/web/src/strings.ts:143-261`)

| # | Shipped policy text | What the code actually shows | Anchor(s) | Marker |
|---|---|---|---|---|
| D1 | "we collect account details such as your name, email address..." (`whatWeCollect`, `apps/web/src/strings.ts:159-161`) | `User` has **no name column** — only `email`, `appleSub`, `googleSub`, `locale`, `region` | `apps/api/prisma/schema.prisma:66-97` | `LEGAL-REVIEW (C3)` — the policy overstates collection; a name field does not exist anywhere in the schema. Fixing the copy is a separate, counsel-reviewed card. |
| D2 | "Photo EXIF metadata, including embedded location data, is stripped from your images before upload, so it is never sent to us or to our AI providers." (`aiGuidance`, `apps/web/src/strings.ts:174`) | The only **client-side, pre-upload** image code (`apps/mobile/src/pets/compress-image.ts:28-43`) is a resize + JPEG re-encode — re-encoding does drop EXIF in practice (no metadata is explicitly preserved by the manipulator call), but there is **no explicit "strip EXIF" step and no test pinning that guarantee**. Separately (and not what the policy sentence describes, since it speaks of "before upload"): the **server-side** derived-rendition pipeline (`apps/api/src/workers/images.processor.ts:14-71`) does explicitly bake in EXIF orientation via `.rotate()` and then re-encodes without `.withMetadata()`, stripping EXIF from the **derived** main/thumb renditions — but the **original uploaded object is kept as-is** ("The original object is kept," `images.processor.ts:21-22`), so the sentence's "stripped... before upload... never sent to us" is not something the code proves end-to-end for the original object. | `apps/mobile/src/pets/compress-image.ts:28-43`; `apps/api/src/workers/images.processor.ts:14-71` | `LEGAL-REVIEW (C3)` — either add an explicit strip step + pinning test, or soften the policy sentence to match what is actually guaranteed. Neither change is made by this card. |

### 8b. Consolidated LEGAL-REVIEW (C3) table

| Topic | Question for counsel/founder | Provisional answer | Where it appears |
|---|---|---|---|
| Pet health data — Apple category | "Other Data" or "Health & Fitness → Health"? | "Other Data" (provisional) | §4.1 |
| Pet health data — Play category | Play's "Health and fitness → Health info" or a plainer "App activity" category — same person-vs-animal ambiguity as the Apple row above? | "Health and fitness → Health info" adopted for now (provisional, cross-referenced to §4.1's reasoning) | §5 (Health and fitness row + its provisional-classification note), §4.1 cross-store note |
| Tracking declaration (third-party SDK configuration) | Could PostHog/Sentry/RC's own configuration constitute "tracking" under Apple's definition regardless of our code? | "None" from our code; vendor configuration is unverified | §4.2 |
| Reminder-title-in-push-body — is a content-free push body preferable? | Should the single-reminder push path stop embedding `Reminder.title` verbatim (e.g. a generic "You have a care reminder" body), trading a small UX loss for a narrower third-party disclosure? | Not changed here — a product/UX decision, not a privacy-compliance requirement; current behavior is fully disclosed in §2/§3/§4/§5 | §2 (Reminders row), §3 (Expo push) |
| AI providers — processor vs. third party | Do Ollama Cloud's and Gemini's terms make them "processors" (Play: not shared) or independent third parties (Play: shared)? | Recipient list is always disclosed; store "shared" answer is contingent on their terms | §3 (AI providers), §5 |
| RevenueCat — processor vs. third party | Same question, for RC's terms specifically | Recipient list always disclosed; contingent | §3 (RevenueCat), §5 |
| PostHog/Sentry vendor retention | What do PostHog's/Sentry's own project-level retention settings say? | Not code-derivable | §2, §3 |
| Shipped policy says "your name" is collected | Fix the copy, or confirm a name field is intentionally out of scope? | Recorded as a discrepancy, not fixed | §8a D1 |
| Shipped policy's EXIF-strip claim | Add an explicit client-side strip step + test, or soften the claim to match what re-encoding actually guarantees? | Recorded as a discrepancy, not fixed | §8a D2 |
| Play web deletion-request URL | Build a public web deletion-request page before Play submission? | Gap recorded, not built here | §5.1 |
| Crash/diagnostics collection is not independently toggleable from the analytics consent switch | Should Sentry reporting have its own opt-out, separate from PostHog analytics? | Not currently separable; recorded as a gap | §2 (crash/error reports row) |
| Mobile `captureError` `context` argument is not structurally scrubbed | Should `error_context` be dropped by allowlist the way `request.data` is, rather than relying on pattern-level redaction only? | Not fixed here (no `packages/analytics` source change authorized by this card) | §3 (Sentry) |

---

## 9. How to re-verify

Re-run whenever `packages/analytics`, `apps/api/src/analytics`, `observability` (any app), `billing`, or the Prisma schema changes.

```
# PostHog event map + emitters
rg -n "^\s{2}\w+: \{" packages/analytics/src/events.ts
rg -n "captureEvent\(|\.capture\(|captureForUser\(" apps packages --glob '!**/dist/**' --glob '!**/*.spec.*' --glob '!**/__tests__/**'
rg -n "setUser" apps packages --glob '!**/dist/**'
rg -n "captureError\(" apps/mobile --glob '!**/__tests__/**'

# RevenueCat
rg -n "setAttributes|setEmail|setDisplayName|setPhoneNumber" apps/mobile

# Negative checks (each should return no real match)
rg -n "expo-location|getCurrentPosition|Geolocation" apps packages --glob '!**/dist/**'
rg -n "expo-tracking-transparency|AdSupport|IDFA|advertisingId|facebook|appsflyer|adjust|branch" apps packages --glob '!**/dist/**' --glob '!pnpm-lock.yaml'
rg -n "expo-contacts|expo-calendar|expo-av|NSMicrophone|READ_CONTACTS" apps
rg -n "card|iban|paymentMethod" apps/api/src --glob '!**/*.spec.ts'
```

`pnpm --filter @bombaypetcompany/analytics test` runs `store-privacy-doc.spec.ts`, which fails if Appendix A drifts from the typed event map (`AnalyticsEventMap`) or cites a code anchor whose file no longer exists on disk. It does **not** catch every possible drift (e.g. a changed Sentry option, a schema field rename that doesn't touch a cited path) — the greps above and a manual read of the cited files remain the full re-verification procedure.

---

## Appendix A — grep-verified inventory

### A.1 PostHog

Produced by: `rg -n "^\s{2}\w+: \{" packages/analytics/src/events.ts` (event names) cross-referenced against the interface body in `packages/analytics/src/events.ts:20-51` (properties) and `rg -n "captureEvent\(|\.capture\(|captureForUser\(" apps packages --glob '!**/dist/**' --glob '!**/*.spec.*' --glob '!**/__tests__/**'` (emit sites).

<!-- BEGIN:posthog-events -->
| Event | Properties sent | Emitted from |
|---|---|---|
| `first_check_completed` | `checkId`, `householdId`, `status`, `urgency` | `apps/api/src/workers/check-runner.processor.ts:93` |
| `paywall_view` | `source`, `householdId` | `apps/mobile/app/paywall.tsx:43` |
| `trial_start` | `householdId`, `plan` | `apps/api/src/billing/rc-webhook.service.ts:103` |
| `ota_available` | `channel`, `currentUpdateId` | `apps/mobile/src/hooks/use-update-flow.ts` |
| `ota_downloaded` | `channel`, `currentUpdateId`, `critical` | `apps/mobile/src/hooks/use-update-flow.ts` |
| `ota_applied` | `updateId`, `fromUpdateId`, `latencyMs` | `apps/mobile/src/hooks/use-update-flow.ts` |
<!-- END:posthog-events -->

Wire body (`packages/analytics/src/http-transport.ts:20-41`): `{ api_key, event, distinct_id, properties, timestamp }`, POSTed to `{host}/capture/`; an empty `api_key` makes `send` a no-op (no network call in dev/CI). Identity note: `distinct_id` is always the backend `User.id` UUID (never an email) — see §3 PostHog for the full derivation across all three emit sites.

### A.2 Sentry

Worked example of what survives `beforeSend` (`scrubSentryEvent`, `packages/analytics/src/sentry/scrub.ts:245-272`) for a typical api exception:

```json
{
  "event_id": "<uuid>",
  "level": "error",
  "release": "bombaypetcompany@0.0.0+<gitSha>",
  "environment": "production",
  "exception": { "...": "redacted-of-emails/tokens/JWTs only, structure preserved" },
  "request": { "url": "https://api.bombaypetcompany.app/checks/123", "method": "POST", "headers": { "user-agent": "..." } },
  "tags": { "requestId": "<uuid>" }
}
```

Drop list with guard names: `request.data`/`cookies`/`query_string`/`env` → dropped by `scrubRequest`'s allowlist rebuild (`scrub.ts:139-163`, D4 guard `scrubSentryEvent`/`scrubRequest`). Breadcrumb `message` (any category) + all `console`-category breadcrumbs → dropped by `scrubBreadcrumb`/`scrubOneBreadcrumb` (`scrub.ts:171-237`). `user.email`/`user.ip_address`/`user.username` → reduced to `user.id` only if present, but no call site ever provides one (`sendDefaultPii`, `packages/analytics/src/sentry/options.ts:44-59`; `captureForUser` is the analytics consent gate, a different mechanism entirely — cited together in the drift-guard test per the plan's Interfaces/contracts because both are named identifiers the guard cross-checks still exist in source, not because they are the same feature).

### A.3 RevenueCat

What the SDK receives: backend `User.id` as `appUserID` via `logIn` (`apps/mobile/src/billing/purchases.ts:143-154`), plus standard store-transaction metadata (receipt/token, product id, price/currency, store country) that the RC SDK itself collects — not separately configured in this codebase.

What the webhook delivers: `POST /billing/rc-webhook` → `RcWebhookService.handle` (`apps/api/src/billing/rc-webhook.service.ts:35-110`) validates against `rcWebhookEnvelopeSchema`, dedupes by `event.id` (`ProcessedWebhookEvent`), and on a non-duplicate, resolvable event upserts `Subscription` with the **entire raw event body** persisted verbatim as `rawEventJson` (`rc-webhook.service.ts:76-89`; column `apps/api/prisma/schema.prisma:355`). `trial_start` is emitted to PostHog (A.1) only for a committed, non-duplicate `INITIAL_PURCHASE` with RC `period_type == "TRIAL"` (`rc-webhook.service.ts:91-107`).

Where the raw payload is persisted: `Subscription.rawEventJson` (`schema.prisma:347-363`), cascade-deleted only alongside the owning `User`/`Household` row (`onDelete: Cascade`) — verified against `apps/api/src/workers/account-deletion.service.ts` that no other sweep purges it independently.
