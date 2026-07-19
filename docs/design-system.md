# Paw Care Right + — Mobile Design System Brief

> **Audience:** planner/executor/checker agents doing UI work in `apps/mobile`.
> **Status:** opinionated, binding for every screen sweep. Where this file names a class or token, use exactly that class or token. Safety rules in `docs/PRODUCT_SPEC.md §5` and CLAUDE.md §7 always win (e.g. `<VetDisclaimer/>`, Emergency interstitial ordering).
>
> Grounded in the existing founder UI pass (`apps/mobile/src/components/home/*`, `primary-button.tsx`, brand scale in `packages/config/tailwind-preset.mjs`) and 2025–2026 platform guidance: Material 3 Expressive (springs, emphasized type, shape-as-branding — [m3.material.io/blog/building-with-m3-expressive](https://m3.material.io/blog/building-with-m3-expressive)) and iOS 26 "Liquid Glass" HIG (glass/translucency belongs to the floating *navigation* layer only, never the content layer; content stays calm cards + lists — [learnui.design/blog/ios-design-guidelines-templates.html](https://www.learnui.design/blog/ios-design-guidelines-templates.html), [apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)). Our translation: soft light-gradient background + white cards + one confident brand green, generous radius, restrained one-shot motion. No literal glassmorphism/blur (perf + contrast risk on Android); the light gradient IS our "depth" layer.

---

## §1 Design tokens

### 1.1 Brand palette + REQUIRED scale extension

`packages/config/tailwind-preset.mjs` currently defines `brand-{50,100,500,700,900}`. **Known defect:** `primary-button.tsx` uses `bg-brand-300` for the disabled state, which does not exist in the preset — Tailwind silently drops it and the disabled button renders transparent. The first UI task must extend the preset (this is a `packages/config` change, allowed) to:

```js
brand: {
  50:  "#f2f8f6",  // page tint / gradient start
  100: "#dcece6",  // gradient end, chip borders, tile tint
  200: "#bcdcd2",  // dividers, skeleton bone
  300: "#8fc4b3",  // disabled fills, decorative icons
  500: "#2f8f74",  // decorative/large icons, progress, NEVER small text
  600: "#27795f",  // pressed state of brand-700 fills
  700: "#1f6350",  // PRIMARY action fill, link/label text
  900: "#123a30",  // headings + body text
}
```

**Contrast pairings — computed with the WCAG relative-luminance formula against our actual hexes; treat as verified, do not re-derive per screen** (WCAG 2.2 AA: 4.5:1 normal text, 3:1 large text/UI components — [w3.org/WAI/WCAG22/Understanding/target-size-minimum.html](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)):

| Pair | Ratio | Verdict |
|---|---|---|
| `text-brand-900` on white / brand-50 / brand-100 | 12.55 / 11.67 / 10.27 | AAA — default body+heading text everywhere |
| `text-brand-700` on white / brand-50 / brand-100 | 7.10 / 6.60 / 5.81 | AA(A) — subtitles, links, selected labels |
| white text on `bg-brand-700` | 7.10 | AA(A) — the button pair |
| white text on `bg-brand-600` (pressed) | 5.27 | AA — pressed state stays legible |
| `text-brand-500` on white | **3.96** | **FAILS AA for normal text.** brand-500 is icons ≥24px, large display text (≥19px bold), charts only |
| white on `bg-brand-500` | **3.96** | **Never** a button fill with normal-size text |
| `text-red-600` (#dc2626) on white / brand-50 | 4.83 / 4.49* | error text on white OK; on brand-50 use `text-red-700` |

Rules: body/headings `text-brand-900`; secondary line `text-brand-700` (as `pet-hero-card.tsx` already does). Never place normal-size `brand-500` text on any background. Never use gray-on-gray (`text-gray-400` etc.) for information — muted copy is `text-brand-700`. Text over the animated gradient is safe because all gradient stops (`#f2f8f6/#ffffff/#dcece6/#fdf8ef`) are ≥ brand-50 lightness — the table's brand-50/100 columns are the worst case, both pass. Tinted/gradient backgrounds must never get lighter text than these pairs; if a future darker gradient is proposed, re-run the contrast math first.

#### 1.1a Dark-mode semantic tokens (PAWSAATHI-1 plan)

`packages/config/tailwind-preset.mjs` additionally defines a **dark** semantic palette, wired via NativeWind `darkMode: "media"` (system/Appearance-driven; no in-app toggle yet). These are additive: every existing light class stays exactly as documented above, and every canon component appends the matching `dark:` class from this table — never a new bespoke dark color.

```js
surface: { "page-dark": "#0c140f", "card-dark": "#16241F", "raised-dark": "#143026" },
ink:     { dark: "#E7E0D3", "muted-dark": "#9AA8A1", "faint-dark": "#6E827A" },
accent:  { DEFAULT: "#1f6350", dark: "#1E6B54", bright: "#2EA57C", warm: "#FF7A59" },
category:{ lilac: "#8B7BD8", amber: "#F6A623", sky: "#4C9BD6" },
hairline:{ dark: "#22392F" },
```

**Dark-mode contrast pairings** (same WCAG relative-luminance formula, same 4.5:1 normal-text / 3:1 large-text-or-UI floors; verified by `apps/mobile/__tests__/dual-theme-contrast.test.ts`):

| Pair | Ratio | Verdict |
|---|---|---|
| `text-ink-dark` on `bg-surface-page-dark` / `-card-dark` / `-raised-dark` | 14.25 / 12.25 / 10.81 | AAA — default dark body+heading text everywhere |
| `text-ink-muted-dark` on `-card-dark` / `-page-dark` | 6.50 / 7.56 | AA — dark secondary/meta text |
| white on `bg-accent-dark` | 6.39 | AA — the dark-mode primary-button fill |
| `text-accent-bright` label/border on `-card-dark` | 5.20 | AA (also clears the 3:1 UI floor) — links, secondary-button label/border |
| `text-red-700` (light-mode error text) on any dark surface | **~2.2–2.9** | **FAILS AA in dark mode.** `text-field.tsx`'s error text is `text-red-700 dark:text-red-400` — `text-red-400` (#f87171) measures 5.13–6.76 against page-dark/card-dark/raised-dark, so it's the dark-mode error color; light mode keeps `text-red-700` byte-identical |

Rules: dark surfaces are `surface.page-dark` (page bg) → `surface.card-dark` (cards) → `surface.raised-dark` (tiles/pressed/skeleton bones) — same visual hierarchy as light `brand-50 → white → brand-100`. `accent.dark`/`accent.bright` replace `brand-700` as the dark-mode action fill/label pair. `category.*` (lilac/amber/sky) are reserved decorative/large-only accents (mirrors the brand-500 rule) — not yet wired to any component this batch. Any NEW dark pairing gets its own math in `dual-theme-contrast.test.ts` before use, same as light-mode §1.1.

### 1.2 Spacing scale (Tailwind units, 4pt grid)

Only these: `gap-1` (4) fine, `gap-2` (8) intra-component, `gap-3` (12) between grid tiles/chips, `gap-4` (16) between cards & card padding, `gap-6` (24) between sections, `px-4` screen gutter (16), `py-5`/`py-6` hero paddings. Screen root is always `px-4` (existing screens use `px-6` for centered states — that stays for full-screen status states only).

### 1.3 Radius scale

- `rounded-full` — chips, avatars, pills, steppers.
- `rounded-2xl` (16) — cards, tiles, sheets (top corners), hero surfaces. This is the house radius (matches `pet-hero-card`, `quick-actions-grid`).
- `rounded-lg` (8) — buttons, inputs, small inline surfaces.
- Nothing squarer than `rounded-lg` on a visible surface. (M3 Expressive: shape is brand — pick a family and hold it: [m3.material.io/blog/building-with-m3-expressive](https://m3.material.io/blog/building-with-m3-expressive).)

### 1.4 Type scale (NativeWind class → RN font size)

| Role | Class | Size/weight |
|---|---|---|
| Display (greeting, paywall headline) | `text-3xl font-bold text-brand-900` | 30 |
| Screen title | `text-2xl font-bold text-brand-900` | 24 |
| Section header | `text-lg font-semibold text-brand-900` | 18 |
| Card title / list primary | `text-base font-semibold text-brand-900` | 16 |
| Body | `text-base text-brand-900` | 16 |
| Secondary / meta | `text-sm text-brand-700` | 14 |
| Caption / chip label | `text-sm` or `text-xs` (12) — `text-xs` never for essential info | 12–14 |

Max two weights per surface (regular + semibold/bold). Emphasis = weight or brand-700 color, never a third size.

#### 1.4a Font-family tokens (PAWSAATHI-1 plan)

`packages/config/tailwind-preset.mjs` also defines weight-keyed `fontFamily` tokens, backing the Bricolage Grotesque (display) / Plus Jakarta Sans (body) faces loaded non-blocking by `apps/mobile/src/fonts/use-app-fonts.ts` (`@expo-google-fonts/bricolage-grotesque` + `@expo-google-fonts/plus-jakarta-sans`, via `expo-font`'s `useFonts`):

```js
fontFamily: {
  display: ["BricolageGrotesque_700Bold"],
  "display-semibold": ["BricolageGrotesque_600SemiBold"],
  body: ["PlusJakartaSans_400Regular"],
  "body-semibold": ["PlusJakartaSans_600SemiBold"],
  "body-bold": ["PlusJakartaSans_700Bold"],
}
```

Why weight-keyed rather than a single `font-display`/`font-body` pair: RN pins the weight of a NAMED static font family — once a `className` names `fontFamily: BricolageGrotesque_700Bold`, the sibling `font-bold`/`font-semibold` Tailwind classes are ignored on native (they only affect the *default* system font). So each existing text weight gets its own token: `font-display` (Bricolage Bold) for greetings/screen titles/hero names, `font-display-semibold` (Bricolage SemiBold) for section headers, `font-body` (Jakarta Regular) for body/secondary copy, `font-body-semibold`/`font-body-bold` (Jakarta SemiBold/Bold) for labels, buttons, and card titles. Apply the token whose weight matches the Text's EXISTING `font-bold`/`font-semibold` class — never swap a component's visual weight as part of this token adoption. Font loading is non-blocking and best-effort: while pending or on failure, text falls back to the OS system font at the same size/weight class (never a blocked or blank screen) — see `use-app-fonts.ts` and `fonts-nonblocking.test.tsx`.

### 1.5 Elevation (always both platforms together)

- **e0** flat tinted: `bg-brand-50` (quick-action tiles).
- **e1** card: `bg-white shadow-md` — NativeWind `shadow-md` emits iOS shadow* props AND Android `elevation`; this is the only shadow class in the app (already the `pet-hero-card` pattern). Add `shadow-brand-900/10` tint if plain black reads harsh.
- **e2** sheet/overlay: `bg-white shadow-lg` + scrim `bg-black/40`.
- Never iOS-only `shadowColor` style objects; never `elevation:` alone.

### 1.6 Dark mode

**Real as of PAWSAATHI-1**: `apps/mobile/tailwind.config.js` sets `darkMode: "media"` — NativeWind resolves every `dark:` class from the OS Appearance/color-scheme setting; there is no in-app theme toggle yet (a future settings switch would need `darkMode: "class"` + a stored preference, deferred). The strategy is **additive-only**: every canon component keeps its existing light-mode class verbatim and appends the matching `dark:` class from §1.1a's semantic table — light-mode rendering is byte-identical to before this batch (no existing light-mode snapshot pixel/class changes).

Rules:
- Only use tokens from §1.1a (`surface.*-dark`, `ink.*`, `accent.dark`/`accent.bright`, `hairline.dark`) — never a bespoke dark hex. New pairing → new math in `dual-theme-contrast.test.ts` first (mirrors the light-mode §1.1 rule).
- `Ionicons`/other native-icon `color` props do NOT respond to `dark:` classes (they're not CSS) — compute the color from `useColorScheme()` at the call site (light `#1f6350` → dark `#2EA57C`, or `#ffffff` where the light icon was already white-on-fill). Every icon-bearing canon/home component in this batch does this.
- The home-tab `AnimatedGradientBackground` swaps its entire `colors` array (not just a shade) via `useColorScheme()` — `expo-linear-gradient` is linear-only, so the dark stops are a top-down approximation of a dark radial glow, built from the same `surface.*-dark` tokens so any text drawn directly over it (e.g. `HomeHeader`'s greeting) stays inside the AA-verified ink-dark pairs. This is the one place a scheme flip changes an actual RUNTIME value rather than a static class string (see `home-gradient-scheme.test.tsx`) — under this workspace's jest+NativeWind setup, `className` is a literal, un-resolved prop, so `dark:` class presence is verified by content (`dual-theme-tokens.test.tsx`), not runtime color diffing.
- Never hardcode `#ffffff`/`#123a30` (or any raw hex) in a new style object when a class exists; keep colors as brand/semantic classes so future dark-mode/theming work stays mechanical.

---

## §2 Component canon

Everything below lives in `apps/mobile/src/components/` (kebab-case files, PascalCase exports). Screens compose these; screens do not re-invent them. All user-facing strings via `src/strings.ts`.

### 2.1 `ScreenScaffold`

The one wrapper every tab/stack screen uses:

```tsx
<SafeAreaView edges={["top"]} className="flex-1 bg-brand-50">
  {/* home only: <AnimatedGradientBackground/> absolutely-filled behind */}
  <ScrollView contentContainerClassName="gap-6 px-4 pb-8"
    refreshControl={<RefreshControl tintColor="#1f6350" refreshing={...} onRefresh={...}/>}>
    <View className="gap-1">
      <Text className="text-2xl font-bold text-brand-900">{title}</Text>
      {subtitle && <Text className="text-sm text-brand-700">{subtitle}</Text>}
    </View>
    {children}
  </ScrollView>
</SafeAreaView>
```

Rules: default page bg is `bg-brand-50` (not stark white — the gradient family), pull-to-refresh on every server-backed list screen (expected by default in 2026 consumer apps), keyboard avoidance (`KeyboardAvoidingView`, iOS `padding`) on any screen with inputs. The animated gradient stays a **home-tab signature**; other tabs get the calm solid `bg-brand-50` so home reads special.

### 2.2 `Card`

`<View className="rounded-2xl bg-white p-4 shadow-md gap-2">`. Pressable cards wrap in `Pressable` with `accessibilityRole="button"`, pressed feedback per §3. One card = one job; no card-inside-card.

### 2.3 `SectionHeader`

`<View className="flex-row items-center justify-between"><Text className="text-lg font-semibold text-brand-900">{title}</Text>{action && <Text className="text-sm font-semibold text-brand-700">{actionLabel}</Text>}</View>` — the "See all" text is a `Pressable` with `hitSlop` to reach 44pt (§4).

### 2.4 `IconTile`

Canonize `quick-actions-grid.tsx`'s tile: `items-center gap-2 rounded-2xl bg-brand-50 px-4 py-5` on white cards, `bg-white shadow-md` variant when sitting directly on the page tint. Icon `Ionicons size={26} color="#1f6350"`, label `text-sm font-semibold text-brand-900 text-center`. Disabled: append `opacity-40` + `accessibilityState={{disabled:true}}` (existing pattern — keep).

### 2.5 `Chip`

Extract from `pet-filter-chips.tsx` constants and reuse verbatim, but wrap in `Pressable` (not bare `Text onPress`) so hitSlop/minHeight can guarantee 44pt (§4 — current `py-2` text chips are ~33pt tall, too short):

- selected: `rounded-full bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white`
- unselected: `rounded-full border border-brand-100 bg-white px-4 py-2.5 text-sm text-brand-900`
- `accessibilityRole="button"` + `accessibilityState={{selected}}`. Horizontal chip rows: `ScrollView horizontal showsHorizontalScrollIndicator={false}` with `gap-2`.

### 2.6 `ListRow`

`flex-row items-center gap-3 py-3 min-h-[56px]`: optional leading icon in a `h-10 w-10 rounded-full bg-brand-100 items-center justify-center` circle, middle `flex-1` (title `text-base font-semibold text-brand-900`, sub `text-sm text-brand-700`), trailing chevron `chevron-forward-outline size 20 #1f6350` or action. Divider `border-b border-brand-100` inside cards; no dividers between cards.

### 2.7 `EmptyState`

Canonize `empty-home-state.tsx`: centered `rounded-2xl bg-white px-6 py-10 gap-4` with a brand-500 Ionicon (48–64), one-line title (`text-xl font-semibold`), one supportive sentence (`text-base text-brand-700 text-center`), and exactly one CTA that creates the missing thing. Empty states teach-by-inviting, never a bare "No data" ([designstudiouiux.com/blog/mobile-app-onboarding-best-practices](https://www.designstudiouiux.com/blog/mobile-app-onboarding-best-practices/)). Every list screen ships loading + error + empty + offline variants (CLAUDE §6 already mandates it; EmptyState is the empty variant).

### 2.8 `TextField`

Label above, input, error below — one component:

```tsx
<View className="gap-1.5">
  <Text nativeID={labelId} className="text-sm font-semibold text-brand-900">{label}</Text>
  <TextInput accessibilityLabelledBy={labelId} // Android; iOS: accessibilityLabel={label}
    className={hasError
      ? "rounded-lg border border-red-600 bg-white px-4 py-3 text-base text-brand-900"
      : "rounded-lg border border-brand-100 bg-white px-4 py-3 text-base text-brand-900"}
    placeholderTextColor="#2f8f74" />
  {hasError && <Text accessibilityRole="alert" className="text-sm text-red-700">{error}</Text>}
</View>
```

`accessibilityRole="alert"` makes screen readers announce the error when it appears (RN maps it to live-region/alert semantics). Errors are inline per-field, appear on blur/submit (not per keystroke), and the first errored field receives focus on failed submit.

### 2.9 Buttons

`PrimaryButton` stays the primary (`bg-brand-700`, disabled `bg-brand-300` — real once §1.1 lands, loading = inline `ActivityIndicator` replacing the label, width unchanged). Add two siblings, same file conventions:

- **SecondaryButton:** `rounded-lg border border-brand-700 bg-white px-6 py-3`, label `text-base font-semibold text-brand-700`; pressed `bg-brand-50`.
- **GhostButton:** no border, `px-4 py-3`, label `text-base font-semibold text-brand-700`; pressed `opacity-70`. For "Skip", "Not now", tertiary row actions.

All three: `accessibilityRole="button"`, `accessibilityState={{disabled}}`, min height 44pt (`py-3` + `text-base` ≈ 48pt — compliant), pressed feedback per §3.2. One primary button per screen region.

### 2.10 Sheets & modals

- **Bottom sheet** = the default for contextual choices, quick forms, upsells, filters — dismissible, non-blocking tone; measurably better-tolerated than center modals ([nngroup.com/articles/bottom-sheet](https://www.nngroup.com/articles/bottom-sheet/), [digia.tech/post/bottom-sheets-vs-modals-interruption-layer](https://www.digia.tech/post/bottom-sheets-vs-modals-interruption-layer/)).
- **Center modal / full-screen route** only for must-complete or destructive-confirm moments (and safety interstitials, which are full-screen by spec).
- Implementation: we do **not** add `@gorhom/bottom-sheet` (would drag in gesture-handler; CLAUDE §2 no-new-deps). Canonize the existing `upsell-sheet.tsx` RN `Modal` approach into a shared `BottomSheet`: `Modal transparent animationType="slide"` (respects OS reduce-motion natively), scrim `Pressable bg-black/40` that dismisses, content `mt-auto rounded-t-2xl bg-white p-4 pb-8 gap-4` with a grab-handle bar `self-center h-1 w-10 rounded-full bg-brand-200`, `onRequestClose` wired (Android back). Sheets containing inputs add `KeyboardAvoidingView`.

### 2.11 `Skeleton`

Content-shaped placeholders beat spinners for perceived speed on content loads; spinners remain correct for short *action* waits (button loading) ([nngroup.com/articles/skeleton-screens](https://www.nngroup.com/articles/skeleton-screens/), [blog.logrocket.com/ux-design/skeleton-loading-screen-design](https://blog.logrocket.com/ux-design/skeleton-loading-screen-design/)). Pattern: `Skeleton` = `rounded-lg bg-brand-100` blocks in the card layout the data will occupy, with ONE shared reanimated opacity pulse (0.5↔1, ~1000ms, `withRepeat`) driving all bones on the screen — subject to §3 reduced-motion (static `bg-brand-100` when reduced). Rule of thumb: query `isLoading` on a content screen → skeleton of that screen's card layout; mutation in flight → button spinner + optimistic UI (§5.4). Replace the current full-screen `ActivityIndicator` states (e.g. `care.tsx`) during the sweep.

---

## §3 Motion rules

Motion is seasoning, not sauce. (M3 Expressive springs are the 2025 reference for "alive but purposeful": [m3.material.io/blog/building-with-m3-expressive](https://m3.material.io/blog/building-with-m3-expressive).)

### 3.1 What animates

1. **Entrances:** staggered `FadeInDown.delay(index * 80).duration(320)` for card/tile groups (existing `quick-actions-grid` pattern — the house entrance). Screens: at most one entrance group; list items beyond ~6 don't stagger.
2. **Press feedback:** every `Pressable` gives feedback — either `opacity 0.85` via style function (the sanctioned inline-style exception, per `primary-button.tsx`) or a reanimated scale to `0.97`, spring back. Pick one per component and keep it.
3. **Background:** the ONE-loop rule — at most one repeating animation per screen, driven by a single shared value (the home `AnimatedGradientBackground` crossfade is the only sanctioned loop today; the skeleton pulse counts as the screen's one loop while loading). Never add a second `withRepeat` to a screen.
4. **Sheets:** OS-provided slide (`animationType="slide"`), nothing custom.

Durations/easings: one-shot UI motion 150–350ms; use `Easing.out(Easing.quad)` for entrances, `Easing.inOut(Easing.ease)` for crossfades. Nothing user-blocking ever waits on an animation.

### 3.2 Reduced-motion contract (hard requirement)

Every animation in the app is gated by reanimated's `useReducedMotion()` — it reads the OS "Reduce Motion" setting synchronously (backed by `AccessibilityInfo.isReduceMotionEnabled`; value is read at app start and doesn't live-update, which is acceptable) ([docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion](https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion/), [docs.swmansion.com/react-native-reanimated/docs/guides/accessibility](https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/)):

```tsx
// src/hooks/use-reduced-motion.ts — the single import point for ALL motion gating
import { useReducedMotion as useReanimatedReducedMotion } from "react-native-reanimated";
export function useReducedMotion(): boolean {
  return useReanimatedReducedMotion();
}
```

Contract: `reduced === true` ⇒ no `entering` props (content just appears), the gradient overlay loop never starts (static base gradient), skeleton pulse is static, press feedback stays (it's state, not motion). Additionally mount `<ReducedMotionConfig mode={ReduceMotion.System}/>` once in the root layout as a belt-and-braces default for any animation an author forgets to gate ([docs.swmansion.com/react-native-reanimated/docs/device/ReducedMotionConfig](https://docs.swmansion.com/react-native-reanimated/docs/device/ReducedMotionConfig/)). CHECKER rejects any new `withRepeat`/`entering` not reachable from the hook.

### 3.3 Haptics

Add `expo-haptics` (Expo SDK module, actively maintained — journal the one-line justification per CLAUDE §2.7). Use sparingly and semantically ([saropa.com/articles/2025-guide-to-haptics-enhancing-mobile-ux-with-tactile-feedback](https://saropa.com/articles/2025-guide-to-haptics-enhancing-mobile-ux-with-tactile-feedback/)): `impactAsync(Light)` on log-save and chip-select in the tap-first logger (§5), `notificationAsync(Success)` on purchase/restore success, `notificationAsync(Error)` on destructive-confirm. Never on plain navigation, never in loops, always alongside a visual cue, all through one `src/haptics.ts` wrapper so a future settings toggle is one change.

---

## §4 Accessibility contract

WCAG 2.2 AA is the floor; platform targets are the goal ([w3.org/WAI/WCAG22/Understanding/target-size-minimum.html](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)).

1. **Touch targets:** every interactive element ≥44×44pt effective (Apple HIG 44pt; Material 48dp; WCAG 2.5.8's 24px is a legal floor, not our bar). Small visuals (chevrons, "See all", close X, stepper +/−) get `hitSlop` to reach it. Chips/rows enforce `min-h-[44px]`/`min-h-[56px]`.
2. **Labels:** every icon-only control has `accessibilityLabel` from `strings.ts` (e.g. close buttons, photo pickers, stepper buttons: "Increase amount"). Decorative icons inside labeled Pressables need nothing extra (the Pressable's role+label covers them). Images of pets: `accessibilityLabel={pet.name}`.
3. **Roles & states:** `accessibilityRole="button"` on all Pressables (house norm already), `"header"` on screen/section titles, `"alert"` on error/offline banners, `accessibilityState` for `disabled`/`selected`/`checked` wherever visually indicated. Group card content so a card reads as one element where it acts as one button (`accessible={true}` on the Pressable).
4. **Focus order:** DOM order = reading order; render title → content → actions. After failed submit, move focus to first error (`AccessibilityInfo.setAccessibilityFocus` via a ref) and rely on the `alert` role for announcement (§2.8).
5. **Font scaling:** never `allowFontScaling={false}`. Body/labels scale freely; display/heading text and text inside fixed chrome (tab bar, chips, buttons) set `maxFontSizeMultiplier={1.5}` (never below 1.2) so layouts survive without breaking. No fixed heights on text containers — min-heights + flex only ([ignitecookbook.com/docs/recipes/AccessibilityFontSizes](https://ignitecookbook.com/docs/recipes/AccessibilityFontSizes/), [reactnative.dev/docs/text](https://reactnative.dev/docs/text)).
6. **Contrast:** only pairs from §1.1's table. New color = new math first.
7. **Reduced motion:** §3.2 is part of this contract.

---

## §5 Tap-first activity logging spec

Best-in-class trackers (Huckleberry, Baby Tracker) prove the pattern: logging a routine event is a tap on a category, an optional quantity nudge, and done — no typing, one hand, in-the-moment ([play.google.com/store/apps/details?id=com.nighp.babytracker_android](https://play.google.com/store/apps/details?id=com.nighp.babytracker_android), [babytrackpro.com](https://babytrackpro.com/)).

### 5.1 Interaction contract: **save in ≤2 taps**

1. **Tap 1 — activity chip grid:** a grid of `IconTile`s (Food, Water, Potty, Sleep, Walk, Play, Grooming). Tapping opens the quantity step in a `BottomSheet` (§2.10) **pre-filled with that activity's smart default** (last-used value, else the default below).
2. **Tap 2 — Save:** the sheet's `PrimaryButton` saves the pre-filled value. Adjusting quantity (stepper `−`/`+` pills, `rounded-full bg-brand-100 h-11 w-11`, value `text-2xl font-bold text-brand-900` between) or picking a segment chip is optional extra taps, never required.
3. **Recents row:** above the grid, a horizontal `Chip` row of the ~5 most recent (activity + amount) combos — e.g. "🍗 Food · 1 meal". Tapping a recent logs it **immediately (1 tap)** with `impactAsync(Light)` + a brief "Logged ✓" confirmation (and an Undo affordance in the confirmation for 5s).
4. **No free text** anywhere in this flow. An optional "Add note" GhostButton in the sheet links to the existing note form for the rare case.

### 5.2 Quantity model per activity

| Activity | Control | Units / segments | Default |
|---|---|---|---|
| Food | segmented chip `meals` \| `grams`, stepper | meals ×0.5 (0.5–5) or grams ×10 (10–1000) | 1 meal |
| Water | stepper | bowls ×0.5, or ml ×25 | 1 bowl |
| Potty | count stepper + type chips | count 1–5; chips `pee` \| `poop` \| `both`; optional `accident` toggle | 1 · pee |
| Sleep | duration stepper | ×15 min up to 2h, then ×30 min (cap 24h) | 1 h |
| Walk | duration stepper | ×5 min (5–180) | 20 min |
| Play | duration stepper | ×5 min (5–120) | 15 min |
| Grooming | type chips only | `brush` \| `bath` \| `nails` \| `teeth` \| `ears` | brush |

Units/labels come from `strings.ts`; unit enums live in `packages/types` Zod schemas so api + client share them (CLAUDE §6 shared-validation rule).

### 5.3 Time handling

Default timestamp = now. A GhostButton "Earlier…" in the sheet exposes chips (`15m ago`, `1h ago`, `this morning`) + a time picker as last resort. Never a required time field.

### 5.4 Optimistic save

Logging follows the existing agenda mutation pattern (`useCompleteOccurrence` optimistic + rollback): the entry appears in the timeline instantly, syncs in background, rolls back with a visible error toast (`accessibilityRole="alert"`) on failure. Offline: saves queue visibly ("Saved — will sync") rather than erroring — 2026 users expect logging to *always* work.

---

## §6 Per-screen consistency checklist (the sweep)

Apply to every screen in `apps/mobile/app/**`; CHECKER verifies each item:

- [ ] Uses `ScreenScaffold` (safe-area top, `bg-brand-50` page, `px-4` gutter, `gap-6` sections); home keeps its gradient, others solid.
- [ ] Header: `text-2xl font-bold text-brand-900` title (+ `role="header"`), optional `text-sm text-brand-700` subtitle.
- [ ] All four data states: **skeleton** (content-shaped, not full-screen spinner), **error** (message + Retry `PrimaryButton`), **empty** (`EmptyState` with one CTA), **offline** (banner/state with `alert` role + retry). Server-backed lists: pull-to-refresh.
- [ ] Surfaces are canon components (`Card`/`IconTile`/`Chip`/`ListRow`) — no bespoke paddings/radii/shadows; only §1 tokens (`rounded-2xl`/`rounded-lg`, `shadow-md`, spacing scale).
- [ ] Text colors only from §1.1 verified pairs; no `brand-500` normal-size text; no hardcoded hex where a brand class exists.
- [ ] Buttons: correct variant hierarchy (one primary per region), loading/disabled/pressed states, 44pt min.
- [ ] Every Pressable: role, state, label (icon-only ⇒ `accessibilityLabel`), press feedback, ≥44pt effective target (hitSlop where needed).
- [ ] Forms: `TextField` canon (label + inline `alert` error), errors announced, focus to first error, keyboard avoidance, just-in-time permissions with rationale.
- [ ] Motion: at most one entrance group (`FadeInDown` stagger), zero repeating loops (except the sanctioned home gradient / loading pulse), everything gated by `useReducedMotion()`.
- [ ] Haptics only at §3.3 moments, via `src/haptics.ts`.
- [ ] Font scaling on (`maxFontSizeMultiplier` 1.5 on chrome text only); no fixed-height text containers.
- [ ] Strings in `strings.ts`; display name via `APP_DISPLAY_NAME` only.
- [ ] Safety chrome intact where applicable: `<VetDisclaimer/>` on AI result surfaces, Emergency interstitial precedence, paywall never gating checks.
- [ ] Snapshot/component tests updated in the same commit (Definition of Done).

### Sources (key)

Material 3 Expressive: https://m3.material.io/blog/building-with-m3-expressive · iOS 26 / Liquid Glass HIG patterns: https://www.learnui.design/blog/ios-design-guidelines-templates.html and https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/ · WCAG 2.2 target size: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html · Bottom sheets: https://www.nngroup.com/articles/bottom-sheet/ and https://www.digia.tech/post/bottom-sheets-vs-modals-interruption-layer/ · Skeletons: https://www.nngroup.com/articles/skeleton-screens/ and https://blog.logrocket.com/ux-design/skeleton-loading-screen-design/ · Reduced motion: https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion/ and https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/ · Font scaling: https://ignitecookbook.com/docs/recipes/AccessibilityFontSizes/ · Haptics: https://saropa.com/articles/2025-guide-to-haptics-enhancing-mobile-ux-with-tactile-feedback/ · Onboarding/empty states: https://www.designstudiouiux.com/blog/mobile-app-onboarding-best-practices/ · Tap-first tracker patterns: https://play.google.com/store/apps/details?id=com.nighp.babytracker_android

---

## §7 Craft layer — founder-adopted rules from the `mobile-app-ui-design` skill

> Source: github.com/ceorkm/mobile-app-ui-design (SKILL.md + references/industry-conventions.md), adopted by founder directive 2026-07-18 and adapted to this stack. These rules LAYER ON TOP of §1–§6; when §7 conflicts with the safety rules (CLAUDE §7 / PRODUCT_SPEC §5) the safety rule wins, and when it conflicts with §1–§6 tokens, §1–§6 win (§7 shapes composition, not the token set).

### 7.1 Color balance — 60/30/10
Per screen: ~60% neutral surface (`bg-brand-50` page + `bg-white` cards), ~30% content ink (`text-brand-900` / `text-brand-700`), ~10% brand accent (`bg-brand-700` primaries, brand icons, selected fills). Audit: if a screen reads "green everywhere," accent has leaked past 10% — demote non-primary fills to tints (`bg-brand-100`) or white. Reserve red strictly for errors/emergency (already §1.1 law). Accent-at-5%-opacity ≈ our `bg-brand-50`/`bg-brand-100` tints for secondary emphasis.

### 7.2 Spacing — 8pt grid with relationship-based rhythm
Tailwind units already sit on the 4/8pt grid — the §7 addition is RELATIONSHIP spacing: intra-group gap `gap-2`/`gap-3`, inter-group gap ≥2× that (`gap-6`), section padding `py-6`+. No arbitrary `[NNpx]` spacing values (the sole sanctioned arbitraries: `min-h-[44px]`/`min-h-[56px]` touch floors). Card internal padding stays `p-4` (canon §2.2); dense cards may not shrink below it.

### 7.3 Typography discipline — 4 sizes / 2 weights per screen
Each screen uses at most FOUR of the §1.4 sizes and TWO weights (regular + one of semibold/bold). Hierarchy comes from size + the muted-ink pair (`text-brand-700`), never from stacking weights. Numbers that carry meaning (weight entries, quantities, counts, prices) render with `tabular-nums` (`font-variant-numeric`) so digits align; prices already come formatted from RevenueCat.

### 7.4 Thumb zone — primary action in the bottom third
Every screen whose purpose is ONE action (forms, wizards, paywall, intake steps) pins its primary button to the bottom of the viewport (safe-area-padded, above the keyboard), not mid-scroll. Secondary/tertiary actions may live in-scroll. Tab screens and browse screens are exempt (their primary action is navigation). Implementation: fixed footer slot below the ScrollView (the WizardScaffold pattern), never `position:absolute` over content.

### 7.5 Peak-End — every flow closes warm
- **Peaks:** the moment a log/save succeeds is the emotional peak of a care flow — it gets the §3.3 haptic + a visible confirmation with ONE line of encouragement (record-only tone: "Logged — nice consistency" style; NEVER outcome claims like "your pet is healthier", NEVER streak-pressure around medical acts — CLAUDE §7 wins).
- **Endings:** no flow dead-ends. After save → summary + gentle next step ("See it on the timeline"). After check result → the done/find-vet actions ARE the ending (already canon; do not add celebration to symptom results — §5 tone).
- **Negative peaks:** waiting screens get calm reassuring microcopy (already the §5 fallback tone); error states stay gentle and specific, never clinical rejection.

### 7.6 Trust & warmth (health-app conventions)
Warm approachable surfaces over clinical ones (our brand-50 warmth is the base — keep it). The `<VetDisclaimer/>` and region hotlines are TRUST SIGNALS — §7 never dilutes them (safety law). Empty states teach-by-inviting with an illustrative icon + "what you'll get" line (EmptyState canon already does this — §7 adds: the body line should preview VALUE, e.g. "Once you log a few entries, you'll see patterns").

### 7.7 Craft details
- Shadows: soft only (`shadow-md` canon), and on tinted pages shadows read neutral — never introduce harsh black `shadow-lg`+ stacks.
- Selection over input everywhere a value is enumerable (chips/steppers over TextInputs — the §5 activity + intake-descriptor patterns are the house standard).
- Search/pickers never render blank: recents or suggestions first (activity recents row is the precedent).
- Micro-feedback: every Pressable has a pressed state (§6 law); success moments may add ONE subtle scale/fade — still inside §3's one-entrance-group + reduced-motion contract. No glow/sparkle loops.
- Anti-patterns (reject in review): >4 text sizes on a screen, accent-colored full-screen backgrounds, mid-scroll primary CTAs on single-action screens, generic "No data" empties, labels visually louder than their values, random spacing values.

### 7.8 §7 sweep checklist (per screen, additive to §6)
- [ ] 60/30/10 reads true (accent ≤ ~10% of painted area)
- [ ] ≤4 text sizes, ≤2 weights; meaningful numbers `tabular-nums`
- [ ] Relationship spacing: intra-group < inter-group, no arbitrary px
- [ ] Single-action screens: primary CTA bottom-pinned (thumb zone)
- [ ] Save/success moment: haptic + one-line warm confirmation + next-step nudge (record-only tone)
- [ ] No flow dead-ends; waiting/error copy calm and specific
- [ ] Empty-state body previews value
- [ ] No §7.7 anti-patterns

### 7.9 Responsive layout — phone/tablet buckets (RESPONSIVE-1)

Mechanism is `apps/mobile/src/hooks/use-layout-bucket.ts`'s `useLayoutBucket()` (a `useWindowDimensions`-based hook), **not** NativeWind `sm:/md:/lg:` breakpoints — under this workspace's jest (NativeWind 4.2.6 + the `.css` stub), `className` stays an un-resolved literal prop, so a `md:` prefix would be inert and unverifiable in tests. A layout branch keyed on the hook instead swaps in a different, observable `className` string.

Thresholds: `compact` width < 360, `regular` 360–767, `wide` >= 768 (the classic phone<->tablet line — iPad portrait ≈768–834, landscape >=1024; large phones in landscape >=768 also qualify). This boundary is chosen so **jest's default window width (750, from `@react-native/jest-preset`'s `DeviceInfo` mock) resolves to `regular`** — every responsive change is additive-conditional (only the `wide` branch adds classes/structure; the `regular`/`compact` string is byte-identical to before this task), so every existing snapshot renders through the unchanged path and stays frozen with no re-record. A guard test (`layout-bucket.test.tsx`) pins this 750→`regular` invariant so a future threshold change can't silently churn a frozen snapshot.

Column-width rule: reading/content columns cap on the Tailwind `max-w-*` scale, never an arbitrary `[NNpx]` (keeps §7.2's law intact) — `max-w-3xl` (768) for the general `ScreenScaffold` column, `max-w-2xl` (672) for the two text-heavy reading screens (check-result, paywall), per §7.3's "~600px line-length" rule, each centered with `self-center`. Grids (category, quick-actions, activity-chip, services) widen their column count only on `wide` (more tiles per row), keeping every touch-target, testID, and motion/dark token unchanged in both branches.
