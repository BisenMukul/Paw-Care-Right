# CHECKER Review — FOUNDER-UX-2 (intake stepper UX: single-select auto-advance + thumb-zone footer)

Scope verified: exactly 2 files modified (`git status --short`):
- `apps/mobile/src/components/intake/intake-form.tsx`
- `apps/mobile/__tests__/intake-form.test.tsx`

`question-renderer.tsx` byte-frozen (empty diff; sha1 `87b59a7…` unchanged). `strings.ts`, `packages/types/**`, `checks/intake.ts`, `intake-descriptors.ts`, `screen-scaffold.tsx`, `use-reduced-motion.ts` untouched. No file outside the plan's list.

## Gates (independently re-run)
- `pnpm typecheck` — PASS (16/16, FULL TURBO).
- `pnpm lint` — PASS (15/15; only a pre-existing 0-error/1-warning in `apps/api`, not from this diff).
- `pnpm --filter mobile test` — PASS **143 suites / 1108 tests / 17 snapshots**, EXIT 0 (matches orchestrator). (`intake-form` isolated: 16/16.)
- `pnpm build` — PASS (9/9).
- No `packages/ai` change ⇒ ai-evals correctly not required.

Note (non-blocking): jest prints "worker force exited … active timers" at end of the full run. This is a pre-existing suite-wide teardown warning (present with the same EXIT=0/1108-pass baseline); the FOUNDER-UX-2 timer is cleared on unmount (AA3) and every test restores real timers in `afterEach`. Not a regression.

## 1. DATA-INTEGRITY (§5-adjacent)
- Answer recorded BEFORE any advance, via the identical `handleAnswerChange(currentQuestion, answer)` — it is the first statement of the onChange wrapper (intake-form.tsx:152); `scheduleAutoAdvance()` is only reached afterward (line 154). PASS.
- Deselect cannot advance: guard is `answer !== undefined` (line 153). Since `SingleQuestion` never emits `undefined`, and the guard additionally blocks it, an undefined answer records-as-omit and does NOT schedule. PASS.
- No auto-advance for non-single types: `scheduleAutoAdvance` is gated on `currentQuestion.type === "single"` and is called from NO other path. `multi`/`scale`/`duration`/`photoPrompt` reach it never; quick-pick/review bodies don't call it. Proven empirically by AA4 (multi stays "Step 2 of 8") and AA5 (scale stays "Step 3 of 8"). PASS.
- Required gating byte-identical: `nextDisabled` expression (line 116) unchanged; a single tap sets `answers[id] !== undefined`, so an auto-advance is equivalent to pressing an enabled Next. Unchanged "gates Next on a required question" test passes. PASS.
- `buildIntakeCandidate`/`parseIntake`/`describeAnswer`/payload wiring untouched (lines 118-121); "submits the exact valid CompletedIntake" payload assertion unchanged and green. PASS.

## 2. TIMER SAFETY
- `clearAdvanceTimer()` runs first on every stepIndex mutation path: `goToStep` (line 72), `goNext`→`goToStep`, `handleBack` (line 93, first line), manual Next (`onPress={goNext}`, line 309), review-edit (`goToStep(...)`, lines 247 & 269), and `scheduleAutoAdvance` itself (line 81) before (re)scheduling. Unmount cleanup via `useEffect(() => clearAdvanceTimer, [])` (line 65). PASS.
- Reduced-motion → instant advance, NO timer: `if (reduced) { setStepIndex((i)=>i+1); return; }` (lines 82-85). AA6 asserts advance WITHOUT advancing fake timers — non-vacuous. PASS.
- Double-advance / skip-2 impossible: only one timer is ever live (clear-before-schedule), and the fired callback uses the functional updater `setStepIndex((i) => i + 1)` (line 88) — a single +1, race-free against stale closures. A Next tap during the beat clears the pending timer then advances once (double-tap protection). A second option tap clears+reschedules → single advance. PASS.
- No state-update-after-unmount: AA3 unmounts mid-beat, advances timers, asserts `console.error` never fired. Verified green. PASS.

## 3. Mutation-proofs (re-run by me, sha1-verified restores)
Baseline sha1 `intake-form.tsx` = `0c5a1c6be85a4c4c2b37c9b63108bf086f2549ae`.
- **Mutation A — advance without recording** (drop `handleAnswerChange` from the single-select onChange, keep `scheduleAutoAdvance`): `intake-form` → **10 failed / 6 passed**, including AA1 and the AC2 mutation-resistance test (missing `intake-review-row-s1`). Correctly fails. Restored; sha1 re-matched baseline.
- **Mutation B — remove `clearAdvanceTimer()` from `handleBack`**: `intake-form` → **1 failed / 15 passed**, the single failure being exactly `Back cancels a pending auto-advance` (AA2). Correctly fails. Restored; sha1 re-matched baseline.

(Restoration caveat handled: because the executor's work is uncommitted, `git checkout --` reverts to HEAD, not the working version. I detected the sha1 mismatch, restored the executor's exact bytes from a pre-mutation backup, and re-verified all three sha1s equal baseline. Working tree is back to the executor's state — `git status` still shows exactly the 2 modified files.)

## 4. Test honesty
- Re-targeted synthetic tests (`mutation-resistance (AC2)`, `fails closed`): the two `intake-next` presses that followed a single-option tap are replaced by `act(() => jest.advanceTimersByTime(AUTO_ADVANCE_MS))`; every multi/scale/duration/photo/quick-pick/free-text `intake-next` press remains verbatim, and all step-count / review-row / payload / validation-error / submit-disabled / `onSubmit`-not-called assertions are unchanged. Strengthened (now exercises auto-advance), never weakened — and Mutation A proves they still bite. PASS.
- New AA1–AA6 / FT1–FT2 non-vacuous: AA1 (advance+prompt+Back+selected — caught by Mut A), AA2 (cancellation — caught by Mut B), AA4/AA5 (assert still on multi/scale after a timer flush — would flip if the guard broke), AA6 (advance with NO timer flush), FT1/FT2 (footer contains next/submit + `border-t`). AA3 is the mildest (asserts `console.error` absent) but is a legitimate leaked-timer probe, not vacuous. No trivial/always-true test found.
- FOUNDER-UX-1 contracts survive: `review edit jumps back`, `free-text step is optional`, `submits the exact valid CompletedIntake`, `gates Next`, `fails closed`, and the ≤2-tap quick-picks flow (descriptor toggle + Next) all pass unchanged. PASS.

## 5. §7 / §1a copy, tokens, themes, testIDs
- Zero copy changes: no user-facing string literal added or altered; all copy still sourced from `strings.intake.*`. Forbidden-pattern scan of the diff (`any`, `@ts-ignore`, `console.log`, `TODO`, secrets) — none. (Test uses `jest.spyOn(console, "error")`, a test-only spy, not production `console.log`.) No `APP_DISPLAY_NAME` surface touched. PASS.
- Footer treatment from verified tokens, both themes: `border-t border-brand-100 dark:border-hairline-dark pt-4` — `border-brand-100` (light) + `dark:border-hairline-dark` (dark) are already in-use elsewhere in this same file (e.g. the free-text input/descriptor borders). Matches the plan-specified className exactly. PASS.
- testIDs preserved: only new testID is `intake-footer`; all existing testIDs (`intake-form`, `intake-progress`, `intake-question-prompt`, `intake-option-*`, `intake-scale-*`, `intake-duration-*`, `intake-descriptor-*`, `intake-freetext-*`, `intake-review-*`, `intake-validation-error`, `intake-back`, `intake-next`, `intake-submit`) intact; only `onPress` handlers were re-pointed. PASS.

## 6. Safety surfaces
Intake is collection-only. No change to `<VetDisclaimer/>`, Emergency interstitial, red-flag rules, `use-check-submission.ts`, or `check/[category].tsx`. PRODUCT_SPEC §5 / CLAUDE §7 untouched. No "diagnosis"/dosage/med-suggestion copy introduced. PASS.

## FAIL-condition checklist
- Advance that can skip/drop an answer — NOT present (record-first; single +1 functional updater; Mut A bites).
- Leaking timer — NOT present (unmount cleanup + clear on every path; AA3 green).
- Auto-advance on a non-single type — NOT present (type-gated; AA4/AA5 green).
- Weakened test — NOT present (re-targets strengthen; Mut A/B both bite).
- Mutation-proof that doesn't fail — NOT present (A → 10 fails, B → 1 targeted fail).

VERDICT: PASS
Reasons: All acceptance criteria verified against file:line and named tests. Both mutation-proofs re-run by me fail exactly as claimed (advance-without-recording → 10 fails incl. AC2/AA1; Back-cleanup removal → AA2), with sha1-verified restoration to the executor's exact bytes. Answer is always recorded before advance; deselect and every non-single type never auto-advance; timer is cleared on unmount/Back/goToStep/manual-Next/review-edit and reduced-motion skips it entirely; double/skip advance is structurally impossible. Full gates green (typecheck, lint, 143 suites/1108 tests, build). Zero copy changes, footer tokens valid in both themes, all testIDs preserved plus the single new `intake-footer`. Scope is exactly the 2 planned files; renderer byte-frozen.
