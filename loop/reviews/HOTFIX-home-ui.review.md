# CHECKER review — HOTFIX-home-ui (founder-directed home UI overhaul)

Scope: uncommitted working tree. Files changed (git status confirms nothing else):
- Modified: `apps/mobile/app/(tabs)/_layout.tsx`, `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/jest.setup.ts`, `apps/mobile/package.json`, `apps/mobile/src/strings.ts`, `pnpm-lock.yaml`
- New (untracked): `apps/mobile/__tests__/home-screen.test.tsx`, `apps/mobile/src/components/home/{animated-gradient-background,empty-home-state,greeting,home-header,pet-hero-card,quick-actions-grid,today-preview-card}.tsx`

All changes confined to `apps/mobile` (+ lockfile). No code written outside the plan's file set. No touch to CLAUDE.md / LOOP_PROTOCOL.md / PHASES.md / secrets / .env.

## Gates re-run (independent)
- `pnpm typecheck` — PASS (16/16, FULL TURBO).
- `pnpm lint` — PASS. Only warning is the pre-existing api `coverage/lcov-report/block-navigation.js` unused-disable, unrelated to this change.
- Fresh `npx eslint` (cache-bypassed) on every changed mobile file incl. new home components + test — exit 0, clean. Confirms turbo cache-hit was legitimate.
- `pnpm --filter @pawcareright/mobile test` — PASS: **86 suites / 609 tests / 17 snapshots**. Matches ORCHESTRATOR claim (85/596 → 86/609; +1 suite, +13 tests = the 13 `it(` in home-screen.test.tsx). The "worker failed to exit gracefully" line is the repo's pre-existing benign teardown notice, not a failure.
- `pnpm build` — PASS (9/9).
- ai-evals not run: `packages/ai` untouched (correctly out of scope).

## Adversarial probes

**1. Regression sweep**
- `pet-switcher.test.tsx` untouched (only untracked new test added; `git diff -- '*.test.*'` shows NO removed `it(`/`describe(`/`test(`). It passes inside the full run. `PetSwitcher` source unmodified; its `testID="pet-switcher"` intact and asserted by the new multi-pet test.
- Old testIDs preserved on NEW elements: `home-open-active-pet` now on `PetHeroCard` (pet-hero-card.tsx:38); `home-add-pet-cta` now on `EmptyHomeState` (empty-home-state.tsx:22). C2 checklist references intact.
- check quick-action param shape: home pushes `{ pathname: "/check", params: { petId: pet.id } }`; `app/check/index.tsx:30` reads `useLocalSearchParams<{ petId?: string }>()` → key `petId` matches. Pet context is NOT lost.
- weight/note/vet-visit routes exist as `app/weight/[petId].tsx`, `app/note/[petId].tsx`, `app/vet-visit/[petId].tsx`; pathnames `/weight/[petId]` etc. match.
- Settings gear pushes `/settings` → real tab route `app/(tabs)/settings.tsx`. Correct.
- `useActivePet` genuinely returns `pets` (use-active-pet.ts:9,40) — the `pets.length > 1` PetSwitcher gate is real.

**2. Expo Go safety (crash history)**
- Read `animated-gradient-background.tsx` line-by-line: exactly ONE `useSharedValue` + `withRepeat(withTiming(...), -1, true)` crossfade loop driven in a `useEffect`; `useAnimatedStyle` maps opacity. NO `setInterval`/`requestAnimationFrame`/per-frame JS. Battery-friendly as claimed.
- No module-level native calls anywhere in the new components — all native usage (Ionicons render, LinearGradient render, reanimated hooks/effects) is at component render/effect scope.
- reanimated usage (`useSharedValue`/`useAnimatedStyle`/`withRepeat`/`withTiming`, `FadeInDown` entering) is idiomatic and Expo-Go-compatible; expo-linear-gradient + @expo/vector-icons + reanimated are all Expo-Go-bundled.

**3. §6 mobile standards**
- NativeWind classes throughout; inline `style` only where justified: `StyleSheet.absoluteFill` for LinearGradient fill layering + the dynamic `overlayStyle` on `Animated.View`, and the tab-bar `tabBarLabelStyle` (navigation option, not a styleable component). Raw hex is passed to icon `color`/gradient `colors` props (not style objects) — acceptable.
- Strings all externalized to `strings.home.*` / reused `strings.petHome.*` / `strings.addPet.*`; no literal user-facing strings in components.
- Safe-area: `index.tsx` wraps content in `SafeAreaView`; gradient sits behind via `absoluteFill` + `pointerEvents="none"`.
- Today preview handles loading (`home-today-loading`), error (`home-today-error` + retry), empty (`home-today-empty`), and offline: `isOffline && !data` → `home-today-offline` + retry; `isOffline` with cached data → `home-today-offline-banner`. Offline renders sensibly and is test-covered.
- Icon-only pressable (`home-settings-button`) has `accessibilityLabel`; other pressables carry visible Text + `accessibilityRole="button"`.
- §1a: display name rendered only via `AppTitle` → `APP_DISPLAY_NAME` from `@pawcareright/config`; no hardcoded product name in home components.

**4. §7 safety content**
- New `home.*` strings scanned: no `diagnos*`/`dose`/`dosage`/`advice`. Symptom-check tile label is neutral ("Symptom check", `medkit-outline`) and routes to the existing `/check` entry screen — no AI output/disclaimer/emergency surface touched. No urgency/fear copy. `todayError` is calm ("We couldn't load today's agenda.").

**5. Jest mock integrity**
- Hand-rolled reanimated mock covers exactly the used subset: `default.View`, `FadeInDown` chainable `.delay()/.duration()`, `Easing.{inOut,ease,linear}`, `useSharedValue`, `useAnimatedStyle`, `withRepeat`, `withTiming`. Cross-checked against actual component API usage — nothing used is left unmocked, nothing extraneous mocked. The usage is trivial/idiomatic (no `"worklet"` directives, no runOnJS/runOnUI, no gesture handlers), so the synchronous stand-in cannot mask a worklet-misuse crash class that the real runtime would reject — honest low-risk assessment. Rationale for not using `react-native-reanimated/mock` (its worklets native-bridge `require` throws here) is documented and credible.
- New setup-level mocks only add `react-native-reanimated` + `expo-linear-gradient` jest.mocks; they do not alter existing mocks. T067/T080 and all other suites run under the same setup and remain green (full 86/86 pass), so those gate/render-count probes are unaffected.

**6. Greeting hour logic**
- `greetingKeyForHour`: morning 05:00–11:59, afternoon 12:00–17:59, evening otherwise — sane, correct boundaries. Exercised via fake-timers at 08/14/20 in home-screen tests. (Minor: the exact cutover hours 5/12/18 aren't asserted directly — non-blocking, logic is a pure obvious branch.)

**7. Deps (§2r7)**
- Exactly two additions in `package.json`: `@expo/vector-icons ^15.1.1`, `expo-linear-gradient ~57.0.1` (Expo SDK 57-pinned, consistent with sibling `expo-*` ~57 ranges). Lockfile adds matching resolutions.

**8. Suite math** — confirmed 86/609, no test deleted.

## Non-blocking observations
1. `pnpm-lock.yaml` has incidental churn: `jiti` resolution swapped between `apps/mobile` (now 1.21.7) and root/`packages/data` (now 2.7.0), plus cosmetic `jest@29.7.0(@types/node@22.20.1)` qualifier rewrites and an `expo-router` hash change. Internally consistent — the tree installed from it and every gate passed. Cosmetic re-resolution, not a correctness issue.
2. `greeting.ts` boundary hours not directly unit-tested (covered functionally via the component).
3. Quick-action tiles and the empty-state paw icon use raw brand hex (`#1f6350`, `#2f8f74`) rather than a shared color constant; passed as color props (not §6 style objects), documented as matching the tailwind preset. Acceptable minor.
4. No Android `elevation` alongside iOS `shadow-md` — accepted minor, as noted.

## Founder-facing notes
- Tab bar now shows real Ionicons (home / paw / time / settings, filled when active) tinted brand green `#1f6350`; no more placeholder boxes.
- Home is a modern scrollable screen: animated soft brand gradient background (slow ~10s crossfade, one loop — subtle, battery-friendly), greeting header with settings gear, a pressable pet hero card (colored-initial avatar since no photo resolver exists yet), a 2×2 quick-actions grid with a staggered fade-in (Symptom check / Log weight / Log note / Vet visit — disabled until a pet exists), a "Today" agenda preview (up to 3 items, See-all → Care tab), and a friendly empty state when no pet is added.
- Expo Go: fully compatible — all three new native-ish modules are bundled in Expo Go and there are no module-level native calls, so the earlier crash class does not recur.

VERDICT: PASS
