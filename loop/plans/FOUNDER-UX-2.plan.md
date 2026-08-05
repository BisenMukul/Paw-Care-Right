# Plan — FOUNDER-UX-2: Symptom-check intake stepper UX pass

## Objective (from card)
Make the stepped symptom intake feel "proper": add auto-advance on single-select
questions, give the Back/Next/Submit footer a real thumb-zone bar treatment, and
add scroll-to-top on step change — with ZERO change to payload shape, validation
semantics, answer semantics, red-flag/emergency path, §7 copy, or any existing
testID. Collection-only screen; PRODUCT_SPEC §5 / CLAUDE §7 untouched.

---

## AUDIT (read end-to-end; findings that shape the plan)

- **Footer is already below the ScrollView.** `intake-form.tsx` renders
  `<View className="flex-row … pt-4">` (Back + Next/Submit) at line 242 — a
  sibling AFTER `</ScrollView>` (line 240), inside the flex column. So it is
  **already bottom-pinned via flex**, not in-scroll, and already inside the
  `KeyboardAvoidingView` (KAV-safe) and the all-edges `SafeAreaView` (bottom
  inset covered). Candidate #1 is therefore NOT "move it out of scroll" — it is
  a **visual bar treatment** (hairline top border + footer padding, matching
  `ScreenScaffold`'s footer: `border-t border-brand-100 dark:border-hairline-dark … pt-3`)
  plus a stable `intake-footer` testID. **Do NOT refactor to `ScreenScaffold`** —
  intake owns its own progress header + footer + KAV; a scaffold swap is churn
  and risk for no product gain (Risk R5).
- **Steps** = `[...questions, quickPick(freeText), review]`, `total = questions.length + 2`.
  `stepIndex < questions.length` ⇒ question step (via `QuestionRenderer`);
  `=== questions.length` ⇒ quick-pick step; `=== questions.length+1` ⇒ review.
- **Single-select emits on every tap and never `undefined`** (`SingleQuestion`
  docblock: "no deselect"). The step's `onChange` is
  `(answer) => handleAnswerChange(currentQuestion, answer)`. So auto-advance can
  be wired **entirely inside `intake-form.tsx`'s onChange wrapper** by testing
  `currentQuestion.type === "single"` — **`question-renderer.tsx` needs NO edit.**
- **Required gating** (`nextDisabled`) is unchanged by auto-advance: a single tap
  makes `answers[id] !== undefined`, so advancing a single step is byte-identical
  to the user pressing an enabled Next.
- **The real `"other"` category has NO single question** (its steps are
  `onset`(duration) + `severity`(scale)). Every `otherCategoryDef` test (gating,
  back, free-text, submit, review-edit) therefore **does not trigger auto-advance
  and stays byte-identical.** ONLY the two `syntheticCategoryDef` tests
  (single `s1` and `synthetic-extra`) re-target.
- **Progress caption already renders "Step X of N"** (`strings.intake.stepOf`,
  added in FOUNDER-UX-1) as a descendant of `intake-progress`. Step context
  (candidate #3) is already satisfied ⇒ **no new strings** (keeps §7 copy frozen).
- **Entrance** is one reduced-motion-gated `FadeInDown.duration(320)` keyed by
  `stepIndex` (design-system §3.1 house pattern). Keep as-is (candidate #4).
- **KAV** already wraps content with `behavior="padding"` on iOS; duration/freetext
  inputs and the footer sit inside it. Adequate ⇒ no keyboard change.
- Tests live in `apps/mobile/__tests__/intake-form.test.tsx`; screen wrapper test
  is `intake-screen.test.tsx` (asserts `intake-form`, offline, back — unaffected).

---

## Files to create/modify (exhaustive — executor may touch NOTHING else)

### Modify
- `apps/mobile/src/components/intake/intake-form.tsx` — the ONLY production file.
  1. Add `export const AUTO_ADVANCE_MS = 300;` (module const; ~250–350ms band; test imports it — no magic number).
  2. Add `useRef` + `useEffect` imports (from `react`) and a `ScrollView` typed ref.
  3. Add `advanceTimer` ref + `clearAdvanceTimer()` + unmount cleanup effect + scroll-to-top effect.
  4. Route ALL `stepIndex` mutations through helpers that clear the timer first
     (`goToStep`, `goNext`, `handleBack`); wire single-select onChange to `scheduleAutoAdvance()`.
  5. Give the footer `View` a `testID="intake-footer"` + hairline bar treatment.
  Nothing else in the file changes — quick-pick body, review body, validation,
  `buildIntakeCandidate`/`parseIntake` wiring all byte-identical.
- `apps/mobile/__tests__/intake-form.test.tsx` — re-target the two synthetic
  single-select interactions to auto-advance (never weakened), enable fake timers
  for the auto-advance tests, add the new auto-advance + footer describes below.

### Explicitly NOT modified
- `apps/mobile/src/components/intake/question-renderer.tsx` — auto-advance lives
  in the parent's onChange wrapper; renderer stays byte-identical.
- `apps/mobile/src/strings.ts` — **no new strings** (step caption already exists).
- `packages/types/**`, `checks/intake.ts`, `intake-descriptors.ts`, `photo-prompt-question.tsx`,
  `check/[category].tsx`, `use-check-submission.ts`, `screen-scaffold.tsx`.

---

## Interfaces/contracts (executor must match)

`intake-form.tsx` (new/changed internals):
```ts
export const AUTO_ADVANCE_MS = 300; // reduced-motion → advance instantly (no timer)

const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const scrollRef = useRef<ScrollView>(null);

function clearAdvanceTimer() {
  if (advanceTimer.current !== null) { clearTimeout(advanceTimer.current); advanceTimer.current = null; }
}
useEffect(() => clearAdvanceTimer, []);                               // cleared on unmount
useEffect(() => { scrollRef.current?.scrollTo?.({ y: 0, animated: !reduced }); }, [stepIndex, reduced]); // scroll-to-top, guarded

function goToStep(index: number) { clearAdvanceTimer(); setStepIndex(index); }
function goNext() { goToStep(stepIndex + 1); }

function scheduleAutoAdvance() {                                      // only called for single-select taps
  clearAdvanceTimer();
  if (reduced) { setStepIndex((i) => i + 1); return; }               // instant when reduced motion
  advanceTimer.current = setTimeout(() => { advanceTimer.current = null; setStepIndex((i) => i + 1); }, AUTO_ADVANCE_MS);
}
```
- `handleBack()` gains `clearAdvanceTimer()` as its first line (rest unchanged).
- The question-step `onChange` becomes:
  ```tsx
  onChange={(answer) => {
    handleAnswerChange(currentQuestion, answer);
    if (currentQuestion.type === "single" && answer !== undefined) scheduleAutoAdvance();
  }}
  ```
  (Records the answer IDENTICALLY first; schedules advance only for `single`.
  `multi`/`scale`/`duration`/`photoPrompt` never call `scheduleAutoAdvance`.)
- Next button `onPress` becomes `goNext` (clears any pending timer → no double-advance
  if the user also taps Next during the beat — double-tap protection).
- Review "Edit" jumps (`intake-review-edit-*`, `intake-review-edit-freetext`) call
  `goToStep(...)` instead of `setStepIndex(...)` (clear timer for safety; behavior identical).
- Attach `ref={scrollRef}` to the existing `<ScrollView>` (no other prop change).

Footer `View` (line 242) className, both themes, matching `ScreenScaffold` footer:
`"flex-row items-center justify-between gap-4 border-t border-brand-100 dark:border-hairline-dark pt-4"`
and add `testID="intake-footer"`. Back/Next/Submit children + testIDs UNCHANGED.

FROZEN & UNCHANGED: `buildIntakeCandidate`/`parseIntake`/`describeAnswer`,
`{category, answers[], freeText?}` payload, `nextDisabled` gating expression,
every answer's semantics, all existing testIDs (`intake-form`, `intake-progress`,
`intake-question-prompt`, `intake-option-*`, `intake-scale-*`, `intake-duration-*`,
`intake-descriptor-*`, `intake-freetext-toggle`, `intake-freetext-input`,
`intake-review-*`, `intake-validation-error`, `intake-back`, `intake-next`,
`intake-submit`), the ≤2-tap quick-picks contract, the FadeInDown entrance,
`strings.intake.*` copy. NEW testID added: `intake-footer` only.

---

## Ordered steps

1. **Constant + refs.** Add `AUTO_ADVANCE_MS`, import `useRef`/`useEffect`, add
   `advanceTimer` + `scrollRef` + `clearAdvanceTimer()`.
2. **Cleanup + scroll effects.** Add the unmount-cleanup effect and the guarded
   scroll-to-top effect (keyed on `stepIndex`, `reduced`).
3. **Navigation helpers.** Add `goToStep`/`goNext`; prepend `clearAdvanceTimer()`
   to `handleBack`; add `scheduleAutoAdvance` (reduced→instant, else timer).
4. **Wire single-select.** Update the question-step `onChange` to record then, for
   `type==="single"`, call `scheduleAutoAdvance()`. Point Next `onPress` at `goNext`,
   review-edit and freetext-edit presses at `goToStep`. Attach `ref={scrollRef}`.
5. **Footer bar.** Add `testID="intake-footer"` + `border-t`/`pt-4` bar classes to
   the footer `View`. Children unchanged.
6. **Checkpoint — production compiles clean.** `pnpm --filter mobile typecheck`.
7. **Re-target the two synthetic tests** (see Tests): remove the two `intake-next`
   presses that follow a single-option tap, replace with fake-timer advance; enable
   fake timers for those tests. Multi/scale/duration/photo/quickpick Next presses
   stay. Step counts + payload assertions UNCHANGED.
8. **Add auto-advance + footer describes** (AA1–AA5, FT1–FT2; optional AA6).
9. **Checkpoint — mobile tests.** `pnpm --filter mobile test intake-form intake-screen question-renderer`.
10. **Full gates.** `pnpm typecheck && pnpm lint && pnpm --filter mobile test && pnpm build`
    (no `packages/ai` change ⇒ no ai-evals).

---

## Tests to write (map to acceptance criteria)

Fake-timer discipline: enable `jest.useFakeTimers()` for every test that taps a
single-select option (the two re-targeted synthetic tests + AA1–AA5); restore with
`jest.useRealTimers()` in that describe's `afterEach`. Flush the beat with
`await act(async () => { jest.advanceTimersByTime(AUTO_ADVANCE_MS); })`
(`act` from `@testing-library/react-native`). Import `AUTO_ADVANCE_MS` from
`../src/components/intake/intake-form`. All renders/interactions stay awaited.

**Re-targets in existing tests (never weakened — step counts + payloads identical):**
- `mutation-resistance (AC2)` test: after `press intake-option-s1-a` (step 0) REMOVE
  the following `press intake-next` → advance via timer (lands on step 1 multi).
  After `press intake-option-synthetic-extra-x` (step 5) REMOVE the following
  `press intake-next` → advance via timer (lands on step 6 quick-pick). The
  multi/scale/duration/photo/quick-pick `intake-next` presses stay verbatim. Enable
  fake timers for this test.
- `fails closed` test: same two single-option presses (`s1-a`, `synthetic-extra-x`)
  drop their trailing `intake-next` → advance via timer; multi/scale/duration/photo/
  freetext `intake-next` presses stay. Final assertions (`intake-validation-error`
  visible, `intake-submit` disabled, `onSubmit` not called) UNCHANGED. Enable fake timers.

**New describe `IntakeForm — single-select auto-advance (FOUNDER-UX-2)`:**
- **AC-AA1 (single-select advances + records the answer)** → `auto-advances a single-select and records the answer`:
  render `syntheticCategoryDef`; `press intake-option-s1-a`; advance `AUTO_ADVANCE_MS`;
  assert `intake-progress` has "Step 2 of 8" AND `intake-question-prompt` = "Synthetic multi";
  `press intake-back`; assert "Step 1 of 8" AND `intake-option-s1-a` `accessibilityState.selected === true`
  (answer recorded and preserved, byte-identically).
- **AC-AA2 (Back returns during the beat and cancels the pending timer)** →
  `Back cancels a pending auto-advance`: add a local `twoSingleDef` fixture with two
  required single questions (`q1` a/b, `q2` x/y; total 4). Render; `press intake-option-q1-a`;
  advance timer → step 2 (`q2`); `press intake-option-q2-x` (schedules advance);
  `press intake-back` BEFORE advancing timers (→ back to step 1); THEN advance
  `AUTO_ADVANCE_MS`; assert still "Step 1 of 4" (the cancelled timer did NOT fire →
  no jump to step 3) AND `intake-option-q1-a` still selected.
- **AC-AA3 (timer cleared on unmount — no state-update-after-unmount)** →
  `clears the auto-advance timer on unmount`: render `syntheticCategoryDef`, capture
  `unmount`; `press intake-option-s1-a`; `unmount()`; `act(() => jest.advanceTimersByTime(AUTO_ADVANCE_MS))`;
  assert no `console.error` (spy) was called (a leaked timer would warn on update-after-unmount).
- **AC-AA4 (multi does NOT auto-advance)** → `multi-select does not auto-advance`:
  render synthetic; auto-advance past `s1` to the multi step; `press intake-option-m1-a`;
  advance `AUTO_ADVANCE_MS`; assert still on multi (`intake-question-prompt` = "Synthetic multi",
  "Step 2 of 8") — explicit Next still required.
- **AC-AA5 (scale does NOT auto-advance)** → `scale does not auto-advance`:
  navigate to the scale step (`press intake-next` off multi); `press intake-scale-sc1-2`;
  advance `AUTO_ADVANCE_MS`; assert still on scale ("Synthetic scale", "Step 3 of 8").
- **AC-AA6 (optional, recommended — reduced-motion instant advance, no timer)** →
  `advances instantly under reduced motion`: `jest.mock`/`jest.spyOn` the
  `../src/hooks/use-reduced-motion` module to return `true`; render synthetic;
  `press intake-option-s1-a`; WITHOUT advancing timers assert already on step 2
  (multi). Restore the mock afterward.

**New describe `IntakeForm — thumb-zone footer (FOUNDER-UX-2)`:**
- **AC-FT1 (footer pinned, Next branch)** → `pins the footer bar with Next on a question step`:
  render `otherCategoryDef` (step 0, non-review); `within(getByTestId("intake-footer")).getByTestId("intake-next")`
  resolves; assert `getByTestId("intake-footer").props.className` contains `"border-t"`.
- **AC-FT2 (footer pinned, Submit branch)** → `pins the footer bar with Submit on review`:
  render `otherCategoryDef`; drive to the review step (answer onset+severity, skip
  free-text); `within(getByTestId("intake-footer")).getByTestId("intake-submit")` resolves;
  className still contains `"border-t"`.

### AC → test summary
| Acceptance criterion | Test |
|---|---|
| Single-select advances automatically | AA1, AA6 |
| The answer is recorded identically | AA1 (selected state after Back), + UNCHANGED "submits the exact valid CompletedIntake" |
| Back still works (and returns) | AA1, AA2, + UNCHANGED "back on step 0…returns to step 0" |
| Auto-advance timer cleaned up (Back + unmount, no update-after-unmount) | AA2 (Back cancels), AA3 (unmount) |
| Multi does NOT auto-advance | AA4 |
| Scale does NOT auto-advance | AA5 |
| Footer pinned in both branches (Next + Submit) | FT1, FT2 |
| Required gating byte-identical | UNCHANGED "gates Next on a required question" |
| ≤2-tap quick-picks + payload/validation frozen | UNCHANGED "free-text step is optional", "submits the exact valid CompletedIntake", "fails closed", "review edit jumps back" |

---

## Commands to run to self-verify
- `pnpm --filter mobile typecheck`
- `pnpm --filter mobile test intake-form intake-screen question-renderer`
- `pnpm typecheck && pnpm lint && pnpm --filter mobile test && pnpm build`

---

## Out of scope / do NOT touch
- `packages/types/**` (`parseIntake`, `completedIntakeSchema`, `CompletedIntake`),
  any api DTO / AI-triage prompt — payload + validation FROZEN.
- `question-renderer.tsx`, `photo-prompt-question.tsx`, `checks/intake.ts`,
  `intake-descriptors.ts` — answer semantics + serialization FROZEN.
- `<VetDisclaimer/>`, Emergency interstitial, red-flag rules engine,
  `use-check-submission.ts`, `check/[category].tsx` submit orchestration —
  safety/escalation surfaces unchanged (intake is collection-only). If any step
  seems to require touching these or a schema/copy change, STOP and write
  `FOUNDER-UX-2.blocked.md`.
- `strings.ts` copy (§7 wording frozen; NO new strings added), `screen-scaffold.tsx`,
  `use-reduced-motion.ts`, reanimated/gradient internals. No new dependencies.

---

## Risks & the design decisions the planner made (checker: scrutinize)
1. **Auto-advance delay = `AUTO_ADVANCE_MS = 300` via `setTimeout`; reduced-motion →
   synchronous advance (no timer).** 300ms sits in the card's 250–350ms band and the
   §3.1 150–350ms one-shot band. The constant is `export`ed so the test asserts the
   exact same value it drives — no magic-number drift. Reduced-motion skips the timer
   entirely (instant), honoring §3.2.
2. **Cancellation semantics — every `stepIndex` mutation clears the timer first**
   (`goToStep`/`goNext`/`handleBack`/review-edit) and `scheduleAutoAdvance` clears
   before (re)scheduling; unmount clears via effect cleanup. This gives: Back cancels
   a pending advance (AA2), a second option tap replaces (clear+reschedule → single
   advance, correct final answer), a Next tap during the beat clears then advances
   once (double-tap protection), and unmount leaves no live timer (AA3, no
   state-update-after-unmount). The advance uses the functional updater
   `setStepIndex((i) => i + 1)` so it is race-free against any stale closure.
3. **Auto-advance is wired in the parent onChange wrapper, gated on
   `currentQuestion.type === "single"` — `question-renderer.tsx` is untouched.**
   Chosen because `SingleQuestion` already emits a defined answer on every tap and
   only on taps; this keeps the renderer (and all its testIDs/`accessibilityState`)
   byte-identical and confines the change to one file. Multi/scale/duration/photo/
   quick-picks/review reach `scheduleAutoAdvance` never — they keep explicit Next.
4. **Footer mechanism — keep intake's own `SafeAreaView`+KAV+footer `View`; add only
   a hairline bar + `intake-footer` testID; do NOT adopt `ScreenScaffold`.** The
   footer is already below the ScrollView and KAV/safe-area-safe, so the "proper"
   fix is a visual bar, not a structural move. Refactoring to `ScreenScaffold` would
   discard the bespoke progress header + KAV and churn tests for no product gain.
5. **Rejected candidates (stated so the checker sees the omissions are intentional):**
   direction-aware transitions (§3.1 "at most one entrance group" — keep the existing
   gated `FadeInDown`); a new step-label string (caption "Step X of N" already exists
   — avoids re-opening §7 copy, so NO new strings for tone scan); haptics on intake
   (consistent with FOUNDER-UX-1 R6 — §3.3 scopes haptics to the logger/purchase, not
   intake); keyboard-avoidance changes (existing KAV already covers duration/freetext).
6. **Scroll-to-top on step change** via a guarded `scrollRef.current?.scrollTo?.(...)`
   effect — a low-risk UX win (long single-question lists / post-error). Optional
   chaining keeps it a no-op if the ref/method is absent (e.g. under jest), so it is
   never asserted and cannot flake a test.
7. **Only the two `syntheticCategoryDef` tests re-target** (the real `"other"` category
   has no single question, so its 6 tests stay byte-identical). Re-targeting removes a
   redundant `intake-next` after a single tap and replaces it with a fake-timer
   advance; step counts, payload assertions, and the fail-closed outcome are unchanged
   — a strengthening (auto-advance is now exercised), never a weakening.
