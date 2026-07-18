# Plan — CRAFT-2: §7 craft-layer sweep, batch 2 (SYMPTOM-CHECK FLOW — safety-critical)

## Objective (from card)
Apply the design-system §7.8 craft checklist to the symptom-check flow (entry, intake host + components, waiting, result, history + their components) as an AUDIT-first pass: plan only real deltas, verified-no-change everywhere else. Absolute invariants: ZERO-DIFF on `check/emergency/[checkId].tsx`, `vet-disclaimer.tsx`, `checks/[id].tsx`; NO celebration/Peak-End anywhere near symptom results (§7.5 explicitly excludes them); no wording change to ANY existing user-facing string; result-screen information hierarchy frozen; red-flag rules / polling / quota→paywall push / share payload untouched; nothing animated on the emergency screen.

## Audit outcome (headline)
The flow is already §1–§6 canon (SWEEP-3) and the intake was just craft-touched (FOUNDER-UX-1). The §7.8 audit found exactly FOUR real deltas; everything else is verified-no-change:
1. **History empty state** → `EmptyState` canon with a NEW value-preview body string (the one sanctioned new string).
2. **History load-more** `PrimaryButton` → `SecondaryButton` (§7.1 accent demotion / §2.9 hierarchy — pagination is auxiliary, the rows are the screen's primary act).
3. **Intake review-step weight discipline** (§7.3): 4× `font-medium` → `font-semibold` in `intake-form.tsx` (the flow's only third weight).
4. **`tabular-nums` comment-defer** (§7.3, known css-interop no-op per CRAFT-1 journal): ONE code comment in `check-history-row.tsx` next to the date Text — no inert class, no render diff.

**Result screen: fully verified-no-change ⇒ the check-result snapshot is NOT re-recorded.** Any `.snap` diff appearing during this task means an unintended reach — the executor must stop.

## Files to create/modify (exhaustive — executor may touch NOTHING else)
- `apps/mobile/src/strings.ts` — add ONE key: `check.history.emptyBody = "Past checks stay here, so you can look back or bring them to your vet."` inside the existing `check.history` object. NO other string touched (existing `check.history.empty` wording unchanged and still rendered).
- `apps/mobile/app/check/history/[petId].tsx` — (a) empty state: keep the outer `View testID="check-history-empty"`, change its className `flex-1 items-center justify-center px-6` → `flex-1 justify-center px-4` (so the card stretches on the §1.2 gutter), replace the inner `Text` with `<EmptyState icon="time-outline" title={strings.check.history.empty} body={strings.check.history.emptyBody} />` (no `ctaLabel`/`onCtaPress` — rows/entry are the CTA path; no new router target). (b) `check-history-load-more`: `PrimaryButton` → `SecondaryButton` (import it; keep `PrimaryButton` import for the error-state retry), preserving EXACT `testID`, label logic (`loadingMore`/`loadMore`), `disabled={isFetchingNextPage}`, `onPress`. Nothing else on the screen changes.
- `apps/mobile/src/components/intake/intake-form.tsx` — §7.3 only: the four `font-medium` occurrences → `font-semibold` (review-row prompt `text-sm font-medium text-brand-900`, the two review "Edit" labels `text-sm font-medium text-brand-700`, and the freetext review-row title `text-sm font-medium text-brand-900`). ZERO other change — step logic, KAV, progress bar, descriptor chips, every testID, and the bottom-pinned Back/Next/Submit row are untouched (see R3).
- `apps/mobile/src/components/check-history-row.tsx` — comment-only: one line above the date `Text` recording the §7.3 tabular-figures intent deferred until react-native-css-interop maps `font-variant-numeric` (mirror the CRAFT-1 `timeline-row.tsx` comment). No class, no render diff.
- `apps/mobile/__tests__/check-history-screen.test.tsx` — ADDITIVE only: (a) in "renders empty state" also assert `check-history-empty` `toHaveTextContent(strings.check.history.emptyBody)` (existing `history.empty` assertion stays); (b) in "load-more calls fetchNextPage" also assert the load-more button's rendered className does NOT contain `bg-brand-700` (Secondary, not primary fill). No assertion removed or weakened.
- `apps/mobile/__tests__/intake-form.test.tsx` — ADDITIVE only: in the existing "free-text step is optional; typed text appears in the review row" test (line ~179), after reaching review assert the `intake-review-edit-freetext` label Text className contains `font-semibold` and does not contain `font-medium`. Nothing re-targeted.
- `apps/mobile/__tests__/craft2-strings-tone.test.ts` — NEW: tone scan over the single new string, mirroring `craft1-strings-tone.test.ts`: `NEW_STRINGS = [strings.check.history.emptyBody]`, length===1, and the four guards (diagnosis `/diagnos/i`, the dosing/med pattern, the outcome/health-claim pattern, the streak-pressure pattern — copy the exact regexes from craft1) each match nothing; include the craft1-style non-vacuity proof (planted strings caught).

## Per-screen §7.8 audit — item → named test or verified-no-change
| Screen / component | 60/30/10 | ≤4 sizes / ≤2 weights | Relationship spacing | Thumb zone (§7.4) | Peak-End (§7.5) | Empty value-preview (§7.6) | Anti-patterns (§7.7) |
|---|---|---|---|---|---|---|---|
| `check/index` (entry) | VNC — white tiles on brand-50, no leak | VNC — 2xl/base/sm/xs; regular+semibold+canon-bold header (CRAFT-1 precedent, R8) | VNC — gap-2/3 intra, gap-6 inter | VNC — browse screen, exempt | n/a | VNC — `recentEmpty` already previews; new strings NOT sanctioned here | VNC |
| `check/[category]` (host + overlays) | VNC — one primary per overlay state | VNC — lg/base/sm | VNC — gap-4 centered states | VNC — overlay CTAs are the single centered action | VNC — error/offline/quota overlays already calm; copy frozen; quota→paywall push byte-identical | n/a | VNC |
| `intake-form` | VNC | **DELTA: 4× font-medium→font-semibold** → `intake-form.test.tsx` additive assertion | VNC — gap-2/3/4 | VNC — Next/Submit already bottom-pinned by its own KAV footer row (FOUNDER-UX-1; R3) | n/a (collection, no save moment) | n/a | VNC (chips = selection-over-input exemplar) |
| `question-renderer` | VNC — selected fills are the sanctioned accent | VNC — lg/base/sm, semibold+regular | VNC | n/a | n/a | n/a | VNC |
| `check/waiting` | VNC | VNC — lg/base, 2 sizes | VNC — gap-4 centered | VNC — no primary action; Cancel is tertiary Ghost, centered is correct | VNC — negative-peak already calm; copy frozen (no new copy allowed); spinner stays (SWEEP-3 R6 — no content-shaped layout to skeleton; R2) | n/a | VNC — nothing animated added |
| `check/result` | VNC — red/amber safety surfaces EXEMPT (safety signals, never demoted); find-vet is the one accent primary; emergency-notice CTA frozen | VNC — lg/base/sm; banner `font-bold` is WCAG-contrast-mandated (SWEEP-3 R3), exempt | VNC — gap-2 intra / gap-6 inter | **Decision: DO NOT pin actions** (R1) — pinned actions would be reachable with `<VetDisclaimer/>` scrolled off-screen, breaking the frozen disclaimer-above-actions reading order | VNC — NO celebration; done/find-vet in-scroll after the disclaimer ARE the ending (§7.5 exclusion) | n/a | VNC — result is multi-action, mid-scroll-CTA anti-pattern does not apply |
| `check/history` | **DELTA: load-more → SecondaryButton** → `check-history-screen.test.tsx` additive assertion | VNC per render branch — empty: 2xl/xl/base/sm; populated: 2xl/base/sm/xs (branches never co-render) | VNC | VNC — browse/list, exempt | n/a | **DELTA: EmptyState + `check.history.emptyBody`** → `check-history-screen.test.tsx` + `craft2-strings-tone.test.ts` | VNC — fixes the "generic empty" smell |
| `category-grid` | VNC — IconTile canon since SWEEP-3 | VNC | VNC | n/a | n/a | n/a | VNC |
| `check-history-row` | VNC — dark-on-tint chips (SWEEP-3 R3) | VNC | VNC | n/a | n/a | n/a | **comment-defer only** for tabular figures (R7) |
| `check/emergency`, `vet-disclaimer`, `checks/[id]` | **ZERO-DIFF — do not open to edit** (safety invariants) | — | — | — | — | — | — |

## Existing §7/§5 safety tests — what pins what (SWEEP-3's list still applies) + snapshot treatment
- `__tests__/check-result-snapshot.test.tsx` + `__snapshots__/check-result-snapshot.test.tsx.snap` — 7 pinned snapshots (5 tiers + FALLBACK + emergency-notice), disclaimer node byte-pinned. **Treatment: NOT re-recorded — result screen has zero diff this task. Must pass with NO `.snap` file change (`git status` clean of snapshots).**
- `__tests__/emergency-interstitial.test.tsx` — emergency precedence, no-AI-content, BackHandler, acknowledge-only nav, hotlines. Green UNCHANGED (screen zero-diff).
- `__tests__/check-result-screen.test.tsx` — emergency-notice-above-content, done/find-vet/share handlers + share payload, disclaimer-in-share. Green UNCHANGED.
- `__tests__/paywall-emergency-safety.test.tsx` — green unchanged (no paywall surface touched; quota push byte-identical).
- `__tests__/check-flow-a11y.test.tsx` + `urgency-contrast.test.ts` — green unchanged (no color/contrast/testID/role change; it asserts nothing about the load-more variant or the empty inner markup — grep-verified).
- `__tests__/check-entry-screen.test.tsx`, `check-waiting-screen.test.tsx`, `category-grid.test.tsx`, `intake-screen.test.tsx`, `question-renderer.test.tsx`, `photo-prompt-question.test.tsx`, `intake-descriptors.test.ts`, `check-deeplink-route.test.tsx` — green with zero edits (their surfaces are verified-no-change).
- `__tests__/check-history-screen.test.tsx`, `intake-form.test.tsx` — the ONLY two touched, additively (enumerated above); no assertion removed/weakened.

## Ordered steps (with checkpoint suite runs)
1. `strings.ts`: add `check.history.emptyBody` (exact string above; nothing else).
2. Write `craft2-strings-tone.test.ts`; run `pnpm --filter mobile test craft2-strings-tone` — green.
3. `check/history/[petId].tsx`: EmptyState empty state + load-more → SecondaryButton (testIDs/labels/handlers preserved exactly).
4. Update `check-history-screen.test.tsx` additively; **Checkpoint A:** `pnpm --filter mobile test check-history-screen check-flow-a11y check-entry-screen` — green.
5. `intake-form.tsx`: the 4 weight changes; update `intake-form.test.tsx` additively; **Checkpoint B:** `pnpm --filter mobile test intake-form intake-screen question-renderer intake-descriptors` — green.
6. `check-history-row.tsx`: add the tabular-figures deferral comment (comment only).
7. **Checkpoint C (safety pin):** `pnpm --filter mobile test check-result-snapshot check-result-screen emergency-interstitial paywall-emergency-safety urgency-contrast` — ALL green with zero edits and zero snapshot diffs; verify `git status` shows no change under `__snapshots__/` and no diff to `check/emergency/[checkId].tsx`, `vet-disclaimer.tsx`, `checks/[id].tsx`, `check/result/[checkId].tsx`, `check/waiting/[checkId].tsx`, `check/index.tsx`, `check/[category].tsx`.
8. **Full gates:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (mobile affected; `packages/ai` untouched ⇒ no ai-evals).

## Tests to write (map to acceptance criteria)
- **AC empty-state value preview (§7.6)** → `check-history-screen.test.tsx` "renders empty state": `check-history-empty` contains BOTH `history.empty` (existing, unweakened) and `history.emptyBody`.
- **AC new-string tone safety (card: enumerated for tone scan)** → `craft2-strings-tone.test.ts`: the 1 new string passes diagnosis/dosing/outcome-claim/streak-pressure guards + non-vacuity proof.
- **AC accent demotion (§7.1/§2.9)** → `check-history-screen.test.tsx` "load-more calls fetchNextPage": load-more still fires `fetchNextPage`, keeps testID/labels/disabled, and has no `bg-brand-700` primary fill.
- **AC weight discipline (§7.3)** → `intake-form.test.tsx` review test: edit label is `font-semibold`, not `font-medium`.
- **AC safety invariants (all)** → existing pinned suites in Checkpoint C pass with zero edits AND zero snapshot re-records — the load-bearing evidence that hierarchy, disclaimer, emergency, polling, quota push, and share payload are untouched.
- **Every other §7.8 item** → verified-no-change per the audit table (no test churn manufactured for non-deltas).

## Commands to run to self-verify
- `pnpm --filter mobile test craft2-strings-tone check-history-screen intake-form`
- `pnpm --filter mobile test check-result-snapshot check-result-screen emergency-interstitial paywall-emergency-safety`
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build`

## Interfaces/contracts (executor must match)
- `EmptyState` props (landed canon): `{ testID?, icon: IoniconsName, title: string, body?: string, ctaLabel?, onCtaPress?, ctaTestID? }` — call with `icon="time-outline"`, `title={strings.check.history.empty}`, `body={strings.check.history.emptyBody}`, NO testID (the outer View keeps `check-history-empty`), NO CTA.
- `SecondaryButton` props: `{ label, onPress, disabled?, testID? }` — same shape as the PrimaryButton call it replaces.
- New string key path exactly `strings.check.history.emptyBody`.
- testIDs: every existing testID in the flow preserved verbatim; ZERO renamed/dropped; none added.

## Out of scope / do NOT touch
- **ZERO-DIFF:** `apps/mobile/app/check/emergency/[checkId].tsx`, `apps/mobile/src/components/vet-disclaimer.tsx`, `apps/mobile/app/checks/[id].tsx` — do not open to edit.
- **Verified-no-change (not in the file list ⇒ untouchable):** `check/index.tsx`, `check/[category].tsx`, `check/waiting/[checkId].tsx`, `check/result/[checkId].tsx`, `question-renderer.tsx`, `photo-prompt-question.tsx`, `category-grid.tsx`, `urgency-display.ts`, `intake-descriptors.ts`, `intake.ts`, `use-check-submission.ts`, `share-payload.ts`, `region.ts`, `vet-search.ts`, `check-history.ts`, `checks-api.ts`, `screen-scaffold.tsx`, `save-confirmation.tsx`, `app/_layout.tsx`, all `emergency-*`/snapshot test files, `packages/**`.
- No snapshot re-records of ANY kind. No new deps. No logic/store/router/polling/payload changes. No haptics, no animation, no new copy beyond the one enumerated string. All test renders awaited (RNTL v14 house pattern).

## Risks & the design decisions the planner made (SAFETY first — checker scrutinize each)
- **R1 (SAFETY — result actions NOT footer-pinned; result fully zero-diff).** §7.4 candidacy was assessed and REJECTED: pinning find-vet/done in a scaffold footer would make the ending actions reachable while the guidance Card and `<VetDisclaimer/>` sit off-screen above, breaking the frozen reading order (emergency notice → fallback → urgency banner → guidance → disclaimer → actions) — exactly the card's "if pinning would push the disclaimer off-flow, DON'T pin". The in-scroll action stack after the disclaimer is also §7.5's sanctioned ending ("the done/find-vet actions ARE the ending"). Consequence: zero result diff, snapshot untouched — the strongest possible guarantee that the disclaimer node stays byte-identical.
- **R2 (SAFETY — waiting screen zero-diff).** §7.5 negative-peak audit: copy is frozen (no wording changes allowed), the layout is already calm (centered, gap-4, Ghost cancel), and the spinner remains the sanctioned indication (SWEEP-3 R6: an indeterminate job wait has no content-shaped layout to skeleton; a "gentle skeleton" here would fake content). Nothing added, nothing animated.
- **R3 (thumb-zone: intake NOT rehosted into ScreenScaffold footer).** FOUNDER-UX-1 already bottom-pins Back/Next/Submit in intake-form's own KAV footer row below its step ScrollView — §7.4 is satisfied as-is. Rehosting into the CRAFT-1 scaffold footer would require restructuring `check/[category].tsx` (which owns absolute-positioned submit overlays over the form) and intake-form's KAV/SafeAreaView, churning a safety-adjacent, freshly-landed surface for zero §7.4 gain ("audit, don't churn"). Verified-no-change.
- **R4 (load-more Primary→Secondary — the one hierarchy demotion).** Presentational only; testID/label/disabled/handler byte-identical; no test asserts a primary fill on it (grep-verified: only `check-history-screen.test.tsx` references it, by testID/label). Justification: §7.1 accent audit + §2.9 — pagination is auxiliary to the rows. Non-safety surface (history list, no AI content).
- **R5 (the ONE new string).** `check.history.emptyBody` is additive value-preview body copy for the history empty state — the only place the card sanctions new copy. Existing `history.empty` is unchanged AND still rendered as the EmptyState title (the existing `toHaveTextContent` pin stays green, style-around-words). Tone-scanned by a dedicated non-vacuous test.
- **R6 (intake weight consolidation).** `font-medium` → `font-semibold` (4 instances) removes the flow's only third weight, matching the CRAFT-1 pet-header-card precedent; no test or snapshot asserts `font-medium` anywhere in `apps/mobile/__tests__` (grep-verified: zero matches).
- **R7 (`tabular-nums` = comment-defer).** Known silent no-op in react-native-css-interop 0.2.6 (CRAFT-1 checker finding); per card, NO inert classes and NO fontVariant plumbing — one deferral comment in `check-history-row.tsx` records the intent. Zero render diff.
- **R8 (weights interpretation).** Canon `text-2xl font-bold` headers (§6) plus one working weight (semibold) plus regular is treated as §7.3-compliant, per the CRAFT-1 precedent; the result banner's `font-bold` is WCAG-contrast-mandated (SWEEP-3 R3) and exempt. No demotions attempted — demoting either would fight §6 canon or safety contrast.
- **R9 (60/30/10 safety exemption applied).** The red emergency notice/interstitial and the urgency banner fills are SAFETY signals, not accent — explicitly exempt from demotion and untouched; the audit found no true accent leak elsewhere in the flow.
