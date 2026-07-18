# CHECKER review — CRAFT-2 (§7 craft audit of the check flow)

Reviewed: uncommitted working-tree diff vs HEAD `8c29bb8` against `loop/plans/CRAFT-2.plan.md`, docs/design-system.md §7, PRODUCT_SPEC §5, CLAUDE.md §7/§8. Judged from the diff and independent re-runs only.

## 1. Scope — PASS
- `git status --porcelain` = exactly 7 paths, matching the plan's exhaustive file list: 6 modified (`check-history-screen.test.tsx`, `intake-form.test.tsx`, `app/check/history/[petId].tsx`, `check-history-row.tsx`, `intake/intake-form.tsx`, `strings.ts`) + 1 new (`__tests__/craft2-strings-tone.test.ts`). Nothing else.
- Zero-diff invariants verified with `git diff HEAD -- <file>` = 0 lines each: `check/emergency/[checkId].tsx`, `vet-disclaimer.tsx`, `checks/[id].tsx`, `check/result/[checkId].tsx`, `check/waiting/[checkId].tsx`, `check/index.tsx`, `check/[category].tsx`, plus `empty-state.tsx`/`secondary-button.tsx`. `apps/api` and `packages/**`: 0 changed files.
- `__snapshots__` diffs: 0 (grep of porcelain). `check-result-snapshot` suite passes with its 7 pinned snapshots un-re-recorded.

## 2. The one new string — PASS
- `apps/mobile/src/strings.ts:474` — `emptyBody: "Past checks stay here, so you can look back or bring them to your vet."` — VERBATIM match to plan line 16, inside the existing `check.history` object; existing `empty` (line 473) untouched. `git diff --stat` = exactly 1 insertion in strings.ts; no other string changed.
- Tone: no diagnosis/med/dosing/outcome/urgency/streak language; "bring them to your vet" is escalate-toward-vet framing (§5/§7 aligned).
- **Mutation-proof re-run by checker:** recorded `sha1 ef0abc81f65defb20a0606de8ebd6df5309b9889`, planted `"Your pet will feel better soon."` into `emptyBody` → `craft2-strings-tone.test.ts` FAILED (1 failed / 5 passed) at the outcome/health-claim guard (`__tests__/craft2-strings-tone.test.ts:39`, `\bbetter\b`). Restored via reverse sed; sha1 re-verified identical (`ef0abc81...`); re-run green 6/6. Guards are non-vacuous at runtime, not just via the in-file planted-copy test.
- Regex parity: the 4 patterns in `craft2-strings-tone.test.ts:12-18` are byte-identical to `craft1-strings-tone.test.ts:26-32` (diff-compared); non-vacuity proof mirrors craft1's shape (streak plants), plus `NEW_STRINGS.length === 1` pins the sanctioned count.

## 3. History screen — PASS
- Empty state: outer `View testID="check-history-empty"` preserved (`app/check/history/[petId].tsx:80`); className change is exactly the planned `flex-1 items-center justify-center px-6` → `flex-1 justify-center px-4`; `EmptyState` called per the plan's contract — `icon="time-outline"`, `title={strings.check.history.empty}`, `body={strings.check.history.emptyBody}`, no testID, no CTA (lines 81-85).
- Load-more: diffed the block against HEAD lines 93-101 — the ONLY changed byte-range is `PrimaryButton` → `SecondaryButton`; `testID="check-history-load-more"`, label ternary (`loadingMore`/`loadMore`), `disabled={isFetchingNextPage}`, and `onPress={() => void fetchNextPage()}` byte-identical ([petId].tsx:101-106).
- Error-state retry still `PrimaryButton` ([petId].tsx:58, `check-history-retry`); `PrimaryButton` import retained (line 9).
- The new negative assertion is meaningful: `SecondaryButton` className is `border border-brand-700 bg-white` (secondary-button.tsx:41) which does NOT contain the substring `bg-brand-700`, whereas enabled `PrimaryButton` does (primary-button.tsx:45) — the test would have failed pre-change.

## 4. intake-form — PASS
- Exactly 4 hunks, each a single-line `font-medium` → `font-semibold` (lines 191, 202, 214, 223), matching the plan's four named occurrences. Zero other diffs — no testID/logic/copy drift.
- §7.3 weight count post-change: `grep font-` yields only `font-semibold` (8×) + implicit regular ⇒ ≤2 weights in the file; zero `font-medium` remains.

## 5. Test edits — PASS (additive; `{exact:false}` assessed, not a weakening)
- `check-history-screen.test.tsx`: RNTL v14 built-in matchers are in use (jest.setup.ts confirms v13+ auto-registration); `toHaveTextContent(string)` defaults to `exact: true` (whole-text equality). The empty container now holds two Text nodes, so the joined text content can no longer exactly equal `history.empty` alone — `{exact:false}` is *necessary*, and BOTH strings are individually asserted (title at test line 70-72, body at 73-75). The only property lost ("no other text") is precisely the sanctioned change, and the diff review confirms no unsanctioned text was added. Row-absence assertion and `fetchNextPage` assertions unchanged; the `bg-brand-700` negative check is purely additive.
- `intake-form.test.tsx`: additive only — `within` import + a scoped assertion on the `intake-review-edit-freetext` label (`font-semibold` present, `font-medium` absent). No existing assertion removed, retargeted, or loosened.

## 6. check-history-row — PASS
- Comment-only: one JSX comment block (`{/* ... */}`, renders nothing) recording the §7.3 tabular-nums deferral, mirroring the approved CRAFT-1 comment in `timeline-row.tsx:54-60`. No class, no render change; component `font-` classes unchanged.

## 7. Gates & re-runs (checker-executed) — numbers
- Full mobile suite: **116 suites / 841 tests / 17 snapshots — ALL PASS** (matches orchestrator claim exactly).
- Checkpoint C safety pin: `check-result-snapshot check-result-screen emergency-interstitial paywall-emergency-safety urgency-contrast` → **5 suites / 64 tests / 7 snapshots — ALL PASS**, zero `.snap` file changes afterward, safety files still zero-diff.
- `pnpm typecheck` / `pnpm lint`: green (initially FULL-TURBO cached, so re-ran `turbo run typecheck lint --filter=@pawcareright/mobile --force`: 7/7 fresh, green).
- `pnpm build`: green; forced fresh mobile build (`--force`): 6/6 green (pre-existing turbo `outputs` warning for mobile#build, not introduced here).
- `pnpm test` (repo-wide): all workspaces green EXCEPT `@pawcareright/api`, which fails at Jest globalSetup with `P1001: Can't reach database server at localhost:5432` — no docker daemon exists in this checker environment (`docker compose up` refused: daemon unavailable). `apps/api` has ZERO diff, so this is an environmental limitation identical at HEAD, not a defect of this change set. Noted, not a failing reason.
- `packages/ai` untouched ⇒ `test:ai-evals` not required.

## 8. Hygiene — PASS
- Diff scan: no `any`, no `@ts-ignore`, no `console.log`, no TODO, no secrets, no new dependencies (package.json untouched), no hardcoded user-facing strings (all copy via `strings.ts`), no renamed/dropped testIDs, no animation/haptics, no Peak-End near results.

## Adversarial findings
None blocking. The executor's report is accurate on every checked claim: file list exact, 4 deltas as planned, Checkpoint C green unedited, zero snapshot deltas, mutation-proof reproducible, string verbatim and singular.

VERDICT: pass
