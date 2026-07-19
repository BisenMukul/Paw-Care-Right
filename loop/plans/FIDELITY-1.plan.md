# Plan — FIDELITY-1: Care Score ring + real-data "Today" aggregates

## Objective (from card)
Ship the mockup's Variant-A "AI Health Score" ring as an honestly-labelled **Care Score**
(0–100 routine-completeness derived from REAL logged data, never a health/wellbeing claim), plus a
client-side "Today" aggregate strip computed from real fetched health logs. Zero new API endpoints,
zero store/schema changes, no new deps.

---

## Data reality I verified (drives every design decision below)

- `useAgenda({from,to,petId})` (`src/api/agenda-api.ts`) → `AgendaResponse.entries: AgendaEntry[]`.
  Each entry (`packages/types/src/agenda.ts`) has `dueAt` (ISO), `status`
  (`REMINDER_EVENT_STATUSES ∪ "SCHEDULED"` — `DONE` is the completed marker), `virtual`, `petId`,
  `type`, `title`. **This is the only real, per-pet routine-completeness signal available.** Entries
  arrive `dueAt`-ascending. Existing endpoint `GET /v1/agenda`.
- `useHealthTimeline(petId, kind)` (`src/api/health-logs-api.ts`) → infinite query, page size
  `HEALTH_TIMELINE_PAGE_SIZE = 20`, newest-first, each `TimelineItem` = `{id, kind, occurredAt, value,
  photoKeys}`. `kind="ACTIVITY"` filters server-side; `value.activityType ∈ ACTIVITY_TYPES`
  (`FOOD|WATER|POTTY|SLEEP|WALK|PLAY|GROOMING`). Existing endpoint `GET /v1/pets/:id/logs`.
- The activity logger (`app/activity/[petId].tsx`) currently does **not** fetch the timeline; it uses
  `useAddActivity` (POST) + a client `activity-recents-store`. The recents store holds deduped
  `(type,quantity,unit)` combos with **no timestamps** → it is NOT a source of "today's logs".
- **Snapshot audit:** the four committed snapshots are `pet-home` (`app/pets/[id]`), `check-result`,
  `paywall`, `weight-chart`. **No snapshot covers `app/(tabs)/index.tsx` (Variant-A home).** The
  Variant-A mockup composition (greeting → hero → ring → quick actions → "Up next today") maps to the
  **tab home** `app/(tabs)/index.tsx`, not `pets/[id]`. ⇒ Placing the ring on the tab home changes
  **zero committed snapshots**; `pet-home`/`check-result`/`paywall`/`weight-chart` all stay byte-identical.

---

## Files to create/modify (exhaustive — executor may touch NOTHING else)

### Create
- `apps/mobile/src/care/care-score.ts` — pure, deterministic formula. Exports:
  `computeCareScore(input: { entries: AgendaEntry[]; now: Date }): CareScoreResult`,
  the `CareScoreResult` discriminated type, and the enumerated bucket/label/explainer strings
  (re-exported from `strings.ts`, see Interfaces). No React, no I/O.
- `apps/mobile/src/components/home/care-score-ring.tsx` — presentational SVG ring (`react-native-svg`
  `Svg`/`Circle`, already a dep). Props `{ value: number | null; testID? }`. Static (no animation).
  Stroke colors chosen at runtime via `useColorScheme()` (so both-theme tests can assert real prop
  values). testID `home-care-score-ring`.
- `apps/mobile/src/components/home/care-score-card.tsx` — container: `{ pet: Pet }` → fetches
  `useAgenda({from,to,petId: pet.id})` for the trailing-7-day window, computes via `computeCareScore`,
  renders `<CareScoreRing/>` + "Care score" label + explainer + bucket line. Owns loading/error/offline/
  empty states (never blocks the screen). testID `home-care-score-card`.
- `apps/mobile/src/health-logs/today-activity-summary.ts` — pure
  `summarizeTodayActivity(items: Array<Pick<TimelineItem,"kind"|"occurredAt"|"value">>, now: Date):
  { food: number; water: number; walk: number; potty: number }`. No React, no I/O.
- `apps/mobile/src/components/today-activity-strip.tsx` — container: `{ petId: string }` → fetches
  `useHealthTimeline(petId, "ACTIVITY")`, flattens page-1 items, computes `summarizeTodayActivity`,
  renders count chips. Own loading/empty; renders nothing that blocks logging. testID
  `activity-today-strip`.
- `apps/mobile/__tests__/care-score.test.ts` — formula edge cases (see Tests).
- `apps/mobile/__tests__/care-score-ring.test.tsx` — geometry + null state + both themes.
- `apps/mobile/__tests__/care-score-card.test.tsx` — states + testIDs + both themes.
- `apps/mobile/__tests__/today-activity-summary.test.ts` — aggregation edge cases.
- `apps/mobile/__tests__/today-activity-strip.test.tsx` — counts/empty + both themes.
- `apps/mobile/__tests__/fidelity1-strings-tone.test.ts` — §7 forbidden-vocabulary scan (mirrors
  `craft1-strings-tone.test.ts`).

### Modify
- `apps/mobile/app/(tabs)/index.tsx` — render `<CareScoreCard pet={pet} />` inside the
  `hasActivePet && pet` branch, **after** `<PetHeroCard/>` and **before** the Quick-actions `View`.
  No other change. (`PetHeroCard` stays exactly as-is — the ring is a sibling card, not a hero edit,
  so the PAWSAATHI-1 hero omission note is unaffected.)
- `apps/mobile/app/activity/[petId].tsx` — render `<TodayActivityStrip petId={petId} />` as the first
  child inside the existing `<View className="gap-6 …">` in the ScrollView (above the recents row / chip
  grid). **The ≤2-tap logger contract + undo/flush machinery (`commitEntry`, `flushPendingUndo`,
  `handleRecentPress`, `handleUndo`, `handleSheetSave`, all timers/refs) is byte-frozen — do not edit
  any of it.**
- `apps/mobile/src/strings.ts` — add a `careScore` block and a `today` (intake) block under
  `activity` (see Interfaces). Record-only wording; no new function shapes beyond one name-interpolated
  explainer.
- `apps/mobile/__tests__/home-screen.test.tsx` — add ONE assertion that `home-care-score-card` renders
  for an active pet. The existing `/v1/agenda` mock already answers the per-pet agenda query, so no
  routing change is required; **preserve every existing test and testID.**
- `apps/mobile/__tests__/activity-screen.test.tsx` — add `useHealthTimeline` to the health-logs-api
  mock (default: one empty page `{ pages:[{items:[],nextCursor:null}], … }`) so existing logger tests
  stay green, plus one strip assertion. **Preserve every existing test and testID.**

---

## Interfaces/contracts

```ts
// src/care/care-score.ts
export type CareScoreResult =
  | { kind: "score"; value: number; bucket: CareScoreBucket }   // value 0..100 integer
  | { kind: "insufficient" };                                   // no due routine in window
export type CareScoreBucket = "onTrack" | "someToLog" | "catchUp";

export const CARE_SCORE_WINDOW_DAYS = 7;

// Deterministic formula (documented weights: this is a SINGLE-SIGNAL, coarse score by design —
// see Risk R2). `now` is injected for determinism.
export function computeCareScore(input: { entries: AgendaEntry[]; now: Date }): CareScoreResult;
```

Formula (exact):
1. Window = `[startOfDay(now) − (CARE_SCORE_WINDOW_DAYS−1) days, now]`. Only entries with
   `Date(dueAt) ≤ now` are "due" (future occurrences are not yet actionable → excluded, never penalised).
2. `dueCount` = count of due entries. `doneCount` = due entries with `status === "DONE"`.
3. `dueCount === 0` → `{ kind: "insufficient" }` (honest: no routine to measure completeness against).
4. Else `value = Math.round((doneCount / dueCount) * 100)`, clamped `0..100`.
5. Bucket: `value ≥ 80 → "onTrack"`; `40 ≤ value ≤ 79 → "someToLog"`; `value < 40 → "catchUp"`.

Enumerated copy (all record-only; the §7 test scans every one):

```ts
// strings.ts → careScore
careScore: {
  label: "Care score",
  explainer: (petName: string) => `How complete ${petName}'s care routine is`,
  bucketOnTrack: "Records up to date",
  bucketSomeToLog: "A few things to log",
  bucketCatchUp: "A few things to catch up on",
  bucketInsufficient: "Start logging to build a record",
  scorePlaceholder: "—",                 // shown in the ring when kind==="insufficient"
  a11yRing: (petName: string) => `Care score for ${petName}`,
},
// strings.ts → activity.today
today: {
  title: "Today",
  meals: (n: number) => `${n} ${n === 1 ? "meal" : "meals"}`,
  water: (n: number) => `${n} water`,
  walks: (n: number) => `${n} ${n === 1 ? "walk" : "walks"}`,
  potty: (n: number) => `${n} potty`,
  empty: "Nothing logged yet today.",
},
```

Ring geometry (match mockup): `viewBox 0 0 82 82`, `cx=cy=41`, `r=34`, `strokeWidth=8`,
`C = 2·π·34`. Progress `strokeDashoffset = C · (1 − clamp(value,0,100)/100)`, `rotate(-90 41 41)`,
`strokeLinecap="round"`. `value === null` (insufficient) → render track only, no progress arc, and the
`scorePlaceholder` glyph centred.

Colors (runtime via `useColorScheme`, all from design-system §1.1/§1.1a — no NEW pairing math):
- progress stroke: light `#1f6350` (accent DEFAULT), dark `#2EA57C` (accent-bright — §1.1a table row
  "text-accent-bright on -card-dark = 5.20, AA").
- track stroke: light `#E7E0D3`, dark `#22392F` (hairline-dark) — decorative (the number conveys the
  value), exempt from the essential-info floor.
- number/label/explainer text: `text-brand-900 dark:text-ink-dark` (AAA per §1.1a).
Card surface: `bg-white dark:bg-surface-card-dark … shadow-md` (e1) — the documented dark pairing.

---

## Ordered steps
1. Add the `careScore` and `activity.today` string blocks to `src/strings.ts` (record-only copy above).
2. Create `src/care/care-score.ts` (pure formula + types + bucket→string selector helper that reads the
   `careScore` strings). No React import.
3. Create `src/health-logs/today-activity-summary.ts` (pure counts; only `kind==="ACTIVITY"` items whose
   `occurredAt` is within local `[startOfDay(now), endOfDay(now)]`, bucketed FOOD→food, WATER→water,
   WALK→walk, POTTY→potty; other activityTypes ignored).
4. Create `src/components/home/care-score-ring.tsx` (presentational SVG, static, `useColorScheme` colors).
5. Create `src/components/home/care-score-card.tsx` (fetch trailing-7-day per-pet agenda, compute, render
   ring + label + explainer(pet.name) + bucket line; loading/error/offline/empty each render a benign
   placeholder, never throw). **CHECKPOINT A:** `pnpm --filter mobile typecheck` clean.
6. Create `src/components/today-activity-strip.tsx` (fetch `useHealthTimeline(petId,"ACTIVITY")`, flatten
   `data.pages[*].items`, compute summary, render chips or `today.empty`; never blocks logging).
7. Wire `<CareScoreCard pet={pet}/>` into `app/(tabs)/index.tsx` (hero→ring→quick-actions order).
8. Wire `<TodayActivityStrip petId={petId}/>` into `app/activity/[petId].tsx` (first child of the scroll
   content `View`); confirm no logger-flow line changed.
9. Write all six test files (below). Update `home-screen.test.tsx` (+1 assertion) and
   `activity-screen.test.tsx` (mock `useHealthTimeline` + 1 assertion), preserving existing cases.
   **CHECKPOINT B:** `pnpm --filter mobile test` green; `pnpm typecheck && pnpm lint` green.

---

## Tests to write (map to acceptance criteria)

- **AC1 (Care Score derives 0–100 from REAL agenda data, deterministic)** →
  `care-score.test.ts`:
  - `no data / all-future` → `{kind:"insufficient"}` (entries `[]`, and entries all `dueAt > now`).
  - `partial` → correct value + bucket; boundary probes: 79→`someToLog`, 80→`onTrack`, 40→`someToLog`,
    39→`catchUp`.
  - `all-complete` (every due entry `DONE`) → `value:100`, `onTrack`.
  - `only DONE counts as done` (SNOOZED/SCHEDULED/other = due-but-not-done).
  - `determinism`: identical input+`now` ⇒ identical output.
- **AC2 (Care Score copy is safety-surface — no health/wellbeing/AI claim; buckets vary only in
  record-only tone)** → `fidelity1-strings-tone.test.ts`:
  - Enumerate every `careScore.*` string (incl. `explainer("Rex")`, all four bucket strings,
    `scorePlaceholder`) and every `activity.today.*` string (incl. the pluralizer functions at n=0,1,2).
  - Assert NONE match `/(health|healthy|wellbeing|well-?being|no urgent concern|urgent concern|\bAI\b|
    diagnos|condition|vitals|thriv|doing (great|well)|looks? great)/i`.
  - Assert the explainer text is invariant to the score bucket (it is a single constant function of
    `petName` only — assert `explainer("Rex")` is byte-equal regardless of any bucket).
  - Non-vacuity: the forbidden pattern DOES match a planted string `"AI health score — looking healthy"`.
- **AC3 (ring renders both themes, AA colors, honest null state)** → `care-score-ring.test.tsx`:
  - light vs dark (`jest.spyOn(ReactNative,"useColorScheme")`): progress `<Circle>` `stroke` prop is
    `#1f6350` light / `#2EA57C` dark (mirrors `home-gradient-scheme.test.tsx`'s runtime-prop assertion —
    className is not jest-flippable).
  - `value={100}` → `strokeDashoffset ≈ 0`; `value={0}` → offset ≈ `C`; `value={null}` → no progress
    circle + `scorePlaceholder` glyph present.
- **AC4 (Care Score card: states + placement + testIDs)** → `care-score-card.test.tsx`:
  - data (mock `useAgenda`) → `home-care-score-card` + `home-care-score-ring` present; bucket line text
    matches the computed bucket string.
  - loading / error / offline → benign placeholder, no throw, logger/home unaffected.
  - both themes render (colorScheme spy) without error.
- **AC5 (Today aggregates computed client-side from real logs, honest framing)** →
  `today-activity-summary.test.ts`:
  - `no data` → all zeros.
  - `partial` (some FOOD+WALK today, a SLEEP today, a FOOD yesterday) → `{food:1,water:0,walk:1,potty:0}`
    (yesterday excluded; non-tracked types ignored).
  - `all categories present today` → each count ≥1.
  - determinism with injected `now`.
- **AC6 (Today strip renders, never blocks logging, both themes)** → `today-activity-strip.test.tsx`:
  - counts render from a mocked `useHealthTimeline` page; empty page → `today.empty`; both themes render.
- **AC7 (home + activity screens still pass, testIDs preserved)** →
  `home-screen.test.tsx` (+`home-care-score-card` assertion) and `activity-screen.test.tsx`
  (`useHealthTimeline` mocked + `activity-today-strip` assertion); every pre-existing case unchanged.

## Commands to run to self-verify
- `pnpm --filter mobile test`
- `pnpm typecheck && pnpm lint`
- `pnpm build` (affected: mobile)

## Out of scope / do NOT touch
- Any API/NestJS code, Prisma, `packages/types` schemas, any store/persistence (no new zustand store,
  no new persisted key) — a pure module + a new query cache-key is the only "state" added.
- `PetHeroCard`, `app/pets/[id]`, and its snapshot; `check-result`/`paywall`/`weight-chart` snapshots —
  all stay **byte-identical**.
- The activity logger's ≤2-tap flow and undo/flush machinery.
- `dual-theme-contrast.test.ts` / any contrast math file (no NEW pairing is introduced — see R3).
- `<VetDisclaimer/>`, Emergency interstitial, dosing surfaces — untouched (this feature renders none).
- New dependencies (`react-native-svg` already present).

## Risks & the design decisions the planner made (scrutinize these)
- **R1 — Placement.** Ring → **tab home `app/(tabs)/index.tsx`** (Variant-A composition match), as its
  own e1 card between hero and quick actions (NOT edited into `PetHeroCard`). Intake strip → **activity
  logger `app/activity/[petId].tsx`** top (the screen where FOOD/WATER/WALK/POTTY are actually logged;
  the app has no standalone Food sub-screen). Both are self-contained containers that never block their
  host screen.
- **R2 — Formula is intentionally COARSE / single-signal.** The only real per-pet routine signal is
  agenda occurrences (done vs due). I deliberately **excluded** a health-log-recency signal even though
  `useHealthTimeline` exists, to (a) avoid a second network fetch on home and (b) keep the score's
  meaning *exactly* "care-routine completeness" so the label "How complete {pet}'s care routine is" is
  literally true. Score = completed÷due of trailing-7-day past-due occurrences. Weights are therefore a
  single 100% signal — documented as such rather than faking a multi-factor blend the data can't support.
- **R3 — Colors use only documented pairings.** Progress stroke #1f6350(light)/#2EA57C(dark) on
  white/`surface-card-dark`; the dark pair is the §1.1a "accent-bright on -card-dark = 5.20 AA" row, and
  the light pair is the existing accent action color — so **no new contrast math** is added and the
  contrast test stays frozen. Track colors are decorative (number conveys value).
- **R4 — Honest "insufficient" state, not a fake 0.** When no routine is due in the window the ring shows
  `"—"` + "Start logging to build a record" — never a red "0/100" that would read as a wellbeing verdict.
- **R5 — Paging honesty for the Today strip.** Counts come from page-1 (20 newest, newest-first) filtered
  to local-today. >20 logs of a single day (extremely rare) could undercount, so copy is a plain log
  summary ("Today", "2 meals") with **no total/goal/kcal** (the mockup's "/650 kcal" target is a
  fabricated claim and is dropped) — a count of logged-today entries is truthful even as a floor.
- **R6 — Static ring (no animation).** Avoids adding a second repeating/entrance motion to the home
  (design-system §3.1 one-loop rule; the gradient is the home's single loop) and makes the reduced-motion
  contract trivially satisfied. If an entrance is ever wanted it must be `useReducedMotion`-gated.
- **R7 — Re-record discipline.** No committed snapshot covers the tab home or the activity logger, so
  **zero snapshots are re-recorded**; `pet-home`/`check-result`/`paywall`/`weight-chart` remain
  byte-identical. New coverage is added via component-level tests (assertions, not `toMatchSnapshot`),
  so no `.snap` file is created or regenerated.

### Safety statement
This feature renders no AI output, no diagnosis, no dosing, and touches no disclaimer/Emergency surface.
The Care Score is a records/routine-completeness metric with explicitly record-only, non-wellbeing copy
enforced by the §7 vocabulary test (AC2). No Safety-Policy surface (PRODUCT_SPEC §5 / CLAUDE §7) is
weakened.
