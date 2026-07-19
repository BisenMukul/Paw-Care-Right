# FIDELITY-1 Review — Care Score ring + Today-intake strip

Checker: adversarial review of the uncommitted FIDELITY-1 diff against
`loop/plans/FIDELITY-1.plan.md`, the mockup `docs/design/pawsaathi.dc.html`
(~58-99 Variant-A ring, ~170 FOOD screen), PRODUCT_SPEC §5, and CLAUDE §7.
Nothing trusted; every gate and both mutation-proofs re-run independently.

## Gates (independently re-run)

| Gate | Result |
|---|---|
| `pnpm typecheck` | EXIT 0 (16/16 tasks, FULL TURBO — restored tree matches executor) |
| `pnpm lint` | EXIT 0 (pre-existing api warning only, 0 errors) |
| `pnpm --filter mobile test` | EXIT 0 — **133 suites / 994 tests passed, 17 snapshots passed** |
| `pnpm build` | EXIT 0 (9/9 tasks) |

Matches orchestrator-reported numbers exactly.

## Scope (16 porcelain paths — verified exhaustive vs plan)

`git status --porcelain` = exactly 16 paths, all on the plan's create/modify
list, nothing outside it:
- Modified (5): `app/(tabs)/index.tsx`, `app/activity/[petId].tsx`,
  `src/strings.ts`, `__tests__/home-screen.test.tsx`,
  `__tests__/activity-screen.test.tsx`.
- Created (11): `src/care/care-score.ts`, `src/components/home/care-score-ring.tsx`,
  `src/components/home/care-score-card.tsx`, `src/health-logs/today-activity-summary.ts`,
  `src/components/today-activity-strip.tsx`, and the six test files.
No API/Prisma/types/store/schema/dep changes. No new snapshot files.

## 1. §5/§7 Honesty audit (core) — PASS

Read every string in the `careScore` and `activity.today` strings blocks and
every line of the five source modules. The score is labeled **routine/record
completeness only**:
- `label:"Care score"`, `explainer:"How complete {petName}'s care routine is"`,
  buckets `"Records up to date" / "A few things to log" / "A few things to
  catch up on" / "Start logging to build a record"`, `scorePlaceholder:"—"`,
  `a11yRing:"Care score for {petName}"`. No health/wellbeing/urgency/AI/
  diagnosis/vitals/condition vocabulary anywhere.
- The mockup's fabricated claims — `"AI Health Score"`, `"HEALTH"` sub-label,
  `"Active & healthy"`, `"Weight, activity & diet look great"`, `"/650 kcal"` —
  are **all** dropped/reframed. Correct honesty fix.
- **No-data is honest, never a fake score.** `computeCareScore` returns
  `{kind:"insufficient"}` → ring renders track-only + `"—"` glyph +
  "Start logging to build a record". No red 0/100 wellbeing verdict (plan R4).
- **testIDs / a11y labels** (`home-care-score-card/-ring/-bucket/-loading`,
  `ring-track/-progress/-value`, `activity-today-strip[-loading/-empty]`,
  `a11yRing`) contain zero health/urgent/AI vocabulary.
- Adversarial regex sweep of all five source files (excluding import paths):
  the only `health/goal/kcal` hits are in explanatory **comments** that state
  what the copy must NOT be (e.g. "never a health/wellbeing claim",
  "no total/goal/kcal") and the `useHealthTimeline` hook name — never a
  user-facing string. Clean.
- Feature renders no AI output/diagnosis/dosing and touches no
  `<VetDisclaimer/>`/Emergency surface — §7 rule 3 does not apply (no AI
  result surface exists here), and no §5 surface is weakened.

**Mutation-proof (1) — run + restored.** Planted `bucketOnTrack:"Health looks
great"` in `strings.ts` → `fidelity1-strings-tone.test.ts` FAILED as required
("contains none of the forbidden … vocabulary" ✕, expected false received
true). Restored via re-applied unified patch; sha1 of `strings.ts` =
`76b4f3b911074f39cafb6b855f8b96a410a8af72` (byte-identical to pre-mutation).
(Note: an initial `git checkout` reverted the unstaged file to HEAD; I detected
the sha1 mismatch immediately and re-applied the executor's exact hunks, then
re-verified sha1 + full suite green.)

## 2. Formula correctness — PASS

Independently verified `computeCareScore` against the plan spec:
window = `[startOfDay(now) − 6 days, now]`; only `dueAt ≤ now` entries are due
(future excluded, never penalised); `dueCount===0 → insufficient` (not 100);
`value = round(done/due·100)` clamped 0..100; buckets ≥80 onTrack / 40–79
someToLog / <40 catchUp. Only `status==="DONE"` counts as done. Edge cases,
boundary probes (39/40/79/80), all-done→100, window exclusion, and determinism
are all covered by `care-score.test.ts` and pass.

**Mutation-proof (2) — run + restored.** Replaced the `dueCount===0` branch with
a fake `{kind:"score",value:100,bucket:"onTrack"}` → `care-score.test.ts` FAILED
(3 tests, incl. the explicit no-data non-vacuity assertion). Restored from
scratchpad backup; sha1 of `care-score.ts` =
`84de237dd55affade7dca64552bc96fc43b5a5b8` (byte-identical).

## 3. Today aggregation honesty — PASS

`summarizeTodayActivity` filters to `kind==="ACTIVITY"` items on `now`'s LOCAL
calendar day, buckets FOOD/WATER/WALK/POTTY, ignores SLEEP/PLAY/GROOMING; no
total/goal/kcal. The strip reads page-1 only (`data.pages[0]?.items`).
Overclaim analysis: timeline is newest-first, so today's (newest) logs always
sit in page 1 unless >20 logs occur in a single day — the sole edge case yields
an **undercount floor**, never an overclaim; count copy ("2 meals") is truthful
as a floor. Empty state is honest: if page-1's 20 newest contain no today item,
nothing was logged today. Framing cannot overclaim.

## 4. Frozen machinery — PASS

- `app/(tabs)/index.tsx` diff = one import + `<CareScoreCard pet={pet} />`
  inserted **between** `<PetHeroCard/>` and the Quick-actions `View`. Nothing
  else structural; `PetHeroCard` untouched.
- `app/activity/[petId].tsx` diff = one import + `<TodayActivityStrip
  petId={petId} />` as the **first child** of the existing scroll-content
  `<View className="gap-6 …">`. The ≤2-tap logger contract + undo/flush
  machinery (`commitEntry`, `flushPendingUndo`, `handleRecentPress`,
  `handleUndo`, `handleSheetSave`, timers/refs) is byte-untouched (3 added
  lines only, presentational).
- `care-score-card.tsx` uses the existing `useAgenda({from,to,petId})` hook —
  `agenda-api.ts` is not modified, so no api-client contract change; no new
  endpoint. Loading → spinner (no score flash from partial data); error/offline/
  empty all fall to the honest insufficient presentation (`entries` default `[]`),
  never a fabricated score.

## 5. Snapshots — PASS (byte-identical after mutation runs)

`pet-home`, `check-result`, `paywall`, `weight-chart` are the only 4 `.snap`
files; `git status`/`git diff` on `__tests__/__snapshots__/` shows **no change**
after all mutation runs and the full suite. No `.snap` created/regenerated.
Test edits are additive: `home-screen.test.tsx` +1 `home-care-score-card`
assertion; `activity-screen.test.tsx` adds a `useHealthTimeline` default mock
(one empty page) + 1 strip assertion. The default mock renders the strip's
empty state (benign) and does not mask its loading/error paths, which are
covered explicitly in `today-activity-strip.test.tsx`. Every pre-existing
testID and case preserved.

## 6. Both themes / contrast — PASS

Ring stroke colors from documented §1.1/§1.1a tokens (no new pairing):
progress `#1f6350` light / `#2EA57C` (accent-bright) dark; track `#E7E0D3` /
`#22392F` (decorative — the number conveys the value). Recomputed the two
progress-on-card pairs myself:
- dark `#2EA57C` on `surface-card-dark #16241F` → **5.20** (matches plan's
  "5.20 AA").
- light `#1f6350` on white → **7.10** (AAA).
Number/label text is `brand-900`/`ink-dark` (existing AAA pairs).
`dual-theme-contrast.test.ts` is not in the diff — no contrast math added.
Runtime-prop theme assertions in `care-score-ring.test.tsx` verify the actual
`stroke` prop per scheme (className is not jest-flippable).

## 7. Hygiene

No `any`, `@ts-ignore`, `console.log`, hardcoded secrets, or unreferenced TODO
in the diff. Strings externalized via `strings.ts`. Pure modules are React/IO-free.

## Verdict rationale

No FAIL trigger present: no health/wellbeing implication in score copy or
naming; no fake/fabricated score path (insufficient state is honest); no
kcal/goal presence; no frozen-machinery drift; zero snapshot delta; both
mutation-proofs failed as required and both files restored byte-identical
(sha1-verified). All gates green (994/994).

VERDICT: PASS
Executor delivered exactly the planned 16-path scope with honest record-only
copy, a correct deterministic formula, honest no-data/paging handling, frozen
logger machinery, and byte-identical snapshots. Both adversarial mutation-proofs
behaved as claimed.
