# Plan — SWEEP-1: App-wide UI modernization, batch 1 (FOUNDATION)

## Objective (from card)
Land the design-system foundation batches 2–4 will build on: fix the phantom brand-token defect in the shared Tailwind preset, add the reduced-motion contract (hook + gate every existing animation + root `ReducedMotionConfig`), create the four canon primitives (ScreenScaffold, Card, SectionHeader, Skeleton) and prove them on ONE reference screen (home tab), and fix sub-44pt touch targets (filter chips + weight-unit toggle). Tests for all of it. No safety surfaces (check flow / emergency / disclaimer / dosing) are touched.

## Safety check (PRODUCT_SPEC §5 / CLAUDE §7)
Not applicable / not weakened. Every file in scope is a non-AI, non-safety surface (home, pet-home, weight, list filter chips, generic primitives, tailwind preset, jest setup, root layout). `<VetDisclaimer/>`, the Emergency interstitial, and all dosing-prohibition copy are OUT of scope and untouched. No `SAFETY-ESCALATION`.

## Files to create/modify (exhaustive — executor may touch NOTHING else)

### Create — source
- `apps/mobile/src/hooks/use-reduced-motion.ts` — the single motion-gating hook; wraps reanimated 4.5.0's `useReducedMotion`.
- `apps/mobile/src/components/screen-scaffold.tsx` — `ScreenScaffold` primitive (§2.1).
- `apps/mobile/src/components/card.tsx` — `Card` primitive (§2.2), static + pressable variants.
- `apps/mobile/src/components/section-header.tsx` — `SectionHeader` primitive (§2.3).
- `apps/mobile/src/components/skeleton.tsx` — `Skeleton` primitive (§2.11), one gated pulse.

### Create — tests
- `packages/config/src/tailwind-preset.spec.ts` — asserts the extended brand scale (runs in the existing `packages/config` jest project: node env, `src/**/*.spec.ts`, ts-jest).
- `apps/mobile/__tests__/use-reduced-motion.test.tsx` — hook returns the reanimated value both ways.
- `apps/mobile/__tests__/reduced-motion-gating.test.tsx` — gradient + entrance components honour the hook.
- `apps/mobile/__tests__/screen-scaffold.test.tsx`
- `apps/mobile/__tests__/card.test.tsx`
- `apps/mobile/__tests__/section-header.test.tsx`
- `apps/mobile/__tests__/skeleton.test.tsx`
- `apps/mobile/__tests__/touch-targets.test.tsx` — filter-chip + PetFilterChips 44pt regressions.
- `apps/mobile/__tests__/primary-button-disabled.test.tsx` — phantom-token regression pin.

### Modify — source/config
- `packages/config/tailwind-preset.mjs` — add brand shades 200/300/600 (full scale per §1.1). ONLY the `brand` object changes.
- `apps/mobile/jest.setup.ts` — extend the hand-rolled reanimated mock: add `useReducedMotion: jest.fn(() => false)`, `ReducedMotionConfig: () => null`, `ReduceMotion: { System: "system", Always: "always", Never: "never" }`. No other mock changed.
- `apps/mobile/app/_layout.tsx` — mount `<ReducedMotionConfig mode={ReduceMotion.System} />` once inside `SafeAreaProvider` (belt-and-braces default, §3.2). New import from `react-native-reanimated`.
- `apps/mobile/src/components/home/animated-gradient-background.tsx` — gate the `withRepeat` loop + render the overlay only when not reduced; add `testID="home-gradient-overlay"` to the Animated overlay view.
- `apps/mobile/src/components/home/quick-actions-grid.tsx` — gate the `FadeInDown` entrances via the hook (`entering={reduced ? undefined : FadeInDown…}`).
- `apps/mobile/src/components/quick-actions.tsx` — same gating.
- `apps/mobile/src/components/pet-header-card.tsx` — same gating.
- `apps/mobile/app/pets/[id].tsx` — gate the CTA `FadeInDown` entrance via the hook.
- `apps/mobile/app/(tabs)/index.tsx` — REFERENCE ADOPTION: route the screen through `ScreenScaffold` (gradient variant), use `SectionHeader` for the quick-actions heading, and render `<Card testID="home-hero-skeleton"><Skeleton/></Card>` while `isLoading`. Preserve every existing testID (incl. `home-scroll` via `scrollTestID`) and all child components/order.
- `apps/mobile/src/components/pet-filter-chips.tsx` — touch-target fix: wrap each bare `Text onPress` in a `Pressable` (min-h-[44px], justify-center), moving `testID`/`onPress`/`accessibilityRole="button"`/`accessibilityState={{selected}}` to the Pressable, keeping the inner `Text` for styling. testIDs unchanged.
- `apps/mobile/src/components/timeline-filter-chips.tsx` — same touch-target fix.
- `apps/mobile/app/weight/[petId].tsx` — add `min-h-[44px] justify-center` to the existing `weight-unit-toggle` Pressable className. Nothing else on the screen changes.

### Modify — existing tests (update to keep green; scope-limited)
- `apps/mobile/__tests__/home-screen.test.tsx` — update for the ScreenScaffold/SectionHeader restructure (all existing testIDs preserved, so most assertions stand); ADD one case: with a never-resolving `apiClient.get`, `home-hero-skeleton` is present (proves Skeleton adoption).
- `apps/mobile/__tests__/weight-screen.test.tsx` — ADD one assertion: `weight-unit-toggle` className contains `min-h-[44px]`.
- `apps/mobile/__tests__/agenda-screen.test.tsx` — touch ONLY if the PetFilterChips Text→Pressable conversion breaks an existing assertion (press must still fire; expected: green unchanged).
- `apps/mobile/__tests__/timeline-screen.test.tsx` — touch ONLY if the TimelineFilterChips conversion breaks an assertion (expected: green unchanged).
- `apps/mobile/__tests__/pet-home-snapshot.test.tsx` + `apps/mobile/__tests__/__snapshots__/pet-home-snapshot.test.tsx.snap` — touch ONLY if the reduced-motion gate changes the snapshot. With the mock default `useReducedMotion() === false`, `entering` keeps its current builder value ⇒ snapshot MUST stay identical. If it changes, that is a signal of a wiring bug, not a reason to blindly re-record.
- `apps/mobile/__tests__/root-layout.test.tsx` — touch ONLY if mounting `ReducedMotionConfig` changes the tree. The mock is `() => null` ⇒ expected identical.

## Ordered steps
1. `packages/config/tailwind-preset.mjs`: replace the `brand` object with the full 8-stop scale from design-system §1.1 (add `200:"#bcdcd2"`, `300:"#8fc4b3"`, `600:"#27795f"`; keep 50/100/500/700/900 exactly). No other edits.
2. Add `packages/config/src/tailwind-preset.spec.ts`: `readFileSync` the preset (`path.join(__dirname, "../tailwind-preset.mjs")`) and assert each required `key: "#hex"` pair is present (all 8), and that 50/100/500/700/900 are unchanged. (fs-based to avoid ESM/CJS `.mjs` import friction under ts-jest — see Risks.)
3. Add `apps/mobile/src/hooks/use-reduced-motion.ts` per §3.2 (exact wrapper; single import point).
4. Extend `apps/mobile/jest.setup.ts` reanimated mock (step in Files list). Keep every existing export.
5. Gate animations (import `useReducedMotion` from `../hooks/use-reduced-motion` / correct relative path): `animated-gradient-background.tsx` (no `withRepeat` when reduced, overlay view rendered only when not reduced, `testID="home-gradient-overlay"`), `quick-actions-grid.tsx`, `quick-actions.tsx`, `pet-header-card.tsx`, `app/pets/[id].tsx` CTA — all via `entering={reduced ? undefined : …}`. Press feedback (opacity style fns) stays (it is state, not motion).
6. Mount `<ReducedMotionConfig mode={ReduceMotion.System} />` in `app/_layout.tsx` inside `SafeAreaProvider`.
7. Create the four primitives (`screen-scaffold.tsx`, `card.tsx`, `section-header.tsx`, `skeleton.tsx`) to the interfaces below. Skeleton imports the reduced-motion hook and gates its pulse.
8. Reference adoption in `app/(tabs)/index.tsx`: wrap in `<ScreenScaffold gradient scrollTestID="home-scroll">`; keep `HomeHeader`, `PetSwitcher`, `PetHeroCard`/`EmptyHomeState`, `TodayPreviewCard` as children in the same order; replace the inline quick-actions title `<Text>` with `<SectionHeader title={strings.home.quickActionsTitle} />`; render `<Card testID="home-hero-skeleton"><Skeleton lines={2}/></Card>` while `isLoading`.
9. Touch-target fixes: `pet-filter-chips.tsx` + `timeline-filter-chips.tsx` (Text→Pressable, `min-h-[44px] justify-center`, testIDs/handlers preserved); `weight/[petId].tsx` toggle className `+ min-h-[44px] justify-center`.
10. Write all new tests; update `home-screen.test.tsx` + `weight-screen.test.tsx`. Run the gate suite; only if a snapshot/root-layout test legitimately shifts, reconcile per the "touch ONLY if" notes.

## Tests to write (map to acceptance criteria)
- **AC1 (phantom token / brand scale)** → `packages/config/src/tailwind-preset.spec.ts` — asserts brand 50/100/200/300/500/600/700/900 all defined with the exact §1.1 hexes. → `apps/mobile/__tests__/primary-button-disabled.test.tsx` — a disabled `PrimaryButton` renders `className` containing `bg-brand-300` (the token is now real, not transparent). *(Planner cross-check, for the checker to re-verify: the only brand-* shades used anywhere in `apps/mobile` are {50,100,200,300,500,700,900}; adding 200/300/600 makes every usage resolve, and no `brand-400`/`brand-800` is used.)*
- **AC2 (reduced-motion hook)** → `use-reduced-motion.test.tsx` — returns `true` and `false` mirroring the mocked reanimated `useReducedMotion`.
- **AC2 (every animation gated)** → `reduced-motion-gating.test.tsx` — mocks `../src/hooks/use-reduced-motion`: (a) gradient reduced ⇒ `home-gradient-overlay` absent, base `home-gradient-background` still present; not-reduced ⇒ overlay present; (b) `quick-actions-grid` reduced ⇒ all four tiles still rendered (content visible) and the entrance wrapper's `entering` prop is `undefined`, not-reduced ⇒ defined; (c) `quick-actions` and (d) `pet-header-card` same entering-gated + content-visible checks. *(pets/[id] CTA gating: verified by checker via code inspection; existing `pet-home-screen.test.tsx` already proves the CTA renders in the default (false) mode.)*
- **AC3 (ScreenScaffold)** → `screen-scaffold.test.tsx` — renders title (`accessibilityRole="header"`) + subtitle + children; `gradient` mounts `AnimatedGradientBackground` (assert a gradient testID) and omits it when false; `scrollTestID` is applied to the ScrollView.
- **AC3 (Card)** → `card.test.tsx` — static variant renders children with canonical `rounded-2xl bg-white p-4 shadow-md`; pressable variant (`onPress`) exposes `accessibilityRole="button"` and fires `onPress`; forwards `testID`.
- **AC3 (SectionHeader)** → `section-header.test.tsx` — title has `accessibilityRole="header"`; when `actionLabel`+`onAction` given, the action is a Pressable with non-empty `hitSlop` and fires `onAction`.
- **AC3 (Skeleton)** → `skeleton.test.tsx` — renders the requested number of bones (`bg-brand-100`) in both reduced states (content-shaped placeholder always visible); reduced ⇒ no repeating pulse started (assert via the reduced branch rendering a static opacity, not the animated style).
- **AC3 (reference adoption)** → `home-screen.test.tsx` — existing suite stays green; new case asserts `home-hero-skeleton` appears while the pets query is pending.
- **AC4 (touch targets)** → `touch-targets.test.tsx` — `TimelineFilterChips` and `PetFilterChips` (rendered under a `QueryClientProvider` with `apiClient.get` mocked like `home-screen.test.tsx`) expose each `*filter-chip-*` as a Pressable whose `className` contains `min-h-[44px]`, press still calls `onChange`, and selected chip carries `accessibilityState.selected`. → `weight-screen.test.tsx` — `weight-unit-toggle` `className` contains `min-h-[44px]`.
- **AC5** → satisfied by all the above shipping in this commit.

## Commands to run to self-verify
- `pnpm --filter @pawcareright/config test`
- `pnpm --filter @pawcareright/mobile test`
- `pnpm typecheck && pnpm lint`
- `pnpm build` (config affected; mobile build is the no-op stub per its package.json)

## Interfaces/contracts (executor must match)
```ts
// apps/mobile/src/hooks/use-reduced-motion.ts
import { useReducedMotion as useReanimatedReducedMotion } from "react-native-reanimated";
export function useReducedMotion(): boolean { return useReanimatedReducedMotion(); }

// screen-scaffold.tsx
export interface ScreenScaffoldProps {
  title?: string; subtitle?: string; gradient?: boolean;
  children: ReactNode; refreshControl?: ReactElement;
  scrollTestID?: string; contentClassName?: string; // default "gap-6 px-4 pb-8"
}
// <SafeAreaView edges={["top"]} className="flex-1 bg-brand-50">, optional <AnimatedGradientBackground/>,
// <ScrollView testID={scrollTestID} contentContainerClassName={contentClassName ?? "gap-6 px-4 pb-8"} refreshControl={refreshControl}>
//   optional header: <View className="gap-1"><Text accessibilityRole="header" maxFontSizeMultiplier={1.5}
//     className="text-2xl font-bold text-brand-900">{title}</Text>{subtitle && <Text className="text-sm text-brand-700">{subtitle}</Text>}</View>
//   {children}

// card.tsx
export interface CardProps { children: ReactNode; onPress?: () => void; className?: string; testID?: string; accessibilityLabel?: string; }
// base classes: "rounded-2xl bg-white p-4 shadow-md gap-2"; pressable ⇒ Pressable accessibilityRole="button", pressed opacity 0.85 style fn.

// section-header.tsx
export interface SectionHeaderProps { title: string; actionLabel?: string; onAction?: () => void; actionTestID?: string; }
// <View className="flex-row items-center justify-between"><Text accessibilityRole="header"
//   className="text-lg font-semibold text-brand-900">{title}</Text>
//   action ⇒ <Pressable hitSlop={{top:8,bottom:8,left:8,right:8}} accessibilityRole="button" testID={actionTestID}>
//     <Text className="text-sm font-semibold text-brand-700">{actionLabel}</Text></Pressable></View>

// skeleton.tsx
export interface SkeletonProps { lines?: number; testID?: string; className?: string; } // default lines=3
// bones: Views "h-4 rounded-lg bg-brand-100" (last narrower); ONE useSharedValue+withRepeat opacity pulse (0.5↔1)
// gated by useReducedMotion() ⇒ reduced: static opacity, no withRepeat.
```
Chip class contract (both filter-chip files), preserving current colours (touch-target-only fix):
```
CONTAINER_SELECTED   = "mr-2 min-h-[44px] justify-center rounded-full bg-brand-700 px-3"
CONTAINER_UNSELECTED = "mr-2 min-h-[44px] justify-center rounded-full border border-brand-100 px-3"
TEXT_SELECTED        = "text-sm font-semibold text-white"
TEXT_UNSELECTED      = "text-sm text-brand-900"
```

## Out of scope / do NOT touch
- Check flow, emergency interstitial, `<VetDisclaimer/>`, any dosing/med copy, paywall, auth/onboarding, care/timeline/settings/family SCREENS (their filter-chip COMPONENTS are touched only for the 44pt fix; the screens are not redesigned — batch 4).
- Any primitive other than the four named (no Chip/IconTile/ListRow/TextField/BottomSheet/EmptyState extraction, no buttons split, no haptics work — later batches).
- `strings.ts`, `packages/types`, API, and any `brand-500`-as-text or colour changes beyond the preset addition.
- No new dependencies (reanimated `useReducedMotion`/`ReducedMotionConfig`/`ReduceMotion` and `AnimatedGradientBackground` already exist).
- Do not re-record snapshots unless a legitimately-changed render forces it (see "touch ONLY if" notes).
- Every jest render/press must be `await`ed (repo ledger).

## Risks & design decisions the planner made (scrutinize)
1. **Reference screen = the home tab (`app/(tabs)/index.tsx`).** Chosen because ScreenScaffold §2.1 is written around home (it owns the gradient signature) AND home is NOT in batches 2–4's queue, so this adoption is not reworked later. Home keeps `HomeHeader` (greeting/settings) as the first scroll child rather than using ScreenScaffold's `title` prop, so the greeting/settings-gear tests stay valid; screen gutter shifts `px-6 → px-4` and section gap `4 → 6` per §1.2 — intended, not a regression.
2. **ScreenScaffold prop surface** (title/subtitle/gradient/children/refreshControl/scrollTestID/contentClassName) extends beyond the literal §2.1 snippet (which shows only title/subtitle). Justification: §2.1 explicitly calls out the home-only gradient slot and pull-to-refresh, and batches 2–4 need `scrollTestID`/`refreshControl`. `title` stays optional so §2.1's header contract is honoured when used.
3. **Preset test is fs-content-based**, not an object import. Justification: `packages/config` jest is node+ts-jest (CJS, `testMatch src/**/*.spec.ts`) and the preset is a root-level ESM `.mjs`; importing it cleanly under that runner is fragile (`ERR_REQUIRE_ESM` / dynamic-import down-compile). A `readFileSync` assertion of the exact §1.1 key:hex pairs is deterministic and directly pins the scale. Semantic "every used shade resolves" is covered by the planner cross-check listed under AC1 for the checker to re-grep.
4. **Filter chips: touch-target-only fix, not full §2.5 Chip canon.** Convert bare `Text onPress` → `Pressable`(min-h-[44px]) wrapping a `Text`, preserving existing colours (kept `px-3`, no `bg-white` on unselected) and all testIDs. Full Chip extraction/restyle is deferred to batch 4; doing only the audited vertical-height fix now keeps the change minimal and low-risk. Trade-off: a second, tiny pass will restyle these when the Chip primitive is extracted.
5. **Gating strategy = per-animation `entering={reduced ? undefined : …}` + one root `ReducedMotionConfig`.** The mock defaults `useReducedMotion()` to `false` so existing snapshots/screens are byte-identical; the belt-and-braces `ReducedMotionConfig` is mocked to `() => null` so `_layout`/root-layout tests are unaffected. If any existing snapshot shifts, treat it as a wiring bug (do not re-record blindly).
6. **Skeleton pulse untestable at the millisecond level under the flattening reanimated mock**; the test asserts the reduced/branch structure and bone visibility, and the checker verifies the `withRepeat` sits behind `!reduced` by code inspection.
