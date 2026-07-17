# CHECKER review — SWEEP-1 (design-system foundation, batch 1)

Adversarial review of the uncommitted working tree (29 porcelain paths) against
`loop/plans/SWEEP-1.plan.md`, `docs/design-system.md` §1.1/§2.1–2.3/§2.11/§3.2/§4,
and CLAUDE.md §6/§7. Executor reports were NOT trusted; every claim re-derived
from code + independent test runs.

## Gate re-runs (independent)
- `pnpm --filter mobile test` → **101 suites / 703 tests, EXIT 0** (matches orchestrator; was 93/673).
  One "worker force-exited" warning (leaked timer) — non-fatal, pre-existing pattern, exit 0.
- `pnpm --filter @pawcareright/config test` → **2 suites / 13 tests, EXIT 0**.
- typecheck / lint / build: trusted from orchestrator (all 0); no diff evidence contradicts them
  (no `any`/`@ts-ignore`/`console.*`/`eslint-disable` introduced — verified by grepping the diff;
  the only "any" hits are the English word in two comments).

## 1. Scope — PASS
All 29 porcelain paths are on the plan's exhaustive list (plan lines 11–49):
15 modified + 14 created, each mapped. The four "touch ONLY if" files are respected:
`agenda-screen.test.tsx`, `timeline-screen.test.tsx`, `root-layout.test.tsx`, and the
`pet-home-snapshot.test.tsx` *test body* are all absent from porcelain (untouched). Only the
`.snap` changed (see §6). No files outside plan scope. `strings.ts`, `packages/types`, API,
`package.json`, and the lockfile are all unchanged.

## 2. AC1 phantom token — PASS
- Preset now holds the full §1.1 8-stop scale with exact hexes:
  50 `#f2f8f6`, 100 `#dcece6`, 200 `#bcdcd2`, 300 `#8fc4b3`, 500 `#2f8f74`, 600 `#27795f`,
  700 `#1f6350`, 900 `#123a30`. Diff is additive-only (200/300/600); pre-existing shades untouched.
- Every `brand-N` used anywhere in `apps/mobile` resolves: the used set is `{50,100,200,300,700,900}`
  (grep count), all defined in the preset. No `brand-400`/`brand-800` anywhere. (Fewer shades used
  than the planner's cross-check predicted — 500/600 unused in mobile — which only strengthens the claim.)
- Token-test pair is **non-vacuous as a pair**. `primary-button-disabled.test.tsx` asserts only the
  className string `bg-brand-300` — which renders regardless of preset contents, so on its own it is
  vacuous, AND the test file says so explicitly (NativeWind CSS pipeline stubbed). The REAL pin is
  `packages/config/src/tailwind-preset.spec.ts`, whose regex `/300:\s*"#8fc4b3"/` fails if the shade
  is removed from the preset (fs-content assertion, deterministic). Together they pin both halves of the
  contract: component still requests the class + the class is a real color.
  Note: the executor's alleged mutation-proof ("brand-300 removal → primary-button-disabled fails") is
  imprecise — that removal fails the *config* spec, not the mobile className test — but AC1 is genuinely pinned.

## 3. AC2 reduced-motion — PASS
- `use-reduced-motion.ts` is the exact single-import wrapper over reanimated's `useReducedMotion`.
- All five sites gated: gradient `withRepeat` + overlay (`animated-gradient-background.tsx` — loop early-returns
  when reduced, overlay `<Animated.View testID="home-gradient-overlay">` rendered only when `!reduced`,
  base `home-gradient-background` always present), `quick-actions-grid.tsx`, `quick-actions.tsx`,
  `pet-header-card.tsx`, and `app/pets/[id].tsx` CTA — all via `{...(reduced ? {} : { entering: … })}`
  (functionally identical to the plan's `entering={reduced ? undefined : …}`; when reduced, `entering` is absent).
- Skeleton pulse gated behind `!reduced` (early-return in the effect; reduced branch renders a static
  `{opacity:0.6}` View, animated branch renders `Animated.View`). Verified by code inspection AND
  `skeleton.test.tsx` spies `withRepeat` and asserts it is NOT called when reduced.
- Root `<ReducedMotionConfig mode={ReduceMotion.System} />` mounted inside `SafeAreaProvider` in `_layout.tsx`.
- jest.setup adds `useReducedMotion: () => false`, `ReducedMotionConfig: () => null`,
  `ReduceMotion` enum — no other mock touched.
- `reduced-motion-gating.test.tsx` is non-vacuous: for each site it asserts CONTENT PRESENCE (all tiles /
  pet name / base gradient rendered) AND `entering === undefined` when reduced / `defined` when not.
  This would fail if the entrance gate were dropped (the executor's stated mutation-proof).

## 4. AC3 primitives + reference adoption — PASS
- `ScreenScaffold`, `Card`, `SectionHeader`, `Skeleton` match the plan's interface contracts verbatim
  (props, base classes `rounded-2xl bg-white p-4 shadow-md gap-2`, a11y roles, `hitSlop {8,8,8,8}`,
  bones `h-4 rounded-lg bg-brand-100` last `w-2/3`). Their tests assert classes, roles, gradient
  mount/omit, scrollTestID, and fire real presses.
- Home adoption (`app/(tabs)/index.tsx`): routed through `<ScreenScaffold gradient scrollTestID="home-scroll">`,
  quick-actions heading now `<SectionHeader/>`, loading hero now `<Card testID="home-hero-skeleton"><Skeleton lines={2}/></Card>`.
  Every pre-existing testID preserved (`home-scroll` via `scrollTestID`; tile/hero/empty testIDs live in
  unchanged children). Child order preserved: HomeHeader → PetSwitcher/PetHeroCard(or skeleton/empty) →
  quick-actions section → TodayPreviewCard. HomeHeader moving into the scroll region is the plan-sanctioned
  design (risk note 1). `home-screen.test.tsx` adds the pending-query `home-hero-skeleton` case per plan.

## 5. AC4 touch targets — PASS
- Both filter-chip files match the chip class contract exactly
  (`mr-2 min-h-[44px] justify-center rounded-full … px-3` container; `text-sm …` inner Text).
  Text→Pressable conversion moves `testID`/`onPress`/`accessibilityRole="button"`/`accessibilityState={{selected}}`
  to the Pressable; all testIDs unchanged; selected state exposed.
- Weight `weight-unit-toggle` gains `min-h-[44px] justify-center`; nothing else on the screen changed.
- `touch-targets.test.tsx` fires `fireEvent.press` and asserts `onChange` called with the right arg for
  both chip families, plus `min-h-[44px]` + `accessibilityState.selected`. `weight-screen.test.tsx` adds
  the toggle assertion.

## 6. Snapshot — PASS
`pet-home-snapshot.test.tsx.snap` delta is EXACTLY one inserted line `testID="home-gradient-overlay"`
on the overlay Animated view. This is the plan-mandated testID surfacing through the shared
`AnimatedGradientBackground` (used by the pet-home screen); with the mock default `useReducedMotion()===false`
the overlay still renders, so the only change is the new testID prop — a legitimate render change, not a
behavior change. No other snapshot lines moved.

## 7. Safety §7/§5 — PASS
Zero changes under check-flow / emergency / disclaimer / paywall / auth / onboarding surfaces (none appear
in porcelain). No copy changes: no new user-facing strings introduced; `SectionHeader` consumes the existing
`strings.home.quickActionsTitle`; `strings.ts` untouched. `<VetDisclaimer/>`, Emergency interstitial, and all
dosing-prohibition copy are out of scope and untouched.

## 8. Hygiene — PASS
No new deps (package.json + lockfile unchanged). No `console.*`, no unjustified `any`/`@ts-ignore`, no
`eslint-disable`, no unreferenced TODO. Every jest render/press is `await`ed (ledger respected). No
`.env`/protected files touched (CLAUDE.md, LOOP_PROTOCOL.md, PHASES.md, secrets all untouched).

## Verdict rationale
No file outside plan scope; every `brand-*` class resolves; all five animation sites gated with
content-visible reduced-mode tests; no dropped testID; the token-test pair is pinned by the config spec;
no safety-surface diff. Independent mobile (703) and config (13) suites are green.

VERDICT: PASS
- Scope clean (29/29 on plan list; "touch ONLY if" files untouched).
- AC1–AC5 each verified literally against code + non-vacuous tests.
- Snapshot delta is the single mandated testID line; safety surfaces untouched.
- Minor, non-blocking note: the executor's stated AC1 mutation-proof named the wrong test
  (config spec, not primary-button-disabled, is the real pin); the contract is nonetheless correctly pinned.
