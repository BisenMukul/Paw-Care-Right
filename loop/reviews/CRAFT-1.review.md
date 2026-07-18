# CHECKER review — CRAFT-1 (§7 craft sweep, batch 1, non-check screens)

Reviewed: uncommitted working-tree diff (37 porcelain paths) against `loop/plans/CRAFT-1.plan.md`, `docs/design-system.md` §7 (+§1–§6), CLAUDE.md §6/§7/§8.
Incident context acknowledged: executor died mid-mutation-proof #2; orchestrator restored the scaffold footer wiring; no executor final report existed, so both mutation-proofs were re-run from scratch by this checker.

---

## 1. Independent gate runs

| Gate | Result |
|---|---|
| `pnpm typecheck` | green (16/16 tasks; mobile additionally re-run with `--force`, fresh, green) |
| `pnpm lint` | green (15/15; mobile re-run `--force`, fresh, green) |
| Full mobile Jest suite (fresh, foreground) | **116 suites passed, 837 tests passed, 17 snapshots passed, 0 failed** (exit 0) |
| `pnpm test` non-mobile workspaces | all green EXCEPT `@pawcareright/api` — **environmental, not a regression**: Jest `globalSetup` runs `prisma migrate deploy` and fails `P1001: Can't reach database server at localhost:5432`; the Docker daemon is unavailable in this review sandbox (`docker compose up -d` → cannot connect to `/var/run/docker.sock`). The CRAFT-1 diff touches **zero** files outside `apps/mobile`, so api tests are unaffected by the change. |
| `pnpm build` | green (9/9 tasks) |
| `pnpm test:ai-evals` | not required — `packages/ai` untouched (`git diff --stat packages/` is empty) |

## 2. Mutation-proofs (both re-run by checker, sha1-verified restores)

**#1 — SaveConfirmation renders nothing.** Replaced the component body of `apps/mobile/src/components/save-confirmation.tsx` with `return null`. Result: **5/5 suites failed, 6 tests failed** — `save-confirmation.test.tsx` (unit) AND the screen confirmation tests in `note-screen.test.tsx`, `vet-visit-screen.test.tsx`, `weight-screen.test.tsx`, `activity-screen.test.tsx` (e.g. `activity-screen.test.tsx:165` `getByTestId("activity-saved-confirmation")` throws). Restored; sha1 `7f7091dc64c11efff708fa4dc11bc279f3ce09ac` matches pre-mutation.

**#2 — scaffold footer branch disabled.** Changed `screen-scaffold.tsx:70` to `if (footer === undefined || true)` (replicating the incident mutation). Result: **5/5 suites failed, 16 tests failed**, including the exact target `ScreenScaffold › renders the footer below the scroll when supplied` (✕, verified by name) and every footer-pinned screen assertion (`note-screen`, `vet-visit-screen`, `weight-screen`, `reminder-edit` `toContainElement` failures). Restored; sha1 `a29b26bd18d51b1c67355f027edc7ec42d0488a0` matches pre-mutation. Zero `MUTATION` remnants in either file.

Both proofs demonstrate the new test surface is non-vacuous and the incident-restored wiring is genuinely covered.

## 3. R1 — mutation un-delayed, only navigation deferred (load-bearing decision) — PASS

- `apps/mobile/app/note/[petId].tsx:91-100` — `addNote.mutate(input, { onSuccess: ... })` fires synchronously in `handleSubmit`; ONLY `router.back()` sits inside `setTimeout(..., CONFIRM_MS=1200)` (`:96-99`). Timer in `backTimerRef`, cleared in unmount effect (`:43-49`).
- `apps/mobile/app/vet-visit/[petId].tsx:91-101` — identical pattern, same clearing.
- `apps/mobile/app/weight/[petId].tsx:98-108` — `addWeight.mutate({ grams }, ...)` un-delayed; onSuccess keeps the existing `setFormVisible(false)` and only auto-clears the banner via `clearTimerRef` (2500 ms); **no router call at all** (screen never navigated — unchanged).
- `apps/mobile/app/activity/[petId].tsx:168-187` — `addActivity.mutate(vars, ...)` un-delayed; confirmation auto-clears via `sheetConfirmTimerRef` (2500 ms); no navigation.
- Tests preserve the contract: `note-screen.test.tsx` asserts `mockMutate` called **immediately** (no waitFor — strictly stronger than before), `mockBack` NOT called pre-advance, then `toHaveBeenCalledTimes(1)` after `advanceTimersByTime(1200)`. Same in vet-visit. Weight/activity assert banner shows then clears with no navigation. `jest.useRealTimers()` added to `afterEach` in note/vet-visit/weight; activity suite already had it (`activity-screen.test.tsx:68`).

No delayed mutation, no dropped back-navigation. All four confirmation timers are ref-stored and cleared on unmount.

## 4. R4 — activity undo machinery byte-identical — PASS

Extracted `commitEntry`, `flushPendingUndo`, `handleRecentPress`, `handleUndo` from `HEAD:apps/mobile/app/activity/[petId].tsx` and the working tree: **all four IDENTICAL** (mechanical diff). `undoTimerRef`/`pendingEntryRef`/`UNDO_WINDOW_MS` declarations identical (the only extra grep hits are new comments). The sheet confirmation uses exclusively its own `sheetSavedLabel` state + `sheetConfirmTimerRef` (`:55-57, 175-186`), cleared in its own unmount effect (`:102-109`). The only textual change inside `handleSheetSave` is hoisting the existing `addRecent` argument into `const entry` (semantically identical spread) so `recentEntryLabel(entry)` can reuse it — no behavior change. The pre-existing undo/flush regression tests in `activity-screen.test.tsx` are unmodified (diff is purely one added test) and green in the full run.

## 5. §7 tone scan (new strings) — PASS

All 10 new strings in `apps/mobile/src/strings.ts` read verbatim: `"Weight saved."`, `"It's on the chart."`, `"Note saved."`, `"It's on the timeline."` (×3 keys), `"Visit saved."`, `"Reminders you add will show up here so nothing slips by."`, `"Once you log weight, notes, or visits, they'll appear here as a running history."`, `"When suggestions are ready, you'll be able to add them to your reminders here."` — record-only warmth; zero outcome claims, zero diagnosis/dosing/urgency language, zero streak-pressure framing (none reference medication at all). They match the plan's enumeration exactly.

`craft1-strings-tone.test.ts` is non-vacuous: it pins `NEW_STRINGS.length === 10` and its `OUTCOME_HEALTH_CLAIM_PATTERN` was executed against the canary — `/(healthy|healthier|cure|\btreat|improve|\bbetter\b|prevent)/i` matches `"your pet is getting healthier"` → `true` (verified in node), so that copy would fail the suite. Diagnosis + dosing patterns mirror `intake-descriptors.test.ts`.

*Minor (non-blocking) finding T1:* the test's doc comment claims a "no streak/pressure framing" guard, but no streak regex exists (only diagnosis/dosing/outcome). The strings themselves are clean; noted for a future tightening.

## 6. Snapshot audit — PASS (both deltas fully sanctioned)

Exactly TWO `.snap` files changed (`git status` confirms; no other snapshot dirty).
- **pet-home**: `git diff` = exactly three `text-xs font-medium → font-semibold` chip Texts (`pet-home-species`/`-breed`/`-age`) — the plan's sole sanctioned delta. Nothing else.
- **paywall** (variants A and B, symmetric): (a) `paywall-trial-cta` node relocated from in-scroll to a footer View below `RCTScrollView` — the CTA node itself is byte-identical (same className, label, testID, disabled=false); (b) `rounded → rounded-full` on `paywall-plan-annual-highlight`; (c) `tabular-nums` appended on `paywall-price-annual/-monthly/-family`. Zero unsanctioned deltas.
- `paywall-emergency-safety` and `paywall-trigger` test files: **diffs EMPTY** (not in porcelain) and green in the full run. All `check*`/emergency/disclaimer/`medication-course-form` diffs EMPTY.

## 7. Scope + R3/R6/R7 — PASS

- All 37 porcelain paths map 1:1 onto the plan's exhaustive file list (33 modified + 4 new). No file outside the list; `packages/*`, api, web, docs, loop untouched. No new dependencies (no manifest/lockfile changes). No secrets.
- R3: `care-plan/[petId].tsx` and `settings/notifications` correctly NOT footer-pinned (notifications not even in the diff) — deliberate defer honored.
- R7 accent demotions: `care-plan-skip` (`care-plan/[petId].tsx:282`) and `family-leave-cancel` (`family.tsx:150`) → `GhostButton` with identical testID/label/onPress; asserted in `care-plan-wizard.test.tsx` / `family-screen.test.tsx` (Ghost has no `bg-brand-700`; the sibling primary still does).
- Forms (R2): `add-note-form.tsx` / `add-vet-visit-form.tsx` → `forwardRef` field-groups exposing `{ submit }`; `validateNoteForm`/`validateVetVisitForm` calls, error-slot testIDs (`add-note-error`, `add-vet-visit-error-*`), field order, and `HealthLogPhotoPicker` all unchanged — zero validation/logic drift. `submitting` deliberately kept in the prop type (doc-commented) so callers are unaffected.
- Hygiene: diff-wide grep for `console.log`, `any`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `TODO`, secret tokens → zero hits in added lines. All new renders awaited. Agenda med-dose label (`agenda-item.tsx:41-47`, `strings.agenda.medDoseLabel`) byte-identical — the file's whole diff is the single due-time line.

## 8. Test-change audit — PASS

Every modified test file is additive or a sanctioned strengthening: footer-descendant assertions added; empty-state assertions upgraded from `toBeTruthy()` to `toHaveTextContent(body)` (strictly stronger); note/vet-visit save tests re-target with fake-timer advances exactly as R1 sanctions, and now assert the mutation call **synchronously** (dropped `waitFor` = stronger) while preserving the un-weakened `mockBack` called-exactly-once assertion; reminder-edit adds med-mode footer-absent coverage. Nothing deleted, nothing loosened.

## 9. BLOCKING FINDING — `tabular-nums` is a silent no-op on native (R5 hard-stop violated)

R5 in the plan: *"If it does NOT resolve at runtime, the executor must STOP and write `loop/plans/CRAFT-1.blocked.md` … rather than fall back"*.

Verified mechanics: the class is applied via `className` strings in 10 files (activity-quantity-sheet, agenda-item, today-preview-card, timeline-row ×2, reminder-edit startdate, care-plan dates, paywall prices ×3). The installed stack is `nativewind@4.2.6` + `react-native-css-interop@0.2.6`. In css-interop's `dist/css-to-rn/parseDeclaration.js`, `font-variant-numeric` is **absent** from `validProperties` (only `font-variant-caps` is present, line 96) — unlisted properties are dropped with an internal "invalid property" warning and emit **no style**. NativeWind 4.2.6's own shipped test suite (`src/__tests__/typography.tsx:121-126`) codifies this: `tabular-nums` → `{ props: {}, invalid: { properties: ["font-variant-numeric"] } }`. No custom plugin exists in `packages/config` (grep clean). Therefore on the native runtime digits do NOT align — the class is a placebo.

Severity ruling (duty-7, "severity your call"): **FAIL**, for three reasons:
1. **The plan's blocking condition was met and ignored.** "Does not resolve at runtime" is not a gray area here — the utility emits zero style on the only runtime this app ships. R5's intent was precisely to prevent shipping a cosmetic mechanism; the correct move was `CRAFT-1.blocked.md`, escalating the choice (strip vs. route a real `fontVariant` utility through `packages/config` in a follow-up task) to the planner. The executor (who left no report) either never verified resolution or proceeded past a hard stop — with no journal justification either way.
2. **The delivered test surface institutionalizes the no-op as verified behavior.** `craft1-craft.test.tsx` (3 assertions), `activity-quantity-sheet.test.tsx` (§7.3 test), and the paywall snapshot all now green-light `className` containing `tabular-nums` — a future reader will believe digit alignment is implemented and tested. False-green is exactly what a checker exists to reject; leaving it in place is worse than the missing feature.
3. **The §7.3 acceptance criterion is literally unmet**: "Numbers that carry meaning … render with `tabular-nums` (`font-variant-numeric`) so digits align" — they do not align. This isn't cosmetically degraded; it is 100% inert.

Mitigating context (recorded honestly): the class is visually harmless (digits render proportionally, exactly as before this task), safety-neutral, and forward-compatible should css-interop add the mapping. Every OTHER §7 delta in this sweep is genuinely delivered and verified. The fix is narrow: either (a) strip the inert classes + the three test surfaces asserting them and file the R5 escalation note, or (b) keep them ONLY under an explicit planner-approved decision recorded per R5, with the tests re-labeled as class-presence (not behavior) checks and a follow-up task for a real `fontVariant` utility via `packages/config`. That decision belongs to the planner, not to a silent default — which is why this is a fail, not a footnote.

## 10. Non-blocking findings

- **F1 (§7.8/plan deviation):** the scaffold footer View is `px-4 pb-6 pt-2` (`screen-scaffold.tsx:82`) vs. the plan's `border-t border-brand-100 bg-brand-50 px-4 pb-6 pt-3`. This is the orchestrator's incident restore "per the test contract". Notably the hand-rolled paywall footer (`paywall.tsx:256`) DOES use the plan's exact classes — so the app now has two visually different footer treatments. Align in the fix pass (scaffold → plan spec, or document the divergence).
- **F2:** tone test lacks the claimed streak-pressure regex (see §5). Strings are clean; tighten opportunistically.
- **F3 (environmental):** api integration tests unrunnable in this sandbox (no Docker daemon). Must be re-run wherever `docker compose up -d` works before the milestone push; zero api files are in this diff.

## Acceptance summary

| Criterion | Status |
|---|---|
| Thumb-zone footers (note/vet-visit/weight/reminders/paywall) + med-mode absent | PASS (evidence §3, §6, §7; mutation-proof #2) |
| Peak-End confirmations, un-delayed mutations, timer hygiene | PASS (§3; mutation-proof #1) |
| Activity undo machinery untouched | PASS (§4, byte-diff) |
| Accent demotions R7 | PASS (§7) |
| Empty-state value previews | PASS (§7, §8) |
| Record-only tone | PASS (§5) |
| Snapshot scope (2 re-records, sanctioned deltas only) | PASS (§6) |
| §7.3 `tabular-nums` digit alignment | **FAIL — silent no-op; R5 hard-stop violated** (§9) |
| Gates green | PASS for everything runnable (§1) |

VERDICT: fail
- The §7.3 `tabular-nums` mechanism is a verified silent no-op on native (nativewind@4.2.6 / react-native-css-interop@0.2.6: `font-variant-numeric` not in `validProperties`, NativeWind's own tests expect `props: {}`), which met the plan's R5 explicit STOP-and-block condition; the executor neither blocked nor escalated, and three new test surfaces + the paywall snapshot now assert the inert class as if it were behavior (false-green).
- Everything else in the sweep passes adversarial review — both mutation-proofs fail correctly with sha1-verified restores, R1 mutation timing and R4 undo byte-identity hold, tone/snapshots/scope/test-changes/hygiene are clean, and the full mobile suite is green at 116 suites / 837 tests / 17 snapshots — so the required fix is narrow: resolve the tabular-nums placebo per R5 (strip + escalate, or planner-sanctioned keep with honestly-labeled tests and a `packages/config` follow-up), plus optionally align the scaffold footer chrome (F1).
