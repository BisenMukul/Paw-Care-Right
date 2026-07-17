# CHECKER Review — HOTFIX-pet-profile-ui (founder-directed pet-profile UI/UX pass)

Scope claimed: 9 files, mobile-only. Working tree verified UNCOMMITTED.

## Gates re-run by checker (not trusted from executor)
- `pnpm typecheck` → PASS (16/16, FULL TURBO — input hashes match cached green).
- `pnpm lint` → PASS (15/15; the single api warning is a pre-existing unused-eslint-disable in `apps/api/coverage/lcov-report/block-navigation.js`, unrelated to this diff).
- `pnpm --filter @pawcareright/mobile test` → PASS: 87 suites / 613 tests / 17 snapshots green (matches orchestrator's 87/613). Whole mobile suite run (not single-file).
- api jest NOT run single-file (per instruction; orchestrator already verified 81/860 EXIT=0).

## Adversarial duties — findings

1. Founder complaints — VERIFIED FIXED
   - CTA pressed feedback: `style={({ pressed }) => [{ minHeight: CTA_HEIGHT }, pressed ? { opacity: 0.85 } : null]}` in `app/pets/[id].tsx` — genuine dynamic feedback (§6-sanctioned dynamic style).
   - Reminders route: `router.push("/(tabs)/care")` — `apps/mobile/app/(tabs)/care.tsx` EXISTS; identical string-push precedent at `app/check/result/[checkId].tsx:75` (`router.replace("/(tabs)/timeline")`). Valid expo-router usage, not a silent-fail route.
   - Retry genuinely spins: `usePet` is a vanilla `useQuery` (`src/api/pets-api.ts:21`) so `isFetching` is really returned and toggles true on `refetch()`; `loading={isFetching}` → renders `pet-home-retry-spinner` (new test asserts this).

2. §7 sweep — CLEAN
   - New strings: `serverUnreachable`, `offlineNoCache`, `somethingWrongSubtitle="Get guidance on symptoms"` (uses §1-approved "guidance"), `quickActionsTitle="Quick actions"` — no diagnos*/urgency/fear tokens. The only diagnos/urgency hits in `strings.ts` are pre-existing check/emergency sections + a code comment, outside this diff.
   - Check-entry wiring byte-identical: `router.push({ pathname: "/check", params: { petId: id } })` unchanged in diff.

3. Snapshot churn honesty — CLEAN. `paywall` (2 CTAs) and `check-result` (all §5-adjacent CTAs) snapshot diffs contain ONLY the PrimaryButton wrapper change (`items-center …` → `flex-row items-center justify-center gap-2 …`) plus `style={null}`. Zero copy/content/disclaimer/emergency drift.

4. Removed `petHome.offline` key — CLEAN. Grep for `petHome.offline` across `apps/mobile` returns no dangling reference.

5. PrimaryButton API compat — CLEAN. `icon?` optional; public prop surface otherwise unchanged; typecheck green confirms every call site. Disabled/loading behavior unchanged.

6. AC2b budget test — GREEN and still binds `ctaStyle.minHeight === CTA_HEIGHT` (56) and `headerStyle.height === HEADER_CARD_HEIGHT` (140). Non-blocking note below.

7. Server-unreachable heuristic — CONFIRMED. `packages/api-client/src/errors.ts:87` documents `httpStatus: 0` as the "never reached the server" transport marker set by `normalizeNetworkError` (line 96); real HTTP responses carry their actual status (`normalizeError` uses `args.status`). No status-0 collision. `isApiError`/`ApiError` are the existing exports — no packages change.

8. Scope/§8 — see blocking finding. No `any`/`@ts-ignore`/`console.log` in added lines. Strings externalized. Icon-only elements all sit inside Pressables carrying visible Text labels + `accessibilityRole="button"` (CTA, tiles, retry) → accessible.

## Blocking findings

- B1 (scope): The working tree contains a 10th, non-mobile file — `docs/design-system.md` (untracked, 275 lines). The task card states "9 files, mobile-only"; this violates both "exactly 9 files" and "mobile-only," and adds an unrequested artifact (§2 golden rule 2: no scope creep). It has zero code/gate impact and is trivially remediated: remove it, or obtain explicit founder/planner approval to include it and re-scope the card. The doc also asserts a `packages/config` preset change is required (brand-300) that this task correctly did NOT make — leaving the doc describing work outside this hotfix. The 9 in-scope mobile files are otherwise PASS-quality; this fails only on undisclosed scope expansion.

## Non-blocking notes

- N1: The restyled CTA's real rendered height (48px icon circle + `py-4`) is ~80px, exceeding `CTA_HEIGHT=56` used in `ABOVE_FOLD_BUDGET`. On an iPhone SE the above-fold still fits comfortably (44+140+16+80 = 280 ≤ 568), so no real regression, but `CTA_HEIGHT` is now a floor rather than the actual height; the budget test asserts `minHeight` only (RNTL has no Yoga), so it stays green but is slightly less physically tight than before. Consider reconciling the constant in a future pass.
- N2: Pre-existing latent issue (documented in the new doc, NOT introduced here): `primary-button.tsx` disabled state uses `bg-brand-300`, which may be absent from the tailwind preset. Untouched by this diff — out of scope.

## Founder-facing notes
The three complaints are resolved: the "Something wrong?" button is now a tall card-button with medkit icon, subtitle, chevron and press dimming, still routing to the symptom check; the Reminders quick action now opens the real Care tab instead of a coming-soon stub; retry buttons show a real spinner while refetching. UI upgraded (hero card with avatar initial + chips, iconized quick-action grid, gradient background) with no safety-copy or emergency-flow changes. The single blocker is bookkeeping (an extra docs file beyond the agreed 9), not product behavior.

VERDICT: FAIL
Reason: B1 — `docs/design-system.md` is a 10th, non-mobile file outside the task's explicit "9 files, mobile-only" scope (§2 no scope creep). Remove the file or obtain explicit approval + re-scope; the nine mobile files themselves pass all gates, safety, snapshot-honesty, and founder-fix checks, so re-verification after remediation should be fast.
