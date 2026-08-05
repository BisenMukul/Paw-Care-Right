# Plan — FOUNDER-UX-3: A proper header view across pages (standard mobile app view)

## Objective (from card)
Introduce a canon `AppHeader` (compact bar: back chevron + title, safe-area-aware, both themes) and adopt it on PUSHED stack screens so every non-root page has a standard back affordance + header, while tab roots, wizards, the intake stepper, modals, and all safety surfaces keep their existing patterns. No new deps; safety surfaces stay frozen except the two sanctioned snapshot deltas.

---

## AUDIT (current state — the baseline this plan changes)

Root `Stack` in `app/_layout.tsx` sets `screenOptions={{ headerShown: false }}` globally; `(tabs)/_layout.tsx` also `headerShown: false`. So NO native header exists anywhere. Each screen paints its own in-content title; pushed screens have no visible back control (only iOS swipe / Android hardware back), except `services/adopt-detail.tsx` which hand-rolls a floating back button over its image.

Header inventory (classification drives the per-screen work below):

- **Tab roots — KEEP large in-content title, NO back** (platform convention): `(tabs)/index.tsx` (bespoke `HomeHeader`, gradient), `(tabs)/care.tsx` (agenda), `(tabs)/timeline.tsx` (bespoke `text-2xl`), `(tabs)/settings.tsx` (`ScreenScaffold title`).
- **Pushed, `ScreenScaffold`-based — ADOPT header (title → bar, keep subtitle in-scroll)**: `care-plan/[petId].tsx`, `family.tsx`, `settings/notifications.tsx`, `vet-visit/[petId].tsx`, `note/[petId].tsx`, `weight/[petId].tsx`, `services/index.tsx`, `services/vets.tsx`, `services/salons.tsx`, `services/store.tsx`, `services/adopt.tsx`, `services/insurance.tsx`, `services/book.tsx`, `services/slots.tsx`, `services/preview-end.tsx`, `services/adopt-detail.tsx` (also DELETE the hand-rolled floating back button).
- **Pushed, bespoke `SafeAreaView` — ADOPT header manually**: `pets/[id].tsx` (back-only, PINNED snapshot), `check/index.tsx` (title+back), `check/history/[petId].tsx` (title+back), `check/result/[checkId].tsx` (back-only, PINNED snapshot, §5), `join/[code].tsx` (back-only, deep-link fallback).
- **KEEP their own pattern (no AppHeader)**: `add-pet/*` (WizardScaffold Back/progress), `check/[category].tsx` intake (IntakeForm stepper header + in-flow Back), `check/waiting/[checkId].tsx` (transient poll, existing Cancel), `check/emergency/[checkId].tsx` (**ZERO-DIFF**, BackHandler block + `gestureEnabled:false`), `paywall.tsx` (modal, Maybe-later dismiss, PINNED snapshot), `reminders/edit.tsx` (modal), `add-pet` modal, `coming-soon.tsx`, `push-rationale.tsx`, all `(auth)/*`.

Safety trace for `check/result` (§5): the emergency interstitial is ALWAYS `router.replace`d out of the stack before result mounts (`check/[category].tsx` `onEmergency` → `replace(emergency)`; `emergency.handleAcknowledge` → `replace(result)`; `waiting` → `replace(result)`). Therefore a `router.back()` from result can NEVER return to or bypass the emergency interstitial. The in-content emergency notice + push-to-interstitial CTA (§5 rule 4) sits inside the ScrollView and stays first in the content region, unchanged. Adding a title-less back bar ABOVE the ScrollView does not reorder, hide, or add medical content.

The four PINNED snapshots: `pet-home-snapshot`, `check-result-snapshot`, `paywall-snapshot`, `weight-chart-snapshot`. `weight-chart` is a pure component (untouched). `paywall` is a KEEP modal (untouched → frozen). `pet-home` and `check-result` change (sanctioned deltas below).

---

## Files to create/modify (exhaustive — executor may touch NOTHING else)

### Create
- `apps/mobile/src/components/app-header.tsx` — new canon `AppHeader` (compact bar: back chevron + optional title). Both themes; safe-area handled by the composing scaffold/screen (header renders no `SafeAreaView` of its own).
- `apps/mobile/src/hooks/use-nav-back.ts` — `useNavBack(fallback?: Href)` returns a stable `onBack` callback: `router.canGoBack() ? router.back() : router.replace(fallback ?? "/(tabs)")`.
- `apps/mobile/__tests__/app-header.test.tsx` — AppHeader component tests.
- `apps/mobile/__tests__/use-nav-back.test.tsx` — fallback-routing tests.
- `apps/mobile/__tests__/header-sweep.test.tsx` — representative header-present / tab-roots-unchanged tests.

### Modify — infrastructure
- `apps/mobile/src/components/screen-scaffold.tsx` — add optional props `onBack?: () => void` and (reuse existing) `title`. When `onBack` is provided: render `<AppHeader title={title} onBack={onBack}/>` at the top (inside the existing `SafeAreaView`, above the `ScrollView`), and SUPPRESS the in-scroll `text-2xl` title block, but STILL render the `subtitle` line (if any) as the first scroll child. When `onBack` is absent: byte-identical to today (no `AppHeader`, in-scroll title block exactly as-is).
- `apps/mobile/src/strings.ts` — add ONE new user-facing string: a shared back-control accessibility label (value `"Back"`). No other copy added (all header titles reuse existing strings; the two back-only screens render no header title).

### Modify — Group A (ScreenScaffold pushed screens; pass `onBack={useNavBack(fallback)}`)
- `apps/mobile/app/care-plan/[petId].tsx` (fallback `/(tabs)`)
- `apps/mobile/app/family.tsx` (fallback `/(tabs)`)
- `apps/mobile/app/settings/notifications.tsx` (fallback `/(tabs)/settings`)
- `apps/mobile/app/vet-visit/[petId].tsx` (fallback `/(tabs)`)
- `apps/mobile/app/note/[petId].tsx` (fallback `/(tabs)`)
- `apps/mobile/app/weight/[petId].tsx` (fallback `/(tabs)`)
- `apps/mobile/app/services/index.tsx` (fallback `/(tabs)/settings`)
- `apps/mobile/app/services/vets.tsx` (fallback `/services`)
- `apps/mobile/app/services/salons.tsx` (fallback `/services`)
- `apps/mobile/app/services/store.tsx` (fallback `/services`)
- `apps/mobile/app/services/adopt.tsx` (fallback `/services`)
- `apps/mobile/app/services/insurance.tsx` (fallback `/services`)
- `apps/mobile/app/services/book.tsx` (fallback `/services`)
- `apps/mobile/app/services/slots.tsx` (fallback `/services`)
- `apps/mobile/app/services/preview-end.tsx` (fallback `/services`)
- `apps/mobile/app/services/adopt-detail.tsx` (fallback `/services/adopt`; ALSO remove the hand-rolled `services-adopt-detail-back` floating Pressable + its `arrow-back` icon — the canon header replaces it)

### Modify — Group B (bespoke pushed screens; render `<AppHeader/>` inside their own `SafeAreaView`, at the very top)
- `apps/mobile/app/pets/[id].tsx` — back-only header (`onBack` only, no title) prepended INSIDE the loaded-state `SafeAreaView`, ABOVE `pet-home-header-region`; do NOT add it to the loading/error/empty/offline early-return states. Fallback `/(tabs)`. **PINNED snapshot delta.**
- `apps/mobile/app/check/index.tsx` — title (`strings.check.title`) + back; place `AppHeader` above the offline banner block. Fallback `/(tabs)`.
- `apps/mobile/app/check/history/[petId].tsx` — title (`strings.check.history.title`) + back. Fallback `/(tabs)`.
- `apps/mobile/app/check/result/[checkId].tsx` — **back-only** header (NO title → zero new §5 copy) prepended inside the content-state `SafeAreaView`, ABOVE `check-result-scroll`; do NOT add it to the error/loading early-return states. Fallback `/(tabs)/timeline` (same terminal exit as Done). **PINNED snapshot delta.**
- `apps/mobile/app/join/[code].tsx` — back-only header at the top of its centered `SafeAreaView`. Fallback `/(tabs)`.

### Modify — tests (add router-mock fields + header assertions; re-record 2 snapshots)
- `apps/mobile/__tests__/pet-home-snapshot.test.tsx` — extend the `expo-router` mock (`back: jest.fn()`, `canGoBack: () => true`); re-record ONLY the `loaded` snapshot via `jest -u`.
- `apps/mobile/__tests__/pet-home-screen.test.tsx` — extend router mock; assert `getByTestId("app-header")` + `app-header-back` present on the loaded render.
- `apps/mobile/__tests__/check-result-snapshot.test.tsx` — extend router mock; re-record snapshots via `jest -u`. The existing disclaimer byte-identity assertions (PAWSAATHI-3 no `dark:`; FIDELITY-2 `bg-brand-50`) MUST still pass unchanged.
- `apps/mobile/__tests__/check-result-screen.test.tsx` — extend router mock; assert header + back present on the content render and that `check-result-emergency-notice` still precedes AI content.
- `apps/mobile/__tests__/check-entry-screen.test.tsx` — extend router mock; assert `app-header` present.
- `apps/mobile/__tests__/check-history-screen.test.tsx` — extend router mock; assert `app-header` present.
- `apps/mobile/__tests__/join-route.test.tsx` — extend router mock (`back`, `canGoBack`); assert `app-header` present.
- `apps/mobile/__tests__/timeline-screen.test.tsx` — assert `queryByTestId("app-header")` is null (tab root unchanged).
- `apps/mobile/__tests__/agenda-screen.test.tsx` — assert `queryByTestId("app-header")` is null (care tab root unchanged).
- `apps/mobile/__tests__/__snapshots__/pet-home-snapshot.test.tsx.snap` — regenerated (loaded case only).
- `apps/mobile/__tests__/__snapshots__/check-result-snapshot.test.tsx.snap` — regenerated.

> Group A screens are covered structurally by the `ScreenScaffold` integration test + `header-sweep` representatives (see Risk R5) rather than editing all 16 existing screen tests — their `onBack` path is one shared mechanism.

---

## Interfaces/contracts

```ts
// app-header.tsx
export interface AppHeaderProps {
  title?: string;          // omitted → no title node (back-only bar)
  onBack: () => void;      // required; the bar's reason to exist is the back control
}
export function AppHeader(props: AppHeaderProps): JSX.Element;
```
Visual/a11y spec (bind exactly to design-system tokens):
- Container: `flex-row items-center px-2 py-2` (compact), transparent background (lets the page tint / pet-home gradient show through). No `SafeAreaView` inside (parent scaffold/screen owns `edges={["top"]}`).
- Back control: `Pressable` `h-11 w-11 items-center justify-center rounded-full` (44pt, §4.1), `hitSlop` 8, `accessibilityRole="button"`, `accessibilityLabel={strings.<back label>}`, pressed `opacity 0.85` (§3.2). Icon `Ionicons name="chevron-back" size={24}` with color from `useColorScheme()` (`light "#1f6350"` → `dark "#2EA57C"`, the established pair — §1.6). testID `app-header-back`.
- Title (when present): `flex-1 text-lg font-semibold text-brand-900 dark:text-ink-dark font-display-semibold` (compact-bar size; §1.4/§1.4a), `accessibilityRole="header"`, `maxFontSizeMultiplier={1.5}` (§4.5). testID `app-header-title`.
- Root testID `app-header`.

```ts
// use-nav-back.ts
import type { Href } from "expo-router";
export function useNavBack(fallback?: Href): () => void;
```

---

## Ordered steps (split so a stall leaves a coherent partial)

**Phase 1 — foundation (self-contained, no screen touched yet):**
1. Add the back a11y string to `strings.ts`.
2. Create `use-nav-back.ts`.
3. Create `app-header.tsx` per the contract above.
4. Extend `screen-scaffold.tsx` with the additive `onBack` branch (AppHeader at top + suppress in-scroll big title + keep subtitle). Verify no-`onBack` path is byte-identical.
5. Write `app-header.test.tsx` + `use-nav-back.test.tsx`. Run `pnpm --filter mobile test` for these + existing scaffold-dependent tests to confirm the additive change froze existing snapshots.

**Phase 2 — Group A (mechanical, low risk, no pinned snapshots):**
6. Add `onBack={useNavBack(<fallback>)}` to each Group A screen (title already flows to the bar). For `services/adopt-detail.tsx` also delete the hand-rolled back Pressable/icon and its now-unused imports.
7. Run mobile tests; fix any test asserting the title via role/text (title still rendered, now in the bar).

**Phase 3 — Group B bespoke (higher care):**
8. `check/index.tsx`, `check/history/[petId].tsx`: insert `<AppHeader title=… onBack=…/>` at the top of the existing `SafeAreaView`.
9. `join/[code].tsx`: insert back-only `<AppHeader onBack=…/>` at the top.
10. `pets/[id].tsx`: insert back-only header in the LOADED return only. Update `pet-home-screen.test.tsx` + `pet-home-snapshot.test.tsx` router mocks; re-record loaded snapshot; eyeball the diff = exactly one header node added, all existing testIDs intact.

**Phase 4 — §5 surface (most care):**
11. `check/result/[checkId].tsx`: insert back-only header in the CONTENT return only (above `check-result-scroll`), NOT in error/loading returns. Confirm emergency notice, urgency banner, `<VetDisclaimer/>`, and all `check-result-*` testIDs are untouched.
12. Update `check-result-screen.test.tsx` + `check-result-snapshot.test.tsx` router mocks; re-record snapshots. Confirm the disclaimer byte-identity tests still pass and the emergency-notice-first ordering assertion holds.

**Phase 5 — sweep coverage + gates:**
13. Write `header-sweep.test.tsx` (representatives + tab-root absence). Add tab-root absence asserts to `timeline-screen.test.tsx` / `agenda-screen.test.tsx`.
14. `pnpm typecheck && pnpm lint && pnpm test`; `pnpm build` for `apps/mobile` (+ `packages/config` if reused). Confirm ONLY the two sanctioned `.snap` files changed.

---

## Tests to write (map to acceptance criteria)

- **AC1 (canon AppHeader exists, compact bar, both themes, font-display title):** `app-header.test.tsx` → renders `app-header`, `app-header-back`; with `title` renders `app-header-title` (role `header`, className contains `font-display-semibold` + `text-brand-900` + `dark:text-ink-dark`); without `title` no `app-header-title` node.
- **AC2 (back fires `router.back()` with deep-link fallback):** `use-nav-back.test.tsx` → `canGoBack()===true` ⇒ calls `router.back`, not `replace`; `canGoBack()===false` ⇒ calls `router.replace(fallback)`. `app-header.test.tsx` → pressing `app-header-back` invokes the `onBack` prop once.
- **AC3 (pushed screens carry the header; title moved to bar):** `screen-scaffold` integration case in `app-header.test.tsx` (or `header-sweep.test.tsx`) → with `onBack`, `app-header` present AND no `text-2xl` in-scroll title, subtitle still present; without `onBack`, no `app-header` and title unchanged. `header-sweep.test.tsx` representatives (`pet-home`, `check-result`, `check-entry`, `check-history`, `care-plan`, `family`, `services/index`) each assert `app-header` present.
- **AC4 (tab roots unchanged):** `timeline-screen.test.tsx` + `agenda-screen.test.tsx` assert `queryByTestId("app-header")` null; `header-sweep.test.tsx` re-asserts for timeline/settings roots.
- **AC5 (44pt + roles/labels):** `app-header.test.tsx` → back Pressable has `accessibilityRole="button"`, `accessibilityLabel` = the new back string, `h-11 w-11` (44pt) className and `hitSlop`. (Also picked up by existing `touch-targets.test.tsx` if the sweep includes AppHeader — optional add.)
- **AC6 (§5 safety intact):** `check-result-screen.test.tsx` → header + back present AND `check-result-emergency-notice` renders before the AI `Card`; disclaimer byte-identity (existing PAWSAATHI-3 / FIDELITY-2 cases) unchanged; `check-result-snapshot` re-record shows header added but emergency/urgency/disclaimer subtrees identical. Emergency screen has NO test change (zero-diff).
- **AC7 (pinned-snapshot churn is only the sanctioned two):** `pet-home-snapshot` loaded + `check-result-snapshot` re-recorded; `paywall-snapshot` and `weight-chart-snapshot` unchanged (asserted by them staying green without `-u`).

## Commands to run to self-verify
- `pnpm --filter mobile test`
- `pnpm --filter mobile test -- -u apps/mobile/__tests__/pet-home-snapshot.test.tsx apps/mobile/__tests__/check-result-snapshot.test.tsx` (scoped re-record only)
- `pnpm typecheck && pnpm lint && pnpm test`
- `pnpm build`

## Out of scope / do NOT touch
- `check/emergency/[checkId].tsx` (ZERO-DIFF), `<VetDisclaimer/>`, disclaimer copy, all check-flow payloads/logic/router TARGETS (only new back affordances are added, no existing navigation target changes).
- Tab roots' large titles; `WizardScaffold`; IntakeForm stepper; `check/waiting` Cancel; `paywall` + `reminders/edit` + add-pet modals; `coming-soon`; `push-rationale`; `(auth)/*`.
- Any right-action / header button slot (see R3). No new strings beyond the single back label. No native `Stack`/`Tabs` `headerShown` changes. No new dependencies.
- `paywall-snapshot` / `weight-chart-snapshot` (must stay frozen). Every existing testID.

## Risks & the decisions the planner made (scrutinize)
- **R1 — Custom header via `ScreenScaffold`, NOT native `Stack.Screen` headers.** Chosen for testability (native headers don't render under this jest/NativeWind setup — `className` stays a literal, matching the RESPONSIVE-1/dark-mode precedent) and full theme/token control. Trade-off: no OS large-title animation; acceptable, and it keeps tab roots' bespoke titles consistent.
- **R2 — check/result gets a BACK-ONLY header (no title) and it is safe.** Audit (above) shows the emergency interstitial is always `replace`d out before result mounts, so `router.back()` cannot bypass §5 precedence; the in-content emergency notice/CTA ordering and the disclaimer subtree are byte-identical. Back-only (no title) means ZERO new copy on a §5 surface. Sanctioned snapshot delta = one header node prepended above `check-result-scroll`. If the checker judges ANY header on the result surface unacceptable, this screen can be dropped to KEEP without affecting the rest.
- **R3 — No right-action slot this task.** Policy was "only where one already exists in-content." No pushed screen has a header-level right action today (weight's unit toggle lives inside `add-weight-form`; history "See all" lives on the entry screen, not a pushed detail). Adding an unused `right` prop would be speculative (CLAUDE §2.2), so `AppHeader` ships back+title only.
- **R4 — Modals & transient screens KEEP their pattern.** `paywall`/`reminders/edit` are `presentation:"modal"` (dismiss semantics, not back-chevron); `waiting` is a transient poll with an existing Cancel; adding a back bar would create a confusing second exit. Justified by platform convention; keeps `paywall-snapshot` frozen.
- **R5 — Per-screen coverage is representative, not exhaustive-per-file.** The 16 Group A screens share ONE mechanism (`ScreenScaffold onBack`), verified by the scaffold integration test + `header-sweep` representatives, rather than editing all 16 existing screen tests (avoids heavy per-screen mock churn / over-engineering). The two PINNED bespoke screens and the bespoke check screens get direct assertions.
- **R6 — Back-fallback map (deep-link / replace entries).** `pets/[id]`→`/(tabs)`, `check/result`→`/(tabs)/timeline`, `check/index`→`/(tabs)`, `check/history`→`/(tabs)`, `join/[code]`→`/(tabs)`, services children→`/services`, `services/index`→`/(tabs)/settings`, other Group A→`/(tabs)`. `router.canGoBack()` gates the fallback so normal pushes use real history.
- **R7 — Subtitle preservation.** For Group A screens with a subtitle, moving the title to the bar would drop the subtitle; the plan keeps the subtitle as the first in-scroll line. If a screen's snapshot/test asserts the old title+subtitle grouping, it is a Group A screen without a pinned snapshot, so re-record/adjust is local and non-safety.
