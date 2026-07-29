# Offline & state-sweep audit — T094

> Audit-first sweep (plan `loop/plans/T094.plan.md`). This document is the
> step-1 evidence, committed **before** any product byte was changed (T093
> precedent). §4 (fix list) is capped to exactly the rows the plan's step
> 1.4 scope permits — agenda/reminder-completion, the new global banner,
> and the two T083/T088 hand-off items (chat abort, route declarations).
> Every other `GAP` found by this sweep is recorded in §5, unfixed.

---

## §1 Method — exact commands run in this environment

```
find apps/mobile/app -name "*.tsx" | sort            # -> 51 files
find apps/mobile/app -name "_layout.tsx"              # -> 4 files (root, (auth), (tabs), add-pet)
# 51 - 4 = 47 screens (matches the plan's stated expectation; the code wins
# either way, this run confirms 47, so no discrepancy to record)
```

For each screen: `grep -nE "useQuery|useMutation|isLoading|isError|isPending|EmptyState|useIsOffline|isOffline|testID=\"[a-z-]*-(loading|error|empty|offline)"` was
run against the file itself to find its state-bearing testIDs, then each
testID was grepped verbatim across `apps/mobile/__tests__/**` to find (or
fail to find) a real assertion, and the enclosing `it("...")` title was
read directly from the test file (never guessed/copied from memory).
`grep -noE 'it\("[^"]*"' apps/mobile/__tests__/*.test.tsx apps/mobile/__tests__/*.test.ts | grep -iE 'loading|error|empty|offline'`
was additionally run once as a global cross-check (218 hits) to catch any
screen-relevant title the per-screen testID greps might have missed.

Route declarations: `apps/mobile/app/_layout.tsx:82-98` was read directly;
of its 17 `<Stack.Screen>` entries, 4 carry `options` (`add-pet`,
`reminders/edit`, `paywall` — all `presentation:"modal"` — and
`check/emergency/[checkId]` — `gestureEnabled:false`). This re-confirms the
plan's D4/planner inventory exactly (no discrepancy).

---

## §2 Per-screen state table (47 screens)

Legend: a cell is either (a) a **verbatim `it(...)` title** that asserts
that state for that screen (grep-checked by `state-audit-doc.test.ts`),
(b) `N/A — <reason>`, or (c) `GAP — <not-handled | untested>`. A bare
"yes"/"✓" is never used (R1).

### (auth) group

| Screen | Loading | Error | Empty | Offline |
|---|---|---|---|---|
| `(auth)/welcome.tsx` | N/A — static hero, no async source, `PrimaryButton` only navigates | N/A — no request on this screen | N/A — no data | N/A — no data, no offline dependency |
| `(auth)/email.tsx` | GAP — `PrimaryButton loading={loading}` is set during `requestOtp`, but no test asserts a loading/disabled state for `email-submit` | `"shows an invalid-email error and does not call requestOtp for malformed input"` (`auth-flow.test.tsx:66`) | N/A — no list/data | N/A — no dedicated offline branch; a request made while offline fails through the same `catch`/`genericError` path as any other request failure (see Error cell) |
| `(auth)/otp.tsx` | GAP — same `loading` local-state shape as email screen, untested | `"shows the wrong-code error after a 401 ApiError and keeps the input usable"` (`auth-flow.test.tsx:34`) | N/A — no list/data | N/A — same merged-into-`genericError` reasoning as email screen (`otp.tsx:39-41`) |
| `(auth)/done.tsx` | N/A — static confirmation, no async source | N/A — no request | N/A — no data | N/A — no data |

### (tabs) group

| Screen | Loading | Error | Empty | Offline |
|---|---|---|---|---|
| `(tabs)/care.tsx` (agenda) | `"loading: shows agenda-loading"` (`agenda-screen.test.tsx:154`) | `"error: shows agenda-error; retry re-fetches the agenda"` (`:162`) | `"empty: no entries -> shows agenda-empty (with its value-preview body)"` (`:218`) | `"offline with no cached data: shows agenda-offline; retry re-fetches"` (`:180`) + `"offline with cached data: shows the offline banner over the existing agenda"` (`:199`) |
| `(tabs)/index.tsx` (home) | `"shows home-hero-skeleton while the pets query is pending"` (`home-screen.test.tsx:203`) | `"error: shows home-today-error; retry re-fetches"` (`:302`) — this is the embedded "Today" widget's error, the only error surface the screen has (no top-level `isError` on `useActivePet`) | `"shows the empty hero with home-add-pet-cta; hides the hero card"` (`:220`) | N/A — no top-level offline gate on this screen; offline handling is delegated to composed widgets, each independently offline-safe (`CareScoreCard`'s `"offline (no cached data): renders the honest insufficient placeholder, never throws"`, `care-score-card.test.tsx:117`) |
| `(tabs)/settings.tsx` | N/A — static hub; `entitlement`/`privacySettings` populate optional rows in place, nothing gates initial render | `"a failed toggle reverts the switch and shows the error notice"` (`privacy-screen.test.tsx:74`, asserts `settings-analytics-error`) + `"error: shows the error notice"` (`settings-restore.test.tsx:73`, asserts `settings-restore-error`) | N/A — fixed hub of list rows, not data-driven | GAP — no `useIsOffline` import at all; restore/analytics-toggle mutations are not offline-gated or banner-covered |
| `(tabs)/timeline.tsx` | `"shows the loading state"` (`timeline-screen.test.tsx:133`) | `"shows the error state and retry calls refetch"` (`:141`) | `"renders the empty state"` (`:176`) | `"offline with no cached data shows the offline state and retry calls refetch"` (`:153`) + `"offline with cached data shows a non-blocking banner, list still renders"` (`:166`) |

### Pet-scoped detail/log screens

| Screen | Loading | Error | Empty | Offline |
|---|---|---|---|---|
| `activity/[petId].tsx` | `"loading: shows activity-screen-loading"` (`activity-screen.test.tsx:78`) | `"error: shows activity-screen-error; retry calls refetch once"` (`:86`) | `"empty/not-found: shows activity-screen-empty"` (`:107`) | `"offline (no cache): shows activity-screen-offline; retry calls refetch"` (`:96`) + `"loaded (offline, cached): shows the offline banner over content"` (`:115`) |
| `care-plan/[petId].tsx` | `"loading: shows care-plan-loading"` (`care-plan-wizard.test.tsx:98`) | `"error: shows care-plan-error; retry calls refetch once"` (`:106`) | `"empty: no items -> shows care-plan-empty (with its value-preview body); Skip navigates to pet home"` (`:116`) | `"offline with no cached data: shows care-plan-offline; retry calls refetch"` (`:129`) + `"offline with cached data: renders the list plus care-plan-offline-banner"` (`:140`) |
| `note/[petId].tsx` | `"loading: shows note-screen-loading"` (`note-screen.test.tsx:70`) | `"error: shows note-screen-error; retry calls refetch once"` (`:78`) | `"empty/not-found: shows note-screen-empty"` (`:99`) | `"offline (no cache): shows note-screen-offline; retry calls refetch"` (`:88`) + `"loaded (offline, cached): shows the offline banner over content"` (`:107`) |
| `pets/[id].tsx` (pet home) | `"loading: shows pet-home-loading, no header/CTA"` (`pet-home-screen.test.tsx:78`) | `"error: shows pet-home-error; retry calls refetch once"` (`:93`) + `"error (server unreachable): a network-transport ApiError (httpStatus 0) shows the friendlier server-unreachable copy"` (`:110`) | `"empty/not-found: shows pet-home-empty"` (`:141`) | `"offline (no cache): shows pet-home-offline; retry calls refetch"` (`:154`) + `"offline (cached): shows content plus pet-home-offline-banner (banner-over-cache)"` (`:174`) |
| `vet-visit/[petId].tsx` | `"loading: shows vet-visit-screen-loading"` (`vet-visit-screen.test.tsx:74`) | `"error: shows vet-visit-screen-error; retry calls refetch once"` (`:82`) | `"empty/not-found: shows vet-visit-screen-empty"` (`:103`) | `"offline (no cache): shows vet-visit-screen-offline; retry calls refetch"` (`:92`) + `"loaded (offline, cached): shows the offline banner over content"` (`:111`) |
| `weight/[petId].tsx` | `"loading: shows weight-screen-loading"` (`weight-screen.test.tsx:78`) | `"error: shows weight-screen-error; retry calls refetch once"` (`:86`) | `"empty/not-found: shows weight-screen-empty"` (`:107`) | `"offline (no cache): shows weight-screen-offline; retry calls refetch"` (`:96`) + `"loaded (offline, cached): shows the offline banner over content"` (`:115`) |
| `reminders/edit.tsx` | `"edit mode loading: shows reminder-form-loading"` (`reminder-edit.test.tsx:206`) | `"edit mode error: shows reminder-form-error; retry calls refetch"` (`:215`) + `"a save rejection surfaces reminder-save-error without crashing or navigating back"` (`:146`) | N/A — create/edit form, no list/empty concept; the not-found case for an unknown reminder id is the Error branch above | GAP — code has an `isEdit && isOffline && !existing` branch (`reminder-form-offline` testID) with no test |

### Chat, checks, family, join, add-pet, breeds

| Screen | Loading | Error | Empty | Offline |
|---|---|---|---|---|
| `chat/index.tsx` | `"the vet disclaimer renders in the %s state"` (`chat-screen.test.tsx:378`, `it.each` case `"loading"` at `:340-344`, asserts `chat-loading`) | same `it.each` (`:378`, case `"error"` at `:356-360`, asserts `chat-error`) | same `it.each` (`:378`, case `"empty"` at `:345-348`, asserts `chat-empty`) | same `it.each` (`:378`, case `"offline"` at `:349-355`, asserts `chat-offline-banner`) + `"offline blocks the send entirely"` (`:262`) + `"offline blocks the send entirely (composer disabled, banner renders)"` (`:421`) |
| `check/index.tsx` | `"shows a loading spinner for the recent section while fetching"` (`check-entry-screen.test.tsx:115`) — widget-level; the category grid itself never gates on a fetch | `"shows an error message for the recent section on fetch failure"` (`:123`) — widget-level | `"shows the recent-checks empty state placeholder"` (`:89`) — widget-level | `"shows the offline banner when offline, grid still renders"` (`:74`) + `"does not show the offline banner when online"` (`:83`) |
| `check/[category].tsx` (intake) | GAP — `check-submit-submitting` (the AI-submission spinner overlay) has no test | `"a generic error shows the error copy with a working retry, reusing the same Idempotency-Key"` (`check-submission.test.tsx:160`) | `"renders a graceful error for an invalid category, without crashing"` (`intake-screen.test.tsx:47`) — the not-found/invalid-param case, this screen's only empty-shaped branch | `"[AC3] offline submit is blocked with a retry affordance; mutateAsync is never called"` (`check-submission.test.tsx:101`) + `"shows the offline banner while the form still renders"` (`intake-screen.test.tsx:56`) |
| `check/waiting/[checkId].tsx` | `"renders the calm waiting copy and does not navigate while RUNNING"` (`check-waiting-screen.test.tsx:36`) — the whole screen IS the loading state by design | GAP — not handled at all: `useCheck` has no `isError` read here; a failed poll leaves the user on the spinner indefinitely (cancel is the only exit) | N/A — no data rendered besides the spinner/copy | GAP — not handled at all: no `useIsOffline` read; an offline poll fails silently the same as any other poll failure |
| `check/result/[checkId].tsx` | `"shows the loading state when the check is non-terminal"` (`check-result-screen.test.tsx:118`) + `"shows the loading state when there is no data yet"` (`:130`) | `"shows the error state and retry calls refetch"` (`:106`) | N/A — single-item detail route; the empty case is the same `isError && !data` branch as Error (no distinct "no result" UI) | N/A — no dedicated offline branch; a network failure while offline surfaces via the same `isError` path as any other fetch error (see Error cell) |
| `check/history/[petId].tsx` | `"shows the loading state"` (`check-history-screen.test.tsx:129`) | `"shows the error state and retry calls refetch"` (`:137`) | `"renders empty state"` (`:68`) | `"shows a non-blocking offline banner while offline, list still renders"` (`:180`) — no separate no-cache-offline branch; an offline fetch with no cache surfaces via the same Error branch above |
| `check/emergency/[checkId].tsx` | N/A — frozen safety surface (zero-diff by plan design); `resolveEmergencyPayload`/`resolveRegionHotline` fail upward to a static safe default, so there is no loading branch by construction (§5 rule 2) | N/A — same fail-upward-to-default reasoning; `useCheck`'s `data` is read optionally and a missing/errored check still renders the generic go-now payload | N/A — same reasoning | N/A — same reasoning; this screen has no `useIsOffline` read at all, by design (it must render identically with or without connectivity) |
| `checks/[id].tsx` | N/A — pure `Redirect`, no data, no UI | N/A — same | N/A — same | N/A — same |
| `family.tsx` | `"loading: shows family-loading"` (`family-screen.test.tsx:58`) | `"error: shows family-error; retry calls refetch once"` (`:71`) + `"shows an invite error when create-invite fails, without calling Share"` (`:143`) + `"a rejected leave mutation shows family-leave-error"` (`:244`) | `"is bg-surface-page, title is role=header, PTR wired, empty is EmptyState"` (`sweep4-a11y.test.tsx:377`, mocks `useHouseholdMe` to `data: undefined` and asserts `family-empty`) | GAP — not handled at all: no `useIsOffline` import in `family.tsx` |
| `join/[code].tsx` | GAP — `PrimaryButton loading={acceptInvite.isPending}` on `join-accept` has no test | `"[AC] a 404 (invalid/expired/used, uniform) renders the invalid-link error and does not navigate"` (`join-route.test.tsx:51`) + `"[AC] a 409 (pets-present conflict) renders the distinct conflict message"` (`:66`) | N/A — no list; the 404 case above is this screen's only empty-shaped state | GAP — not handled at all: no `useIsOffline` import |
| `paywall.tsx` | GAP — `paywall-offerings-loading` (`offeringLoading` branch) has no test | `"error: shows the error notice, no navigation, store unchanged"` (`paywall-purchase.test.tsx:93`) + `"error: shows the error notice"` (`paywall-restore.test.tsx:77`) | `"shows the unavailable state, no crash, no fake prices"` (`paywall-snapshot.test.tsx:97`, the `offering === null` branch) | N/A — no `useIsOffline` read; an offline `useOfferings` fetch resolves to the same `offering === null` unavailable-state branch as the Empty cell above (`usePaywallConfig`'s own offline-safe default is separately pinned by `"resolves the default variant A on a fetch rejection (offline, no cache yet)"`, `paywall-config.test.tsx:25`) |
| `add-pet/species.tsx` | N/A — local draft-store selection only, no async source | N/A — no request on this step | N/A — no data | N/A — no data, no offline dependency (offline is only relevant at the final `done.tsx` submit) |
| `add-pet/breed.tsx` | `"renders the loading and error branches of the autocomplete"` (`add-pet-wizard.test.tsx:112`) — the `BreedAutocomplete` component's states, composed here | `"renders the loading and error branches of the autocomplete"` (`add-pet-wizard.test.tsx:112`) — same test, component owns both loading+error | N/A — skippable step, no empty-list concept on the screen itself (the autocomplete's own zero-results case is the component's concern, not this screen's) | GAP — no distinct offline UI on this step; an offline autocomplete search fails through the component's own error branch (component-level, not screen-level — recorded here since the screen composes it) |
| `add-pet/details.tsx` | N/A — local draft-store form, no async source | N/A — client-side XOR validation only, no request | N/A — no data | N/A — no data, no offline dependency |
| `add-pet/photo.tsx` | N/A — local draft-store step; `compressImage` is synchronous-in-practice and unguarded by a spinner | GAP — `add-pet-photo-error` (permission-denied / compress-failure copy) has no test anywhere | N/A — no data | N/A — no network call on this step at all (photo upload happens later, at `done.tsx`) |
| `add-pet/done.tsx` | GAP — the submit-in-flight state (mutation `isPending`) has no dedicated spinner test, only its error/retry outcome is tested | `"shows a retryable error on create failure and keeps the draft intact; retry is idempotent"` (`add-pet-done.test.tsx:70`) | N/A — no list/data | N/A — no dedicated offline branch; an offline create fails through the same retryable-error path above |
| `breeds/index.tsx` | N/A — static local dataset parsed at module load (D6 precedent, `breeds/index.tsx:11-19` comment), no loading state to render | N/A — same reasoning, no request exists to fail | `"empty guard renders the empty state"` (`breed-guide-explore.test.tsx:79`) | N/A — same static-dataset reasoning |
| `breeds/[species]/[slug].tsx` | N/A — same static-dataset reasoning (`breeds/[species]/[slug].tsx:18-24` comment) | N/A — same | `"a draft slug shows not-found and no guide content"` (`breed-guide-screen.test.tsx:187`) | N/A — same static-dataset reasoning |

### Services preview hub (all local/static fixture data — no network call anywhere in this family)

| Screen | Loading | Error | Empty | Offline |
|---|---|---|---|---|
| `services/index.tsx` | N/A — static card grid | N/A — no request | N/A — fixed set of cards | N/A — no network dependency |
| `services/adopt.tsx` | N/A — static fixture list | N/A — no request | GAP — the species-filter-to-zero-results branch (`services-adopt-empty` testID) has no test | N/A — no network dependency |
| `services/adopt-detail.tsx` | N/A — static fixture detail | N/A — no request | N/A — fixture is always present for a valid `petId` param | N/A — no network dependency |
| `services/book.tsx` | N/A — static fixture form | N/A — no request | N/A — no data | N/A — no network dependency |
| `services/insurance.tsx` | N/A — static fixture content | N/A — no request | N/A — no data | N/A — no network dependency |
| `services/preview-end.tsx` | N/A — static confirmation | N/A — no request | N/A — no data | N/A — no network dependency |
| `services/salons.tsx` | N/A — static fixture list | N/A — no request | N/A — fixed fixture list, never empty | N/A — no network dependency |
| `services/slots.tsx` | N/A — static fixture picker | N/A — no request | N/A — fixed slot set | N/A — no network dependency |
| `services/store.tsx` | N/A — static fixture content | N/A — no request | N/A — no data | N/A — no network dependency |
| `services/vets.tsx` | N/A — static fixture list | N/A — no request | N/A — fixed fixture list, never empty | N/A — no network dependency |

### Settings sub-screens

| Screen | Loading | Error | Empty | Offline |
|---|---|---|---|---|
| `settings/notifications.tsx` | `"loading: shows notifications-loading"` (`notification-prefs-screen.test.tsx:35`) | `"error: shows notifications-error; retry calls refetch once"` (`:48`) + `"shows a save error when the mutation fails, without crashing"` (`:124`) | GAP — `notifications-empty` (the `!prefs` branch) has no test | GAP — `notifications-offline` (no-cache branch) has no test; only the cached-offline banner is covered (`"is bg-surface-page, title is a header, and the offline banner is accessibilityRole=alert"`, `sweep4-a11y.test.tsx:535`) |
| `settings/privacy.tsx` | GAP — `privacy-loading` has no test | `"a failed toggle reverts the switch and shows the error notice"` (`privacy-screen.test.tsx:74`) + `"a non-conflict failure renders the generic error notice"` (`:144`) — these cover the two mutation-error notices; the screen's own top-level `isError` branch (`privacy-error`) is itself untested | GAP — `privacy-empty` (the `!settings` branch) has no test | GAP — `privacy-offline` (no-cache branch) has no test; no offline-banner test either (unlike notifications) |
| `push-rationale.tsx` | N/A — local `loading` state only gates the "Enable" button's own spinner prop, no screen-level branch | N/A — `usePushRegistration`'s failures are deliberately swallowed (failure-tolerant by design, per the screen's own header comment) | N/A — no data | N/A — no data, no offline dependency (push registration is best-effort) |
| `coming-soon.tsx` | N/A — fully static placeholder | N/A — no request | N/A — no data | N/A — no data |
| `feedback.tsx` | N/A — write-only form (no resource fetch); nothing to gate on load | `"shows the generic error notice when the mutation fails"` (`feedback-screen.test.tsx:171`) | `"an empty message disables the submit button"` (`feedback-screen.test.tsx:61`) | `"offline disables the submit button"` (`feedback-screen.test.tsx:71`) |

<!-- T104 addendum: one row added post-T094 sweep for the new `feedback.tsx`
     screen (in-app feedback + bug report). The §1 method/count above is
     the original T094 snapshot and is left historical, not rewritten. -->

---

## §3 Route-declaration inventory

47 screen files + 4 `_layout.tsx` = 51 files under `apps/mobile/app/**`.
`apps/mobile/app/_layout.tsx:82-98` declares exactly **17** `<Stack.Screen>`
entries; **4** of those carry non-default `options`
(`add-pet`→`presentation:"modal"`, `reminders/edit`→`presentation:"modal"`,
`paywall`→`presentation:"modal"`, `check/emergency/[checkId]`→
`gestureEnabled:false`); the other **13** are bare `name`-only declarations.

| Declared name | Kind | Covers (screens) |
|---|---|---|
| `(auth)` | group | `done`, `email`, `otp`, `welcome` (4) |
| `(tabs)` | group | `care`, `index`, `settings`, `timeline` (4) |
| `push-rationale` | direct | itself |
| `add-pet` | group (has own `_layout.tsx`) | `breed`, `details`, `done`, `photo`, `species` (5) |
| `pets/[id]` | direct | itself |
| `care-plan/[petId]` | direct | itself |
| `reminders/edit` | direct (options) | itself |
| `check/index` | direct | itself |
| `check/[category]` | direct | itself |
| `check/waiting/[checkId]` | direct | itself |
| `check/result/[checkId]` | direct | itself |
| `check/emergency/[checkId]` | direct (options) | itself |
| `check/history/[petId]` | direct | itself |
| `checks/[id]` | direct | itself |
| `paywall` | direct (options) | itself |
| `family` | direct | itself |
| `join/[code]` | direct | itself |
| `feedback` | direct (options, T104 addendum) | itself |

That accounts for 14 directly-declared screens + 13 covered by the 3
declared groups = 27 of 47. The remaining **20 screens are undeclared** —
resolved purely by expo-router's filesystem convention, exactly as
`chat/index.tsx` already is today (T083 FINDING-8):
`activity/[petId]`, `breeds/index`, `breeds/[species]/[slug]`,
`chat/index`, `coming-soon`, `note/[petId]`, `services/adopt`,
`services/adopt-detail`, `services/book`, `services/index`,
`services/insurance`, `services/preview-end`, `services/salons`,
`services/slots`, `services/store`, `services/vets`,
`settings/notifications`, `settings/privacy`, `vet-visit/[petId]`,
`weight/[petId]`.

**Verdict (plan step 6.2, re-confirmed by this independent count): this is
a config/consistency matter, not a correctness defect.** A bare
`<Stack.Screen name="x"/>` configures nothing beyond making the name
explicit; expo-router discovers every route from the filesystem regardless
of whether it is declared. Adding ~20 no-op declarations would be scope
creep with a real risk (declaration order can affect the navigator's
initial-route resolution) for zero behavioural gain; deleting the 13
existing bare ones would be pure churn. Per plan §6.2, this card instead
(a) adds a short convention comment above `<Stack>` in `_layout.tsx`
(declare a screen only when it needs non-default `options`; cite T083 F8)
and (b) ships a filesystem-resolution guard
(`apps/mobile/__tests__/route-declarations.test.ts`) that pins the 4
options-bearing declarations — including `check/emergency/[checkId]`'s
`gestureEnabled:false` — against silent removal, and asserts every
declared name resolves to a real file/group on disk. The executor's own
reading did not contradict the plan's assumption at 6.1, so no
`T094.blocked.md` escalation was needed.

---

## §4 Fix list — the only rows this card fixes (scope cap, plan step 1.4)

| # | Surface | GAP addressed | How |
|---|---|---|---|
| 1 | `(tabs)/care.tsx` + `src/api/agenda-api.ts` | Reminder completion had no offline queue — an offline "Mark done" tap threw/rolled back with no path to sync later | New persisted outbox (`useOutboxStore`), `flushOutbox()` reconnect sync, `useOutboxFlush()` root hook; `useCompleteOccurrence` enqueues instead of POSTing while offline; `care.tsx` renders a `agenda-outbox-banner` pending-sync line |
| 2 | App-wide (no screen had a *global* chrome banner) | No banner existed above the router stack; only ~15 per-screen banners (T019-era) | New `<OfflineBanner/>`, mounted in normal flow above `<Stack>` in `_layout.tsx` — closes the "no global offline indicator" gap by construction, for every screen at once, without touching any of the 15 per-screen banners (D3: deliberate redundancy, not consolidation) |
| 3 | `src/chat/use-chat-stream.ts` (T083 F5 hand-off) | No `AbortController` on unmount/navigation — a stream kept running (and could still mutate `chat-store` after the component using it was gone) | Per-attempt `AbortController` wired into `send`/`retry`; unmount/`petId`-change effect aborts; new `signal.aborted` guard (after the existing `sawDone` guard) discards a still-partial answer without entering a terminal/retryable state |
| 4 | `app/_layout.tsx` route declarations (T083 F8 hand-off) | ~20 undeclared routes flagged as an open question, never resolved | Verdict recorded (§3): documented convention, not bulk declarations. Guard test (`route-declarations.test.ts`) pins the 4 options-bearing declarations and the filesystem-resolution invariant |

Every other `GAP` row found in §2 is **out of scope for this card** and is
recorded, not fixed, in §5 below (plan step 1.4's hard scope cap — fixing
any of them would require touching a file outside this plan's list, which
is itself a gate failure per the plan).

---

## §5 Out-of-scope findings (recorded, not fixed)

| Screen | Finding | Why out of scope |
|---|---|---|
| `(auth)/email.tsx`, `(auth)/otp.tsx` | Submit-button `loading` state (local `useState`, gates `PrimaryButton`'s own spinner) is untested | Neither file is in this plan's file list |
| `(tabs)/settings.tsx` | No `useIsOffline` read at all — restore-purchases and analytics-toggle mutations are not offline-gated or banner-covered | Not in this plan's file list; `settings.tsx` composes `BillingIssueBanner` for entitlement issues but nothing for connectivity |
| `reminders/edit.tsx` | `reminder-form-offline` (edit-mode, no-cache branch) is coded but untested | Not in this plan's file list; `useSnoozeOccurrence`/reminder CRUD are explicitly out of scope per the plan |
| `chat/index.tsx` | `chat-no-pet` (no active pet) testID is coded but untested; also, the screen's `chat-loading`/`chat-empty`/`chat-error`/`chat-offline` states are only proven via a single parameterized `it.each` (see §2 note) rather than a standalone `it(...)` per state | Not in this plan's file list (only `use-chat-stream.ts` is touched) |
| `check/[category].tsx` (intake) | `check-submit-submitting` (the AI-submission overlay) is untested | Not in this plan's file list |
| `check/waiting/[checkId].tsx` | Neither `isError` nor `useIsOffline` is read at all — a failed/offline poll leaves the user on an indefinite spinner with only manual Cancel as an exit | Not in this plan's file list; polling-screen error/offline handling is a different card's scope |
| `family.tsx` | No `useIsOffline` read at all (the `family-empty` branch itself IS tested — see §2) | Not in this plan's file list |
| `join/[code].tsx` | No `useIsOffline` read at all; `join-accept`'s `loading` state untested | Not in this plan's file list |
| `add-pet/breed.tsx` | No screen-level offline UI for a failed autocomplete search while offline (component-level error branch only) | Not in this plan's file list |
| `add-pet/photo.tsx`, `add-pet/done.tsx` | `add-pet-photo-error` (permission/compress failure) untested; submit-in-flight spinner for `done.tsx` untested | Neither file is in this plan's file list |
| `services/adopt.tsx` | The species-filter-to-zero-results branch (`services-adopt-empty`) is coded but has no test | Not in this plan's file list |
| `settings/notifications.tsx` | `notifications-empty` and the no-cache `notifications-offline` branch are untested | Not in this plan's file list |
| `settings/privacy.tsx` | `privacy-loading`, the screen's own top-level `privacy-error`, `privacy-empty`, and the no-cache `privacy-offline` branch are all untested (only the two mutation-level error notices and the analytics-toggle error are covered) | Not in this plan's file list |
| **D1 consolidation candidate** | Two offline mechanisms now coexist: TanStack query-cache persistence (reads) and the new zustand outbox (this one write). A second write needing offline support would motivate unifying onto `onlineManager`/paused-mutations | Recorded per plan D1; explicitly rejected for this card (blast-radius reasons in the plan's D1) |
| **Snooze queueing** | `useSnoozeOccurrence` has no offline queue — a snooze attempted offline still fails immediately (optimistic patch + rollback, no outbox) | Plan step 4.1 explicitly scopes the outbox to completion only; snooze is time-sensitive (a stale snooze target queued for later reconnect is a different design question) |
| **Other offline queues** | Health logs, activity logging, notes, weight, vet visits, check submission have no offline queue | Plan names reminder completion only |

---

## §6 Honesty section — what this audit and its tests do NOT prove

- **No layout engine, no device, no real radio.** `useIsOffline()` reads a
  module-level in-memory store (`setOnline`/`getIsOfflineSnapshot`); every
  "offline" test in this repo (including the new outbox tests) drives that
  store directly, never a real OS connectivity change. `use-network-listener.ts`'s
  bridge from `expo-network` is itself untested beyond its own existing
  unit coverage — this audit adds nothing there.
- **The outbox flush is tested against a mocked `apiClient.post`, not a
  real network.** The 401/404/400/500/408/429 outcome rules are proven
  against synthetic `ApiError` throws, not a live server. The reminder
  completion endpoint's *actual* idempotency (`ReminderEvent.reminderId_dueAt`
  upsert) is proven by `apps/api/src/reminders/reminders.service.spec.ts`
  (a different package's test), not by anything in this mobile-side suite —
  the outbox's own "duplicate completion is harmless server-side" test
  documents that contract by reference/comment, it does not re-derive it.
- **The chat-abort "never retry-prompts" half is only weakly observable in
  Jest.** A post-unmount `setState` is a no-op in React regardless of this
  card's change, so the load-bearing assertion is indirect: a freshly
  mounted hook's `retry()` issues zero additional `streamSse` calls, plus
  the message-store shape after abort. This does not prove what a real
  device does with an in-flight `fetch`/SSE abort signal at the OS level.
- **The `it.each` citations for `chat/index.tsx`** (§2) are the literal
  template string `"the vet disclaimer renders in the %s state"` as it
  appears verbatim in `chat-screen.test.tsx:378` — Jest substitutes the
  `%s` with each case name (`"loading"`, `"empty"`, `"offline"`, `"error"`)
  at run time, so the four *rendered* test titles do not appear verbatim in
  the source, only this template does. `state-audit-doc.test.ts`'s
  citation-existence guard greps for the cited literal string, which this
  satisfies honestly (it is real, un-fabricated source text), but a reader
  should know the four states share one physical test body, not four
  independent ones.
- **§2's per-screen census is exhaustive (47/47), but per-state depth
  varies.** Rows with a full loading/error/empty/offline shape
  (agenda/timeline/activity/care-plan/note/pet-home/vet-visit/weight) were
  independently grep-verified state-by-state; rows marked N/A were
  confirmed by reading the actual screen source (not inferred from the
  file name), specifically to catch cases where an "obviously static"
  screen turned out to have a hidden async branch (none did, in this
  batch) — but a future screen added without following this pattern could.
- **The global banner's "cannot overlay the Emergency interstitial"
  guarantee is a layout-flow argument, not a rendered-pixel proof.** No
  jest environment lays out real pixels; the pin is "no `absolute`/`inset-`/
  `z-` token and no `position:"absolute"` in the resolved style" (M9), which
  is the same class of evidence the rest of this repo's a11y/contrast
  audits already rely on (see `docs/qa/a11y-audit.md` §7's identical
  caveat).
