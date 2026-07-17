# CHECKER review — HOTFIX-activity-log (tap-first activity logging)

Scope: 37 uncommitted porcelain paths. Read-only on code; this review file is my only write.
Gates: orchestrator-verified api 81/866, mobile 93/671, types 514 all EXIT=0. I re-ran the mobile
suite (**93 suites / 671 tests / 17 snapshots, EXIT=0**) and inspected every new/changed source file.

---

## VERDICT-CRITICAL FINDING (blocking)

### B1 — Rapid recents repeat silently DROPS the earlier log (data loss on the core path)
`apps/mobile/app/activity/[petId].tsx` `handleRecentPress` (lines 129–154):

```ts
if (undoTimerRef.current !== null) {
  clearTimeout(undoTimerRef.current);   // <-- kills the PREVIOUS pending POST
}
undoCancelledRef.current = false;
setPendingUndo({ entry, label });
undoTimerRef.current = setTimeout(() => { addActivity.mutate(...) }, 6000);
```

When a recent chip is tapped while a prior recent is still inside its 6s window, the prior timer is
cleared **without firing its `mutate`**, then overwritten. The earlier entry is never POSTed — no
error, no toast — even though the user already saw its "Logged: …" confirmation banner.

The task explicitly asked me to verify *"does a second rapid repeat within the window queue
correctly?"* — it does **not** queue; it **replaces and discards**. Realistic triggers, both on the
exact one-handed in-the-moment use case design-system §5 targets:
- Tapping the **same** recent twice to log two meals → only one meal saved.
- Morning routine (Food → Water → Potty from recents in <6s) → only Potty saved.

This directly contradicts design-system §5.4's stated principle ("2026 users expect logging to
*always* work") and produces a false-positive "Logged ✓" for the lost entries. No test covers a
second-tap-within-window scenario, so the suite is green despite the loss.

**Fix (small, bounded):** before starting a new window, *flush* any currently-pending entry —
immediately `mutate` the outstanding `pendingUndo.entry` (and clear its timer) — then open the new
undo window for the just-tapped entry. That preserves both logs while keeping undo on the latest.

---

## Non-blocking findings

- **N1 — App killed/backgrounded inside the 6s window loses the log.** Inherent to the "defer the
  POST because no `DELETE /logs` endpoint exists" design: the JS `setTimeout` never fires if the app
  is killed, so an entry the user saw confirmed as "Logged" vanishes. Acceptable as a known tradeoff
  of the no-DELETE constraint, but the confirmation copy reads as durable ("Logged: …") before the
  write is durable. Recommend either (a) persisting a pending-POST queue, or (b) softening the copy
  to a pending tone. Same root cause as B1; a flush-on-navigate/blur would also shrink this window.
- **N2 — No upper bound on `quantity` at the API layer.** `activityValueSchema.quantity` is
  `z.number().int().positive()` only (`packages/types/src/health-log.ts:149`). The client stepper
  clamps via `clampQuantity`, but a direct API call accepts `quantity: 10000`. Record-only, no
  medical/safety impact — non-blocking, as pre-flagged.
- **N3 — Recents cap is 3, design-system §5.1.3 says "~5".** `MAX_RECENTS_PER_PET = 3`
  (`activity-recents-store.ts:13`). Minor deviation; acceptable but worth a conscious call.
- **N4 — Documented §5 deviations (all executor-flagged, task schema wins):** integer-only quantity
  (no 0.5 meals/bowls step), no POTTY `accident` toggle, flat 15-min SLEEP step (§5.2 says ×15 to 2h
  then ×30), Modal reuse instead of a new `BottomSheet` primitive, `PrimaryButton` as the undo
  button. All reasonable, none safety-relevant.

---

## Verified GOOD (probes run)

- **EMPTY_RECENTS stability (probe #2):** `activity-recents-store.ts:76-81` uses a module-level
  `EMPTY_RECENTS` constant, so the selector returns a stable reference for empty pets — the infinite
  re-render loop is genuinely fixed. Swept the other new selectors: `addRecent` is selected as
  `state.addRecent` (stable fn ref); no other fresh-`[]`/fresh-object selector exists. Repeat bug
  absent.
- **≤2-tap path is REAL (probe #1):** chip tap → sheet opens pre-filled with the type's smart
  default (`ACTIVITY_TYPE_CONFIG`), and `activity-sheet-save` fires `mutate` with the pre-filled
  value **without any further input**. `activity-screen.test.tsx:117-132` asserts exactly
  `{ activityType:"WALK", quantity:20, unit:"min" }` after chip+Save, and the sheet's `useEffect`
  seeds `quantity/unit` on open. No forced typing (note is optional). Single-tap recents path posts
  immediately (deferred by design). Undo cancels cleanly: `handleUndo` sets the cancel ref AND clears
  the timer (no orphan); test at :207-221 confirms no `mutate` after cancel + full window elapse.
- **Schema/refine rigor (probe #3):** `ACTIVITY_UNITS_BY_TYPE` matches §5.2 for the spot-checked
  FOOD(`meals|grams`), POTTY(`pee|poop|both`), GROOMING(`brush|bath|nails|teeth|ears`). Invalid
  unit×type rejected at BOTH layers: client `activityValueSchema.refine` + discriminated-union
  `superRefine` (types spec), and API e2e `health-logs.e2e-spec.ts:142-152` (`POTTY`+`grams` → 400
  VALIDATION_FAILED). Dropping the refine is the executor's mutation-proof #1.
- **Vet-summary exclusion (probe #4):** `health-logs.service.ts` `vetSummary` queries only literal
  `kind:"WEIGHT"` (:212) and `kind:"NOTE"` (:216) — ACTIVITY is structurally excluded. Both
  regressions are non-vacuous: the e2e test (:509-537) asserts `summary === baseline` **and**
  `not.toContain("FOOD"/"WALK")`, so even a subtler leak into the NOTE query (`kind:{in:[…]}`) would
  change the summary vs baseline and fail. Service-level unit spec ("only queries WEIGHT/NOTE")
  covers the other half.
- **Migration (probe #5):** `20260716140000_.../migration.sql` is a single additive
  `ALTER TYPE "HealthLogKind" ADD VALUE 'ACTIVITY';` — additive/safe, timestamp correctly orders
  after `20260716130000`. (`prisma migrate status` isn't wired as a pnpm script here — harness quirk,
  not a defect; orchestrator confirmed api EXIT=0.)
- **Entry-point rewires (probe #6):** tiles rerouted to `/activity/[petId]`; testIDs renamed
  `home-quick-action-note → …-activity` and `quick-action-log-note → …-log-activity`. No dangling
  old `*-note` tile reference remains (the only `*-note` hits are the unrelated `settings-family-note`
  and the still-live `add-note-*` written-note form). C2 checklist (`docs/qa/billing-sandbox-checklist.md`)
  references only `settings-family-note`, which is untouched — checklist stays accurate. Written-note
  form stays reachable via the sheet's `activity-sheet-written-note` link → `/note/[petId]`.
- **§6/§7/design-system (probe #7):** chips/steppers are ≥44pt (chip `py-5` tiles; stepper pills
  `h-11 w-11` + `hitSlop`); a11y labels/roles/selected-state present throughout; all copy via
  `strings.ts` and neutral/record-only ("Log activity", verbs like "Fed"/"Drank") — no diagnosis,
  dosing, or advice; timeline `summarizeTimelineValue` handles absent quantity/unit and parse
  failure by returning `null` (never throws). No `<VetDisclaimer/>`/Emergency surface touched.
- **Haptics guarded:** `src/haptics.ts` wraps both calls in try/catch; used only at the §3.3 moments
  (chip-select `selection`, save-success `success`).
- **§2r7 deps:** `expo-haptics@~57.0.1` is the ONLY new dependency (package.json + lockfile), Expo
  SDK-sanctioned, lockfile entry consistent.
- **Forbidden patterns:** no `any`, no unjustified `@ts-ignore`, no `console.log`, no secrets, no
  bare TODO. The single `eslint-disable`/require is `// JUSTIFIED:` (lazy MMKV require). No files
  outside the feature's expected surface.

---

The build is otherwise high quality and safety-clean. It fails solely on B1: the core recents
rapid-repeat path silently loses logged data (and misconfirms it as saved), which the founder
specifically asked to have verified. That is a bounded, one-function fix (flush the pending POST
before opening a new undo window).

VERDICT: FAIL
