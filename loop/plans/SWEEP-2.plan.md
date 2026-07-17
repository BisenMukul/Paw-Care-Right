# Plan — SWEEP-2: App-wide UI modernization, batch 2 (AUTH + ONBOARDING screens)

## Objective (from card)
Apply the design-system.md §6 per-screen checklist to every signed-out + first-run onboarding screen (the `(auth)` stack, `push-rationale`, the `add-pet` wizard, and the signed-out `join/[code]` deep-link), reusing the SWEEP-1 canon primitives. Presentation only — no auth logic, no new deps, preserve every existing testID.

## Surface enumeration (verified from repo)
Signed-out `(auth)` stack: `welcome`, `email`, `otp`, `done` (+ pure `_layout` navigator, out of scope).
Onboarding: `push-rationale` (signed-in JIT rationale, first-run), `add-pet/{species,breed,details,photo,done}` (the first-run add-pet wizard, wrapped by `WizardScaffold`; `_layout` navigator out of scope).
`join/[code]` **lives at `apps/mobile/app/join/[code].tsx`** (NOT under `(auth)`). Verified: it is a `pawcareright://join/:code` deep-link entry that can land a signed-out/other user into an invite-accept — it is a signed-out entry path, so it **is in scope**.

## Design-system facts grounding this plan (verified by reading source)
- Brand scale (50,100,200,300,500,600,700,900) already present in `packages/config/tailwind-preset.mjs` (SWEEP-1). **Do not touch the preset.**
- Canon that EXISTS and must be reused verbatim: `ScreenScaffold`, `Card`, `SectionHeader`, `Skeleton`, `PrimaryButton`, `use-reduced-motion`. **Do not redesign them.**
- Canon that the design system names but does NOT yet exist: `TextField` (§2.8), `SecondaryButton` + `GhostButton` (§2.9). This surface is the first to need them (forms + button hierarchy are in the card's Do list), so SWEEP-2 creates them as new files. This is the single largest scope decision — see Risks R1.
- No existing snapshot test covers any file in this surface (snapshots exist only for pet-home/check-result/paywall/weight-chart). ⇒ **zero snapshots are re-recorded**; new coverage is assertion-based component tests. This satisfies the card's "snapshot re-records only for legitimately-changed renders" by there being none.
- This surface renders NO AI output, NO `<VetDisclaimer/>`, NO Emergency interstitial, NO paywall. §6's safety-chrome item is N/A here and MUST NOT be altered (do not touch check-flow/emergency/disclaimer/paywall — none are imported here).

## Files to create/modify (exhaustive — executor may touch NOTHING else)

### New canon components (design-system §2.8/§2.9 prerequisites, first needed here)
- `apps/mobile/src/components/text-field.tsx` — §2.8 canon: `forwardRef` label+input+inline `alert` error. Props: `label`, `value`, `onChangeText`, `error?: string|null`, `testID?` (→ inner `TextInput`), `errorTestID?` (→ error `Text`), `placeholder?`, `keyboardType?`, `autoCapitalize?`, `autoCorrect?`, `labelNativeID?`. Error state uses `border-red-600`; error text `text-red-700` (§1.1: red-700 on brand-50) with `accessibilityRole="alert"`; `placeholderTextColor="#2f8f74"`; input `text-base text-brand-900`; label `text-sm font-semibold text-brand-900` (scales freely, §4.5). `ref` forwards to the `TextInput` so screens can `.focus()` + `AccessibilityInfo.setAccessibilityFocus` on failed submit.
- `apps/mobile/src/components/secondary-button.tsx` — §2.9: `rounded-lg border border-brand-700 bg-white px-6 py-3`, label `text-base font-semibold text-brand-700`, pressed `bg-brand-50` via style-fn; `accessibilityRole="button"`, `accessibilityState={{disabled}}`, `maxFontSizeMultiplier={1.5}` on label; props mirror PrimaryButton (`label,onPress,disabled?,loading?,testID?,icon?`), loading = inline `ActivityIndicator` (color `#1f6350`).
- `apps/mobile/src/components/ghost-button.tsx` — §2.9: no border, `px-4 py-3`, label `text-base font-semibold text-brand-700`, pressed `opacity-70`; `accessibilityRole="button"`, `accessibilityState={{disabled}}`, `hitSlop` to guarantee ≥44pt, `maxFontSizeMultiplier={1.5}`. Props: `label,onPress,disabled?,testID?`.

### Modified shared components (part of this surface)
- `apps/mobile/src/components/wizard-scaffold.tsx` — page bg `bg-white`→`bg-brand-50`; convert bare `Pressable`+`Text` Back/Skip to `GhostButton` (keep testIDs `wizard-back`/`wizard-skip`); keep `PrimaryButton` for `wizard-next`; add `accessibilityRole="header"`+`maxFontSizeMultiplier={1.5}` are handled by the step title in each screen, not here; progress text stays. KAV already present (verified) — keep.
- `apps/mobile/src/components/app-title.tsx` — add `accessibilityRole="header"` + `maxFontSizeMultiplier={1.5}` (chrome/display text, §4.5). Display name already via `APP_DISPLAY_NAME` — verified-no-change on that.
- `apps/mobile/src/components/social-auth-buttons.tsx` — swap the Apple/Google `PrimaryButton`s to `SecondaryButton` (button hierarchy: one primary per region; email is the primary on welcome). Error `Text` `text-red-600`→`text-red-700` + `accessibilityRole="alert"`. Preserve testIDs `social-apple-button`,`social-google-button`,`social-auth-error` and all existing logic/props (`disabled`, handlers untouched).
- `apps/mobile/src/components/otp-input.tsx` — replace hardcoded `border-gray-300`/`text-gray-900`/`border-red-500`/`text-red-600` with `border-brand-100`/`text-brand-900`/`border-red-600`/`text-red-700`; add `accessibilityLabel` per cell (`strings.auth.otp.cellLabel(index)`); keep every testID (`otp-input`, `otp-input-cell-N`), `aria-invalid`, focus/paste logic untouched.
- `apps/mobile/src/components/species-picker.tsx` — `border-gray-300`→`border-brand-200`; keep `border-2 border-brand-700 bg-brand-100` selected card; already has `accessibilityRole="button"`+`accessibilityState.selected` (verified); ensure card min height ≥44pt (already `py-8`). Keep testIDs.
- `apps/mobile/src/components/breed-autocomplete.tsx` — search input → `TextField` (keep testID `breed-search-input`); loading `ActivityIndicator`→`Skeleton lines={3} testID="breed-loading"` (preserves the `getByTestId("breed-loading")` assertion); error `Text` `text-red-600`→`text-red-700`+`accessibilityRole="alert"` (keep testID `breed-error`); empty stays `text-brand-700` (keep testID `breed-empty`); result rows `border-gray-200`→`border-brand-100`, add `accessibilityRole="button"` + `min-h-[44px]`. Keep `breed-row-<slug>` testIDs + selection logic.

### Modified screens
- `apps/mobile/app/(auth)/welcome.tsx` — `bg-white`→`bg-brand-50`; `AppTitle` (now role=header); tagline stays `text-base text-brand-900`; PrimaryButton primary; SocialAuthButtons now secondary. Keep testID `welcome-continue-email`.
- `apps/mobile/app/(auth)/email.tsx` — `bg-white`→`bg-brand-50`; input+error → `TextField` (testID `email-input`, errorTestID `email-error`); on invalid submit, `AccessibilityInfo.setAccessibilityFocus` to the field ref (§4.4). Keep KAV, `email-submit`, all `requestOtp`/router logic untouched.
- `apps/mobile/app/(auth)/otp.tsx` — `bg-white`→`bg-brand-50`; prompt gets `accessibilityRole="header"`+`maxFontSizeMultiplier`; error `text-red-600`→`text-red-700`+`accessibilityRole="alert"` (keep `otp-error`); Resend bare Pressable→`GhostButton` (keep testID `otp-resend`); keep `otp-loading`, `otp-input`, verify logic untouched.
- `apps/mobile/app/(auth)/done.tsx` — `bg-white`→`bg-brand-50`; title→`text-2xl font-bold text-brand-900` + `accessibilityRole="header"` + `maxFontSizeMultiplier`; keep single PrimaryButton `done-continue` + logic.
- `apps/mobile/app/push-rationale.tsx` — `bg-white`→`bg-brand-50`; title role=header + cap; keep PrimaryButton `push-rationale-enable`; "Not now" bare Pressable→`GhostButton` (keep testID `push-rationale-skip`); registration/markPushAsked logic untouched.
- `apps/mobile/app/add-pet/species.tsx` — step title role=header+cap; "Start over" bare Pressable→`GhostButton` (keep `add-pet-start-over`); logic untouched.
- `apps/mobile/app/add-pet/breed.tsx` — step title role=header+cap; BreedAutocomplete now canon (see above); logic untouched.
- `apps/mobile/app/add-pet/details.tsx` — step title role=header+cap; name/birthDate/age/weight `TextInput`s → `TextField` (keep testIDs `details-name-input`,`details-birthdate-input`,`details-age-input`,`details-weight-input`; pass `keyboardType="number-pad"` for age/weight); sex `Pressable`s: add `accessibilityRole="button"`+`accessibilityState={{selected}}`+`min-h-[44px]`, `border-gray-300`→`border-brand-100` (keep `details-sex-*` testIDs); neutered `Switch` gets `accessibilityLabel`; keep the single form-level error region (testID `details-error`, now `text-red-700`+`accessibilityRole="alert"`) carrying BOTH `nameRequired` and `xorError` (preserves both existing `getByText` assertions); on failed submit focus name field (name-required) / birthDate field (xor) via ref. XOR/name-required validation logic unchanged.
- `apps/mobile/app/add-pet/photo.tsx` — step title role=header+cap; rationale text stays (JIT permission rationale — verified); "Choose photo" bare Pressable→`SecondaryButton` (keep `add-pet-choose-photo`); preview `Image` add `accessibilityLabel` (strings); error `text-red-600`→`text-red-700`+`alert` (keep `add-pet-photo-error`); `rounded-xl`→`rounded-2xl` on preview (house radius §1.3); permission/compress/skip logic untouched.
- `apps/mobile/app/add-pet/done.tsx` — `bg-white`→`bg-brand-50`; `ActivityIndicator` tint `color="#1f6350"` (kept: this is a mutation-in-flight action wait, spinner is correct per §2.11, NOT a content skeleton — see Risks R3); error `text-red-600`→`text-red-700`+`accessibilityRole="alert"` (keep `add-pet-error`); keep `add-pet-submitting`, `add-pet-retry` + orchestration logic untouched.
- `apps/mobile/app/join/[code].tsx` — `bg-white`→`bg-brand-50`; title `text-2xl font-bold` + role=header + cap (keep `join-title`); body stays; error `text-red-600`→`text-red-700`+`accessibilityRole="alert"` (keep `join-error`); keep PrimaryButton `join-accept` + acceptInvite/404/409 logic untouched.

### Strings
- `apps/mobile/src/strings.ts` — ADD only new a11y label keys (no copy churn to existing strings, to keep `getByText` assertions green): `auth.otp.cellLabel(index)`, `addPet.photo.previewA11y`, `addPet.details.neuteredA11y`. All display name stays via `APP_DISPLAY_NAME`.

### Tests — new (assertion-based; no snapshots)
- `apps/mobile/__tests__/text-field.test.tsx`
- `apps/mobile/__tests__/ghost-button.test.tsx`
- `apps/mobile/__tests__/secondary-button.test.tsx`
- `apps/mobile/__tests__/auth-onboarding-a11y.test.tsx` (cross-screen role/label/token/button-hierarchy coverage)

### Tests — may touch ONLY to keep green (do not weaken existing assertions; every current assertion must still pass)
- `apps/mobile/__tests__/auth-flow.test.tsx` — email/otp; testIDs preserved ⇒ expected no change.
- `apps/mobile/__tests__/add-pet-wizard.test.tsx` — `breed-loading` now on `Skeleton` container (testID preserved) ⇒ expected no change.
- `apps/mobile/__tests__/join-route.test.tsx`, `apps/mobile/__tests__/add-pet-done.test.tsx`, `apps/mobile/__tests__/app-title.test.tsx`, `apps/mobile/__tests__/otp-input.test.tsx` — expected no change.

All new/updated tests use RNTL v14 `await render(...)` (jest ledger convention, verified in existing suites).

## Ordered steps
1. Create `ghost-button.tsx`, `secondary-button.tsx` (mirror `primary-button.tsx` conventions; new files, zero blast radius on existing PrimaryButton call sites).
2. Create `text-field.tsx` (`forwardRef`) per §2.8.
3. Write `ghost-button.test.tsx`, `secondary-button.test.tsx`, `text-field.test.tsx`.
4. Update shared components: `wizard-scaffold.tsx`, `app-title.tsx`, `social-auth-buttons.tsx`, `otp-input.tsx`, `species-picker.tsx`, `breed-autocomplete.tsx`.
5. Add the 3 new a11y string keys to `strings.ts`.
6. Update the 4 `(auth)` screens.
7. Update `push-rationale.tsx` + the 5 `add-pet` screens.
8. Update `join/[code].tsx`.
9. Write `auth-onboarding-a11y.test.tsx`.
10. Run gates (below); adjust only the may-touch tests if a testID-preserving markup change breaks a query, without weakening assertions.

## Tests to write (map each §6 checklist item → test or verified-no-change)
- **ScreenScaffold adoption / solid non-gradient page** → `auth-onboarding-a11y.test.tsx`: asserts each screen root renders `bg-brand-50` and NO gradient/`AnimatedGradientBackground`. (Page-contract, not literal wrapper — Risks R1.)
- **Header canon (role=header)** → `auth-onboarding-a11y.test.tsx`: `getByRole("header")` present on done/otp/push-rationale/join/species titles + `AppTitle` (`app-title.test.tsx` verifies AppTitle unchanged behavior).
- **Four data states (server-backed only)** → only `breed` is query-backed: `add-pet-wizard.test.tsx` already asserts loading (`breed-loading`, now a Skeleton), error (`breed-error`), empty (`breed-empty`). Offline maps to the error branch (Risks R4). All other screens are action/form waits (button/inline spinner) — verified-no-change / N/A, noted per-screen.
- **Canon Card/SectionHeader usage** → N/A for this surface: no list/section cards here (centered auth + wizard forms); verified-no-change (no bespoke card/shadow/radius introduced; only §1 tokens used, asserted by the token check below).
- **Verified color pairs / no brand-500 text / no stray hex** → `auth-onboarding-a11y.test.tsx`: greps rendered `className`s for absence of `gray-` classes and presence of brand/red-700 error classes on error nodes; `text-field`/`otp-input` tests assert error text `text-red-700`.
- **Button hierarchy + loading/disabled/pressed + 44pt** → `secondary-button.test.tsx`/`ghost-button.test.tsx` assert role/state/label/`hitSlop`/min-height; `auth-onboarding-a11y.test.tsx` asserts welcome has exactly one PrimaryButton region with social as SecondaryButton, push-rationale skip is a GhostButton.
- **Every Pressable role/state/label + press feedback + ≥44pt** → covered by the button tests + `species-picker`/`breed-row`/sex-chip assertions (`min-h-[44px]`, `accessibilityState.selected`) in `auth-onboarding-a11y.test.tsx` (mirrors `touch-targets.test.tsx` style).
- **Forms: TextField canon (label + inline alert error, announced, focus-to-first-error, KAV, JIT permission)** → `text-field.test.tsx`: label rendered, error node has `accessibilityRole="alert"` only when `error` set, ref forwards focus; `auth-flow.test.tsx` still shows `email-error`; `add-pet-wizard.test.tsx` still shows `details-error`; photo JIT-permission flow already covered (verified-no-change).
- **Motion: ≤1 entrance group, 0 loops, gated by useReducedMotion** → verified-no-change: SWEEP-2 adds NO `entering`/`withRepeat` to any screen (zero ≤ one). The only animation in-surface is the `Skeleton` pulse in breed loading, already gated by `use-reduced-motion` (SWEEP-1). Asserted indirectly by `auth-onboarding-a11y.test.tsx` (no `Animated` entrance on screen roots) + existing `reduced-motion-gating.test.tsx` unaffected.
- **Haptics only at §3.3 moments** → verified-no-change: none of §3.3's moments (log-save, purchase, destructive-confirm) occur in auth/onboarding; no haptics added.
- **Font scaling (`maxFontSizeMultiplier` 1.5 on chrome only, no fixed-height text)** → `ghost-button`/`secondary-button` tests assert `maxFontSizeMultiplier===1.5` on labels; `app-title.test.tsx` region + a11y test assert titles cap at 1.5; body/TextField labels left uncapped (§4.5).
- **Strings externalized / display name via APP_DISPLAY_NAME** → `auth-onboarding-a11y.test.tsx` + existing `app-title.test.tsx`; new a11y labels sourced from `strings.ts`.
- **Safety chrome** → N/A (no AI/disclaimer/emergency/paywall imported in this surface) — verified-no-change; executor must not add or touch any.
- **Snapshot/component tests updated same commit** → the 4 new test files + preserved existing suites; no snapshot files exist for this surface so none are re-recorded.

## Commands to run to self-verify
- `pnpm --filter @pawcareright/mobile test`
- `pnpm typecheck && pnpm lint`
- `pnpm build` (affected: mobile)

## Interfaces/contracts the executor must match
- `TextField` = `forwardRef<TextInput, {label:string; value:string; onChangeText:(t:string)=>void; error?:string|null; testID?:string; errorTestID?:string; placeholder?:string; keyboardType?:TextInputProps["keyboardType"]; autoCapitalize?:TextInputProps["autoCapitalize"]; autoCorrect?:boolean; labelNativeID?:string}>`. Error node renders ONLY when `error` truthy, with `accessibilityRole="alert"` + class `text-sm text-red-700`.
- `SecondaryButton`/`GhostButton` = same call shape as `PrimaryButton` (`{label,onPress,disabled?,testID?,...}`), `accessibilityRole="button"`, `accessibilityState={{disabled}}`, label `maxFontSizeMultiplier={1.5}`.
- Preserve EXACTLY these testIDs (superset, do not rename): `welcome-continue-email`, `app-title`, `social-apple-button`, `social-google-button`, `social-auth-error`, `email-input`, `email-error`, `email-submit`, `otp-input`, `otp-input-cell-0..5`, `otp-error`, `otp-loading`, `otp-resend`, `done-continue`, `push-rationale-enable`, `push-rationale-skip`, `wizard-progress`, `wizard-back`, `wizard-skip`, `wizard-next`, `species-card-dog`, `species-card-cat`, `add-pet-start-over`, `breed-search-input`, `breed-loading`, `breed-error`, `breed-empty`, `breed-row-<slug>`, `details-name-input`, `details-birthdate-input`, `details-age-input`, `details-weight-input`, `details-sex-male|female|unknown`, `details-neutered-toggle`, `details-error`, `add-pet-choose-photo`, `add-pet-photo-preview`, `add-pet-photo-error`, `add-pet-submitting`, `add-pet-error`, `add-pet-retry`, `join-title`, `join-error`, `join-accept`.

## Out of scope / do NOT touch
- `packages/config/tailwind-preset.mjs` (SWEEP-1 done), `ScreenScaffold`/`Card`/`SectionHeader`/`Skeleton`/`PrimaryButton`/`use-reduced-motion` internals (reuse only), the home tab.
- Any auth LOGIC: `src/auth/**` (token/secure-store/store actions), `requestOtp`/`verifyOtp`/`socialSignIn`/`markPushAsked`, `households-api`/`pets-api`/`breeds-api` calls, `add-pet-store`, `compress-image`, router targets.
- `(auth)/_layout.tsx`, `add-pet/_layout.tsx` (pure `Stack` navigators — no UI surface).
- check-flow / emergency / disclaimer / paywall (not imported here; must stay untouched).
- No new dependencies; no new snapshot files.

## Risks & the design decisions the planner made (scrutinize)
- **R1 (primary decision — "ScreenScaffold adoption"):** the literal `<ScreenScaffold>` is a top-aligned Scroll+title CONTENT wrapper with no KeyboardAvoidingView; every screen here is either a vertically-centered status screen or a keyboard form. The card forbids redesigning SWEEP-1 primitives, so `ScreenScaffold` cannot be extended to center/KAV. Decision: satisfy §6 item 1 at the **page-contract** level — solid `bg-brand-50`, `SafeAreaView edges={["top"]}`, §1 tokens, non-gradient, KAV on forms — rather than by wrapping in `<ScreenScaffold>`. Justified by §1.2 ("px-6 … full-screen status states only" carve-out) + §2.1 (scaffold is the scroll/title content model). If the founder wants the literal wrapper, this is a contained follow-up.
- **R2:** SWEEP-2 CREATES three new canon components (`TextField`, `SecondaryButton`, `GhostButton`) named in §2.8/§2.9 but absent after SWEEP-1. They are new files (no blast radius on existing PrimaryButton usages) and are prerequisites for the card's "form canon" + "button hierarchy" items. Alternative (inlining per screen) would violate §2's "screens compose canon, don't re-invent."
- **R3:** `add-pet/done` keeps a full-screen `ActivityIndicator` (tinted) instead of a Skeleton, because it is a mutation-in-flight action wait (§2.11: mutation ⇒ spinner, content-load ⇒ skeleton), not a content list. Chose not to force a skeleton there.
- **R4:** `breed` autocomplete treats offline as its existing error branch (no separate offline banner / pull-to-refresh) because it is a live search box, not a cached content list; adding Retry/refresh chrome inside an autocomplete would be over-engineering (CLAUDE §2.2). Loading upgraded to Skeleton, error given `alert` role.
- **R5:** `details` keeps ONE form-level error region (`details-error`) carrying both `nameRequired` and `xorError` (cross-field), rather than splitting per-field, to preserve the two existing `getByText` assertions while adding `accessibilityRole="alert"` + focus-to-first-error. The name field also reflects `hasError` styling on name-required.
