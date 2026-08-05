# Accessibility audit — T093

> Audit-first sweep (plan `loop/plans/T093.plan.md`). This document is the
> step-1 evidence, committed **before** any product byte was changed. §5
> (fix list) contains exactly the rows this audit marked `GAP` that were
> also in the plan's D7 candidate allowlist; every other `GAP` row found is
> recorded in §6 as an out-of-scope finding, not silently fixed.

---

## §1 Method + exact commands run

Every grep below was actually re-run in this environment (not copied from
the plan) against `apps/mobile/app/**` and `apps/mobile/src/**`, excluding
`__tests__/**` unless noted.

```
rg -n "accessibilityRole|accessibilityLabel|accessibilityState|accessibilityHint|hitSlop|maxFontSizeMultiplier|min-h-\[|accessible=" apps/mobile/app apps/mobile/src -g '!__tests__/**'
# -> 278 matches

rg -n "withRepeat|withSpring|withTiming|entering=|FadeIn|useSharedValue|Animated\.|LayoutAnimation" apps/mobile/app apps/mobile/src -g '!__tests__/**'
# -> 14 distinct files (see §3 -- the plan's stated "11" was wrong; see §3's note)

rg -n "use-reduced-motion" <each hit file from above>
# -> all 14 import the hook (see §3)

rg -n "allowFontScaling" apps/mobile
# -> zero hits in app/src (confirmed by a11y-static-scan.test.ts's own scan, which additionally excludes node_modules/Ionicons' internal allowFontScaling={false} glyph prop, an unrelated, correct pattern -- see §7)
```

**Scope of individual file reads** (not just grep): every file in the
plan's D7 "MODIFY — product" candidate allowlist (25 files) was opened and
read in full, plus every canon component it composes (`Card`, `Chip`,
`AppHeader`, `ScreenScaffold`, `SectionHeader`, `PrimaryButton`,
`SecondaryButton`, `GhostButton`, `ListRow`) to determine "inherited —
canon" vs "GAP" per the plan's step-1 instruction ("a file that composes
only canon components inherits their a11y … marked inherited — canon").
Building the 5-flow `a11y-sweep.test.tsx` additionally required opening and
rendering `app/(auth)/welcome.tsx`, `app/(auth)/email.tsx`,
`app/(tabs)/index.tsx`, `app/check/index.tsx`, `app/activity/[petId].tsx`,
`app/reminders/edit.tsx`, `app/chat/index.tsx`, `app/check/result/
[checkId].tsx`, `app/check/emergency/[checkId].tsx` — several of these
surfaced additional, **out-of-D7-scope** gaps, recorded in §6, not fixed
(their files are not in the plan's "Files to create/modify" list).

The remainder of `apps/mobile/app/**`/`apps/mobile/src/components/**` was
**not** individually re-read this batch; it composes the same canon
components audited above (per the 278-hit grep's density — accessibility
props already appear on every screen family this repo's prior sweeps
touched: SWEEP-1…4, PAWSAATHI-1…3, FIDELITY-1…2, PREVIEW-1) and is
considered inherited-compliant unless a future audit finds otherwise.

---

## §2 Inventory table — D7 candidate files (exhaustive) + canon + spot-checked out-of-scope files

| Surface | Roles? | Labels? | ≥44pt? | maxFontSizeMultiplier? | alert on banners? | Covered by | GAP? |
|---|---|---|---|---|---|---|---|
| `src/strings.ts` | n/a (data only) | n/a | n/a | n/a | n/a | — | no (append-only target) |
| `src/components/chat/chat-bubble.tsx` | n/a (non-interactive) | n/a | n/a | n/a | n/a | `chat-theme-a11y.test.tsx` | no |
| `src/components/chat/quick-prompts.tsx` | inherited — `Chip` | inherited — `Chip` | inherited — `Chip` (`min-h-[44px]`) | inherited — `Chip` (1.5x) | n/a | `chat-screen.test.tsx` | no |
| `src/components/chat/nudge-card.tsx` | inherited — `Card` (`button`) | yes (`accessibilityLabel`) | yes (`min-h-[44px]`) | n/a | n/a | `chat-screen.test.tsx` | no |
| `src/components/chat/active-pet-badge.tsx` | n/a (read-only pill, no `onPress`) | yes | n/a | n/a | n/a | `chat-theme-a11y.test.tsx` | no |
| `app/chat/index.tsx` | inherited — `AppHeader`(title omitted here, so header role n/a); offline banner already `alert` | yes | inherited via canon buttons | n/a directly (inherited via `GhostButton`/`SecondaryButton`) | **yes already** (`chat-offline-banner`) | `chat-screen.test.tsx`, `chat-screen-snapshot.test.tsx` | no |
| `src/components/otp-input.tsx` | n/a (`TextInput`, not `Pressable`) | yes (per-cell) | yes (`h-14 w-12` = 56×48px) | n/a | n/a | `otp-input.test.tsx` | no |
| `src/components/timeline-photo-strip.tsx` | yes (`imagebutton`) | yes | yes (`h-16 w-16` = 64px) | n/a | n/a | `timeline-photo-strip.test.tsx` | no |
| `src/components/timeline-photo-viewer.tsx` | yes | yes | **no** (close button had no `min-h`/`hitSlop`) | n/a | n/a | `timeline-photo-viewer.test.tsx` | **GAP — fixed (shape 2: `hitSlop`)** |
| `src/components/intake/question-renderer.tsx` | yes on every option | n/a (visible label text) | yes (`min-h-[44px]` throughout) | n/a | n/a | `question-renderer.test.tsx` | no |
| `src/components/intake/intake-form.tsx` | **no** on the 2 review-edit links | n/a | **no** on the 2 review-edit links | n/a | n/a | `intake-form.test.tsx` | **GAP — fixed (shapes 1+2: `accessibilityRole="button"` + `hitSlop`)** |
| `src/components/species-picker.tsx` | yes | n/a (visible label) | yes (generous `px-6 py-8`, no literal class but structurally >44pt) | n/a | n/a | `add-pet-wizard.test.tsx`, `auth-onboarding-a11y.test.tsx` | no |
| `src/components/breed-autocomplete.tsx` | yes | n/a | yes (`min-h-[44px]`) | n/a | n/a (has `alert` on its own error text) | `add-pet-wizard.test.tsx` | no |
| `src/components/activity-chip-grid.tsx` | yes | yes | yes (generous `px-3 py-5` + 44px icon tile; documented in the component's own header comment) | n/a | n/a | `activity-chip-grid.test.tsx` | no |
| `src/components/activity-recents-row.tsx` | yes | yes | **no** (`px-4 py-2.5` only, no `min-h`) | n/a | n/a | `activity-recents-row.test.tsx` | **GAP — fixed (shape 2: `min-h-[44px]`)** |
| `src/components/activity-quantity-sheet.tsx` | yes on all | yes on all | **no** on `UnitChipRow` chips, `activity-sheet-written-note`, `activity-sheet-cancel` (stepper pills already `h-11 w-11` + `hitSlop`) | n/a | n/a | `activity-quantity-sheet.test.tsx` | **GAP — fixed (shape 2: `min-h-[44px]` / `hitSlop`)** |
| `src/components/schedule-builder.tsx` | **no** on freq/day `Text`-as-button; steppers had no `accessibilityLabel` | **no** on the 4 steppers (icon-only `-`/`+`) | yes (`min-h-[44px]` already on freq/day; steppers already `hitSlop`) | n/a | n/a | `schedule-builder.test.ts`, `reminder-edit.test.tsx` | **GAP — fixed (shape 1: role/state on freq/day; label+role on 4 steppers)** |
| `src/components/services/preview-banner.tsx` | n/a (`accessible`+`accessibilityLabel` on the static banner) | yes | n/a | yes (1.5x on its own label line) | n/a | `services-preview-honesty.test.tsx` | no |
| `app/services/preview-end.tsx` | **no** on the title | n/a | inherited via `SecondaryButton` | n/a | n/a | `services-preview-honesty.test.tsx` | **GAP — fixed (shape 3: `accessibilityRole="header"`)** |
| `app/services/index.tsx` | inherited — `Card` | yes | inherited — `Card` | yes (badge text 1.5x) | n/a | `services-hub.test.tsx` | no |
| `app/checks/[id].tsx` | n/a — pure `Redirect`, no UI | n/a | n/a | n/a | n/a | `check-deeplink-route.test.tsx` | no |
| `app/check/[category].tsx` | inherited via `IntakeForm` | inherited | inherited | n/a | **no** on `intake-offline-banner` | `check-submission.test.tsx` | **GAP — fixed (shape 5: `accessibilityRole="alert"`)** |
| `app/paywall.tsx` | headline had no `header` role | n/a | inherited via canon buttons | headline had **no** `maxFontSizeMultiplier` | `paywall-error-notice` had **no** `alert` | `paywall-snapshot.test.tsx`, `paywall-purchase.test.tsx` | **GAP — fixed (shapes 3+4+5)** |
| `app/(tabs)/index.tsx` | inherited — `HomeHeader`/`SectionHeader`/`Card` | inherited | inherited | inherited (`AppTitle` 1.5x) | n/a | `home-screen.test.tsx`, `sweep4-a11y.test.tsx` | no (composes only canon + `home/`-scoped components, none of which are in the D7 candidate list) |
| `app/check/result/[checkId].tsx` | **no** on the 5 section titles | n/a | inherited via canon buttons (`PrimaryButton`/`SecondaryButton`/`GhostButton`) | inherited via those same buttons | n/a (`VetDisclaimer`/emergency-notice untouched) | `check-result-snapshot.test.tsx`, `check-flow-a11y.test.tsx` | **GAP — fixed (shape 3 ONLY, per plan's explicit lock — no other change)** |

### Out-of-scope findings (files NOT in the D7 candidate list — recorded, not fixed)

| Surface | Finding | Why out of scope |
|---|---|---|
| `src/components/home/home-header.tsx` | `home-settings-button` is `h-10 w-10` (40×40px) — below the 44pt floor, no `hitSlop` | Not in D7's "Files to create/modify"; `app/(tabs)/index.tsx` only *composes* it |
| `src/components/section-header.tsx` | Section title carries `accessibilityRole="header"` but no `maxFontSizeMultiplier` | Not in D7's file list |
| `app/activity/[petId].tsx` | `activity-screen-offline-banner` has no `accessibilityRole="alert"` | Not in D7's file list (`activity-chip-grid.tsx`/`activity-recents-row.tsx`/`activity-quantity-sheet.tsx` are; the screen shell is not) |
| `app/check/index.tsx` | `check-recent-see-all` Pressable has `accessibilityRole="button"` but no `min-h-[44px]`/`hitSlop` (`py-2` only) | Not in D7's file list |
| `app/reminders/edit.tsx` | Its own bespoke date/time steppers (e.g. `reminder-startdate-*`) carry `min-h-[44px]` but no `accessibilityRole`/label — pre-existing house pattern, independently confirmed by `sweep4-a11y.test.tsx`'s own `expect(stepper.props.accessibilityRole).toBeUndefined()` case | Not in D7's file list (`schedule-builder.tsx` is; the screen shell around it is not) |
| `app/check/emergency/[checkId].tsx` | Titles (`emergency-title`, section headings) carry no `accessibilityRole="header"`; the go-now badge carries no `alert` role | **Deliberately not fixed — see R7 / §6 below.** Frozen safety surface, zero-code-diff by plan design (D5) |

---

## §3 Animation-site table

Re-run grep (`withRepeat|withSpring|withTiming|entering=|exiting=|FadeIn|useSharedValue|Animated\.|LayoutAnimation` over `apps/mobile/app` + `apps/mobile/src`, excluding `__tests__/**`) found **14 files** — not the plan's stated "11" (D4's own instruction: "the executor must still RE-RUN the grep … if it contradicts the above, the code wins"). Every one imports `use-reduced-motion`.

| Site | Primitive | Gated by `useReducedMotion`? | Covered by which test |
|---|---|---|---|
| `src/components/home/animated-gradient-background.tsx` | `withRepeat`/`withTiming` | yes | `reduced-motion-gating.test.tsx` (pre-existing) |
| `src/components/home/quick-actions-grid.tsx` | `entering=` | yes | `reduced-motion-gating.test.tsx` (pre-existing) |
| `src/components/quick-actions.tsx` | `entering=` | yes | `reduced-motion-gating.test.tsx` (pre-existing) |
| `src/components/pet-header-card.tsx` | `entering=` | yes | `reduced-motion-gating.test.tsx` (pre-existing) |
| `src/components/skeleton.tsx` | `withRepeat`/`withTiming` | yes | `skeleton.test.tsx` (pre-existing) |
| `src/components/chat/typing-indicator.tsx` | `withRepeat`/`withTiming` | yes | **was untested — fixed via append** |
| `src/components/intake/intake-form.tsx` | `entering=` (step transition) + `scrollTo({animated: !reduced})` + `AUTO_ADVANCE_MS` timer fork | yes | `entering` was untested — fixed via append; `AUTO_ADVANCE_MS` fork already covered by `intake-form.test.tsx`'s own "advances instantly under reduced motion"; `scrollTo` branch has no test anywhere (see §7 honesty) |
| `app/(auth)/welcome.tsx` | `entering=` | yes | **was untested — fixed via append** |
| `app/pets/[id].tsx` | `entering=` | yes | **was untested — fixed via append** |
| `app/services/salons.tsx` | `entering=` | yes | Only crash-only coverage existed (`services-preview-flows.test.tsx`) — entering-pair fixed via append |
| `app/services/book.tsx` | `entering=` | yes | Same as above — fixed via append |
| `app/services/store.tsx` | `entering=` | yes | Same as above — fixed via append |
| `app/services/vets.tsx` | `entering=` | yes | Same as above — fixed via append |
| `app/services/adopt.tsx` | `entering=` | yes | Same as above — fixed via append |

**Emergency interstitial's zero animation sites (evidence for D5):** `app/check/emergency/[checkId].tsx` was read in full — no `react-native-reanimated` import, no `entering`/`exiting` prop, no `Animated.*` node, no timer. The "reduce-motion respected on urgency animations" acceptance criterion therefore requires **no code change** on that screen; the deliverable is the test-only pin (`a11y-sweep.test.tsx`'s "emergency interstitial renders no animation node (D5 pin)").

`_layout.tsx` mounts `<ReducedMotionConfig mode={ReduceMotion.System}/>` only (no per-component gating needed there — it is the allowlisted root-level mount, per the static scan's own allowlist).

---

## §4 Contrast audit table

`dual-theme-contrast.test.ts` and `urgency-contrast.test.ts` already own the
house WCAG math for every previously-audited pair (brand scale, dark
semantic tokens, FIDELITY-2 cream page, 5-tier urgency banners/chips, both
themes). Re-inventorying the surfaces in scope (VetDisclaimer,
Emergency interstitial) found exactly the two mandatory D6 rows still
un-audited:

| Pair | Ratio | Floor | Verdict | Where the math lives |
|---|---|---|---|---|
| `text-brand-900 (#123a30)` on `bg-brand-50 (#f2f8f6)` — VetDisclaimer, **both** OS theme schemes | 11.67:1 | 4.5:1 (normal text) | **AAA**, both themes (opaque container, no `dark:` token — one number answers both) | `dual-theme-contrast.test.ts` (pre-existing "ink-900 on page-50" case) + new named case in "T093 contrast audit" describe |
| `white` on `bg-red-700 (#b91c1c)` — Emergency interstitial root | 6.47:1 | 4.5:1 | AA/AAA, theme-invariant | `dual-theme-contrast.test.ts`'s new "T093 contrast audit" describe |
| `white` on `bg-red-800 (#991b1b)` — Emergency hotline box | 8.31:1 | 4.5:1 | AA/AAA, theme-invariant | same |
| `white` on `bg-red-900 (#7f1d1d)` — Emergency go-now badge | 10.02:1 | 4.5:1 | AAA, theme-invariant | same |

No new/changed color token was needed — every pair above already clears its
floor with the existing palette. `packages/config/tailwind-preset.mjs` is
untouched (an automatic fail condition per the plan, correctly avoided).

**VetDisclaimer verdict, verbatim:** AA/AAA-compliant in both themes ⇒ the
missing `dark:` styling is aesthetic, not an a11y defect. See §6's FOUNDER
DECISION block.

---

## §5 Fix list — exactly the GAP rows in §2, mapped to file + D7 shape

| # | File | GAP | D7 shape applied |
|---|---|---|---|
| 1 | `src/components/timeline-photo-viewer.tsx` | close button below 44pt | (2) added `hitSlop={{top:8,bottom:8,left:8,right:8}}` |
| 2 | `src/components/intake/intake-form.tsx` | 2 review-edit links: no role, no 44pt | (1)+(2) added `accessibilityRole="button"` + `hitSlop` to both |
| 3 | `src/components/activity-recents-row.tsx` | recent chip below 44pt | (2) added `min-h-[44px]` |
| 4 | `src/components/activity-quantity-sheet.tsx` | `UnitChipRow` chips below 44pt; written-note link + cancel button below 44pt | (2) added `min-h-[44px]` to chips; `hitSlop` to the two links |
| 5 | `src/components/schedule-builder.tsx` | freq/day `Text` selectors: no role/state; 4 steppers: no label | (1) added `accessibilityRole="button"` + `accessibilityState={{selected}}` to freq/day; added `accessibilityLabel` (+ `accessibilityRole="button"`) to the 4 steppers |
| 6 | `src/strings.ts` | new labels needed for #5's steppers | append-only: `reminderForm.{intervalDecreaseA11y,intervalIncreaseA11y,monthDayDecreaseA11y,monthDayIncreaseA11y}` |
| 7 | `app/services/preview-end.tsx` | title has no header role | (3) added `accessibilityRole="header"` |
| 8 | `app/check/[category].tsx` | offline banner has no alert role | (5) added `accessibilityRole="alert"` |
| 9 | `app/paywall.tsx` | headline: no header role, no font-scale cap; error notice: no alert role | (3)+(4)+(5) added `accessibilityRole="header"` + `maxFontSizeMultiplier={1.5}` to headline; `accessibilityRole="alert"` to `paywall-error-notice` |
| 10 | `app/check/result/[checkId].tsx` | 5 section titles: no header role | (3) ONLY — added `accessibilityRole="header"` to each; no other change (plan's explicit lock for this file) |

Every other candidate file in the D7 allowlist got a **zero diff** (§2's "no" rows) — `chat-bubble.tsx`, `quick-prompts.tsx`, `nudge-card.tsx`, `active-pet-badge.tsx`, `app/chat/index.tsx`, `otp-input.tsx`, `timeline-photo-strip.tsx`, `question-renderer.tsx`, `species-picker.tsx`, `breed-autocomplete.tsx`, `activity-chip-grid.tsx`, `services/preview-banner.tsx`, `services/index.tsx`, `checks/[id].tsx`, `(tabs)/index.tsx`.

---

## §6 Out-of-scope / open decisions

**VetDisclaimer dark-mode styling — FOUNDER DECISION (carried from T088 item 12).** `src/components/vet-disclaimer.tsx` is not in the T093 file list at all and received zero code bytes. §4's evidence: its `brand-900`-on-`brand-50` pair is AAA-compliant in **both** OS theme schemes (opaque container, no `dark:` token needed for the math to hold). Ratified decisions this would reverse if "fixed": **PAWSAATHI-3 decision 2** and **FIDELITY-2 R6**. Live pins this would break: `check-result-snapshot.test.tsx`'s `PAWSAATHI-3` case (`:114-129`, asserts no `dark:` token + byte-identical text) and its `FIDELITY-2` case (`:135-147`, asserts `bg-brand-50` stays byte-identical, denylisted from the cream-page sweep). **This card deliberately changes nothing there.** The aesthetic question (should the disclaimer eventually get a dark visual treatment purely for cosmetic parity, given it's already a11y-compliant either way) is a founder call, not an a11y defect.

**Emergency interstitial header roles — R7, not fixed.** `app/check/emergency/[checkId].tsx`'s titles (`emergency-title`, the "What we detected"/"What to do" section headings) carry no `accessibilityRole="header"`, and the go-now badge carries no `alert` role. Planner's judgement, independently verified by re-reading the screen: it is a full-screen takeover with strictly linear reading order (badge → title → detected → guidance → hotline → actions) and three clearly labelled `PrimaryButton`s, so a screen reader still reads it correctly top-to-bottom without heading-based navigation. Adding roles would touch a zero-diff-pinned safety surface (the `emergency-interstitial.test.tsx` suite: `BackHandler` block, `gestureEnabled: false`, hotline resolution, "renders no AI content") for a marginal gain. Recorded here + as a `[DEVICE-ONLY]` row in `docs/qa/a11y-script.md`. If the checker judges the header roles genuinely necessary, that is a sanctioned-delta follow-up card with founder sign-off — not a change smuggled into this one.

**Other out-of-scope findings (§2's "out-of-scope" table)** — `home-header.tsx`'s 40×40px settings button, `section-header.tsx`'s uncapped title, `app/activity/[petId].tsx`'s un-alerted offline banner, `app/check/index.tsx`'s undersized "See all" link, and `app/reminders/edit.tsx`'s un-labelled date steppers — are all real, but every one lives in a file outside T093's "Files to create/modify." Fixing any of them here would be exactly the scope creep R8 warns against. They are handed off as a founder to-do (a follow-up a11y card, or folded into whichever future card next touches each file).

---

## §7 Honesty section — what these tests do NOT prove

- **No layout engine runs in this jest environment.** `className` is an unresolved literal string (NativeWind 4.2.6 + the `.css` stub, per `design-system.md §7.9`) — no test in this card can observe whether a font-scaled headline actually wraps, truncates, or overflows on a real device. The `dynamic-type.test.tsx` "renders at fontScale 3 without throwing" case proves only that no code path divides by / branches on `fontScale` and crashes; it is explicitly NOT a layout-survival test. The corresponding `[DEVICE-ONLY]` rows in `docs/qa/a11y-script.md` are where that question actually gets answered.
- **No screen reader runs in this environment.** There is no simulator, no VoiceOver, no TalkBack here. `docs/qa/a11y-script.md`'s automated half (`[AUTO]` rows) proves an element *has* a role/label/state/order — it cannot prove what a real screen reader *announces*, whether focus actually *moves*, or whether a gesture *conflicts* with the OS rotor. Every such question is a `[DEVICE-ONLY]` row with an unfilled `Result:` column. **The on-device VoiceOver/TalkBack pass has NOT been run in this environment; it is a founder to-do on real hardware.**
- **The `IntakeForm` `scrollTo({y:0, animated: !reduced})` branch has no automated test.** It is gated by the same `reduced` value as the step's `entering` prop (which IS tested), but `ScrollView.scrollTo` is an imperative ref method with zero capture precedent anywhere in this codebase's test suite. Simulating one would have been a fragile, first-of-its-kind mock this audit judged out of proportion to the risk (a `scrollTo({animated:true})` on a full-motion device is, at worst, a cosmetic non-issue, never a safety issue). Recorded here rather than silently invented.
- **Ionicons renders its glyph as a `Text` node internally with `allowFontScaling={false}`.** This is a correct, sanctioned pattern (decorative icon font-ligatures should never scale with the user's text-size setting) and is explicitly excluded from both a11y-static-scan's "no allowFontScaling={false}" rule (which only scans this repo's own `app/`/`src/` source, never `node_modules`) and `dynamic-type.test.tsx`'s "no fixed-height text container" walker (which only counts a `Text` node if it does NOT carry `allowFontScaling={false}`, so an icon-sized `h-11 w-11` button is never a false positive).
- **The `home`/`check-entry`/`activity`/`reminders` screens' full-tree touch-target sweep is scoped, not blanket.** `a11y-sweep.test.tsx`'s "reaches the 44pt target" checks run against the specific surfaces this card fixed or fully verified (check-result's 3 canon actions, the activity-logging chip grid + quantity sheet, `ScheduleBuilder`'s freq/day/interval controls) — not every Pressable on every screen in the app. Two small, commented allowlists (`CHECK_RESULT_ACTION_ALLOWLIST`, `ACTIVITY_SHEET_ALLOWLIST`) exist because `PrimaryButton`/`SecondaryButton`/`GhostButton`/`ActivityChipGrid` are visually compliant via generous padding rather than a literal `min-h-[…]` class the walker's regex can see — documented in the test file itself, not silently widened.
- **§2's inventory does not individually re-read every file under `apps/mobile/app/**`/`apps/mobile/src/components/**`.** It exhaustively covers the D7 candidate list, the canon components those files compose, and every screen the 5-flow sweep needed to render. The remainder is treated as inherited-compliant based on the density of existing a11y props found by the 278-hit grep and four prior sweep batches (SWEEP-1…4) — a genuine limit of this audit's time budget, stated here rather than implied to be exhaustive.
