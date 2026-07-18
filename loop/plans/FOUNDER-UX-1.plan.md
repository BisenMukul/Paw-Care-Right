# Plan — FOUNDER-UX-1: Tap-first symptom intake (Part A) + welcome/login visual upgrade (Part B)

## Objective (from card)
A) Replace the intake "free text" step's primacy with tap-first per-category quick-pick descriptor chips that serialize into the EXISTING optional `freeText` string (no `packages/types`/api edits), plus give the whole stepped intake an interactive canon UI pass. B) Make the pre-auth welcome + email + otp screens look genuinely good (hero gradient, brand presence, polished forms) with zero auth-logic and zero schema changes. Every existing testID preserved; validation byte-identical; safety surfaces (CLAUDE §7 / PRODUCT_SPEC §5) untouched.

Note on the card's spec pointer: `INTAKE_CATEGORIES` / `parseIntake` / `CompletedIntake` live in `packages/types/src/intake.ts` (not `check.ts`). This plan cites `intake.ts`. It is **read-only reference** — do NOT edit it.

---

## Files to create/modify (exhaustive — executor may touch NOTHING else)

### Create
- `apps/mobile/src/checks/intake-descriptors.ts` — NEW data module. Exports `INTAKE_DESCRIPTORS: Record<SymptomCategory, readonly string[]>` (the §7-audited quick-pick strings enumerated below) + `getDescriptors(categoryId: string): readonly string[]` (returns `[]` for unknown). Pure data + lookup, no React.
- `apps/mobile/__tests__/intake-descriptors.test.ts` — NEW test: enum completeness + §7 forbidden-language scan over every descriptor string (mirrors the pattern in `packages/types/src/intake.spec.ts` "no intake copy contains diagnosis or dosing language").

### Modify
- `apps/mobile/src/checks/intake.ts` — add pure helper `buildDescriptorFreeText(selectedDescriptors, extraDetail)` (signature below). Do NOT change `buildIntakeCandidate` / `describeAnswer` / `extractPhotoKeys` behavior.
- `apps/mobile/src/components/intake/intake-form.tsx` — (1) segmented progress bar keeping `intake-progress` node with the `stepOf` text as a descendant; (2) replace the free-text step body with the quick-pick chips grid + a collapsed "Add more detail" toggle that reveals the existing `intake-freetext-input`; (3) one reduced-motion-gated `FadeInDown` entrance group per step; (4) review step rendered as canon Cards. Wire `freeText` = `buildDescriptorFreeText(selectedDescriptors, extraDetail)`.
- `apps/mobile/src/components/intake/question-renderer.tsx` — canon restyle + press-feedback for `single`/`multi`/`scale`/`duration` sub-components (bigger tappable cards/pills, §1 tokens, selected states). **Preserve every testID and every `accessibilityState` shape.** Do NOT change `photoPrompt` delegation.
- `apps/mobile/src/strings.ts` — add `intake.quickPick` group (title/hint/addDetail) and `auth.email.title`/`auth.email.subtitle` + `auth.otp.title` (exact strings below). Reuse existing `intake.freeText.*`, `auth.welcome.tagline`.
- `apps/mobile/src/components/app-title.tsx` — add optional `variant?: "default" | "hero"` prop; `default` keeps the exact current markup/classes so all existing call sites are unchanged; `hero` renders `text-3xl font-bold text-brand-700`. `testID="app-title"` + `accessibilityRole="header"` unchanged.
- `apps/mobile/app/(auth)/welcome.tsx` — hero: `<AnimatedGradientBackground/>` absolutely filled behind, `<AppTitle variant="hero"/>`, a decorative `Ionicons name="paw"` (from `@expo/vector-icons`, existing dep), tagline, `PrimaryButton`, `SocialAuthButtons`, all inside ONE reduced-motion-gated `FadeInDown` entrance group (`testID="welcome-hero"`). Keep `bg-brand-50` on the `SafeAreaView` base. Preserve `welcome-continue-email`, `app-title`, social testIDs. Zero navigation change.
- `apps/mobile/app/(auth)/email.tsx` — add a header block (`AppTitle` optional + `auth.email.title` header-role + `auth.email.subtitle`), refine spacing/hierarchy. Keep `KeyboardAvoidingView` + `bg-brand-50`, `TextField`, `PrimaryButton`. Preserve `email-input`, `email-error`, `email-submit`. Zero auth-logic change (do not touch `handleSubmit`, `EMAIL_PATTERN`, `requestOtp`, focus logic).
- `apps/mobile/app/(auth)/otp.tsx` — add `auth.otp.title` header, refine hierarchy/spacing, keep `OtpInput`, prompt, `GhostButton` resend. Preserve `otp-input`, `otp-error`, `otp-loading`, `otp-resend`. Zero auth-logic change (do not touch `handleComplete`/`handleResend`).
- `apps/mobile/__tests__/intake.test.ts` — ADD a `buildDescriptorFreeText` describe block (existing blocks unchanged).
- `apps/mobile/__tests__/intake-form.test.tsx` — re-target the two free-text-step interactions to the new chips step (details in "Tests" — additive/re-target only, never weakened).
- `apps/mobile/__tests__/auth-onboarding-a11y.test.tsx` — update ONLY the welcome-screen gradient assertion (details below); every other screen assertion stays byte-identical and must stay green.
- `apps/mobile/__tests__/question-renderer.test.tsx` — OPTIONAL, additive only: may add selected-state coverage. Not required (the restyle changes no asserted prop). Do NOT weaken existing assertions.

---

## Interfaces/contracts (executor must match)

Pure helper (`apps/mobile/src/checks/intake.ts`):
```ts
/** Serializes tap-selected descriptor chips (+ optional typed detail) into the
 *  single optional freeText string the payload already carries. Selection order
 *  preserved; segments joined with ". "; empty in → "". No schema change. */
export function buildDescriptorFreeText(
  selectedDescriptors: readonly string[],
  extraDetail: string,
): string;
```
Behavior: trim each segment, drop empties, append trimmed `extraDetail` last if non-empty, join with `". "`, return trimmed (`""` when nothing selected/typed). The result is fed to the existing `buildIntakeCandidate(categoryDef, answers, freeText)` — which already trims and omits empty freeText — so the `{category, answers[], freeText?}` payload shape is UNCHANGED.

Data module (`apps/mobile/src/checks/intake-descriptors.ts`):
```ts
import type { SymptomCategory } from "@pawcareright/types";
export const INTAKE_DESCRIPTORS: Record<SymptomCategory, readonly string[]> = { /* below */ };
export function getDescriptors(categoryId: string): readonly string[];
```

New testIDs (stable pattern): `intake-descriptor-<categoryId>-<index>` (one per chip, in array order), `intake-freetext-toggle` (the "Add more detail" GhostButton), `welcome-hero` (welcome entrance group). All PRE-EXISTING testIDs preserved verbatim.

Strings to add:
- `intake.quickPick.title` = `"What are you noticing?"`
- `intake.quickPick.hint` = `"Tap anything you've seen — pick as many as apply. This step is optional."`
- `intake.quickPick.addDetail` = `"Add more detail"`
- `auth.email.title` = `"What's your email?"`
- `auth.email.subtitle` = `"We'll send you a 6-digit code to sign in."`
- `auth.otp.title` = `"Check your email"`

---

## Proposed quick-pick chip strings (§7 audit surface — checker must scrutinize EACH)
All are neutral OBSERVATIONS: no diagnosis, no severity grade, no treatment/medication language. They feed ONLY `freeText` (optional context for the AI) — they do NOT map to any structured `Answer`, do NOT satisfy/bypass any required question, and do NOT feed the deterministic red-flag rules (those run on structured answers only). Emergency escalation path unchanged.

- `vomiting`: "Drooling more than usual" · "Trying to bring something up with nothing coming out" · "Belly looks bloated" · "Ate something unusual recently" · "Lip-licking or swallowing a lot" · "Restless and can't settle"
- `diarrhea`: "Straining in the litter box or outside" · "Accidents in the house" · "Scooting bottom along the floor" · "Passing a lot of gas" · "Drinking more than usual" · "Licking their bottom a lot"
- `not-eating`: "Turned away from a favorite food" · "Walked up to food then left it" · "Drooling" · "Quieter than usual" · "Hiding away" · "Lip-licking"
- `limping`: "Holding the leg up" · "Slower going up or down stairs" · "Reluctant to jump" · "Licking at the paw or leg" · "Stiff after resting" · "Yelped when it happened"
- `skin-itch`: "Scratching a lot" · "Licking the same spot" · "Rubbing against furniture" · "Skin looks flaky" · "Skin feels warm to the touch" · "Noticed a new lump or bump"
- `eyes`: "Pawing at the eye" · "Keeping the eye closed" · "Watery eye" · "Avoiding bright light" · "Rubbing face along the floor" · "Eye looks different from the other one"
- `ears`: "Tilting the head to one side" · "Ears feel warm" · "Flinching when the ears are touched" · "Dark buildup inside the ear" · "Holding one ear down" · "Rubbing ears along the floor"
- `urinary`: "Going to the toilet spot again and again" · "Squatting for a long time" · "Drinking more than usual" · "Seems uncomfortable" · "Restless and can't settle" · "Urine smells stronger than usual"
- `breathing`: "Breathing fast while resting" · "Stretching the neck out to breathe" · "Belly moving a lot with each breath" · "Reluctant to lie down" · "Tiring quickly" · "Making a new snoring sound while awake"
- `behavior`: "Hiding in unusual places" · "Pacing and can't settle" · "Clingier than usual" · "Less interested in play" · "Sleeping more than usual" · "Startling easily"
- `injury`: "Limping since it happened" · "Holding the area very still" · "Licking the spot" · "Swelling where it happened" · "Pulling away when touched there" · "Seems dazed"
- `other`: "Less active than usual" · "Off their food" · "Drinking differently" · "Sleeping more" · "Seems uncomfortable" · "Something just seems off"

---

## Ordered steps

1. **Descriptor data module.** Create `intake-descriptors.ts` with `INTAKE_DESCRIPTORS` (all 12 categories above, typed `Record<SymptomCategory, ...>` so the compiler enforces every category is covered) + `getDescriptors`.
2. **§7 test.** Create `intake-descriptors.test.ts`: (a) every `SYMPTOM_CATEGORIES` id has ≥1 descriptor; (b) `/diagnos/i` matches nothing; (c) the dosing/med/administration pattern from `intake.spec.ts` matches nothing. Run `pnpm --filter mobile test intake-descriptors` — green before proceeding.
3. **Serialize helper.** Add `buildDescriptorFreeText` to `checks/intake.ts` per the signature. Add its describe block to `intake.test.ts`. Run `pnpm --filter mobile test intake.test` — green.
4. **QuestionRenderer canon restyle.** Restyle `single`/`multi`/`scale`/`duration` to §1-token cards/pills with selected states + a press-feedback `style={({pressed}) => pressed ? {opacity:0.85} : null}` function (the §6-sanctioned inline-style exception). Keep every `testID`, `accessibilityRole`, and `accessibilityState` object identical. Run `pnpm --filter mobile test question-renderer` — green (unchanged).
5. **IntakeForm — progress bar.** Replace the plain progress `Text` with a `View testID="intake-progress"` containing a segmented bar (`total` segments; filled `bg-brand-500`, todo `bg-brand-100`) AND a caption `Text` rendering `strings.intake.stepOf(stepIndex+1, total)` as a descendant (so `toHaveTextContent` assertions still pass).
6. **IntakeForm — quick-pick step.** Replace the free-text step body: add `selectedDescriptors: string[]` and `extraDetail: string` state. Render `intake.quickPick.title`, `intake.quickPick.hint`, then a wrapped multi-select chip grid from `getDescriptors(categoryDef.id)` (each `Pressable testID={intake-descriptor-<id>-<i>}`, `accessibilityRole="button"`, `accessibilityState={{selected}}`, §2.5 Chip look, press feedback, `min-h-[44px]`). Below: a `GhostButton testID="intake-freetext-toggle"` (`intake.quickPick.addDetail`) that toggles visibility of the EXISTING `TextInput testID="intake-freetext-input"` (unchanged props). Compute `const freeText = buildDescriptorFreeText(selectedDescriptors, extraDetail)` and pass to `buildIntakeCandidate`. This step keeps its index (`questions.length`), so `total = questions.length + 2` is UNCHANGED and step-count assertions hold. The review "freeText" row (`intake-review-freetext` / edit) now shows the serialized string and, on edit, returns to this step.
7. **IntakeForm — entrance + review cards.** Wrap each step's scroll content in one `Animated.View` keyed by `stepIndex` with `entering={reduced ? undefined : FadeInDown.duration(320)}` (import `useReducedMotion` from `src/hooks/use-reduced-motion`, `FadeInDown` from `react-native-reanimated` — the `quick-actions-grid` house pattern). Restyle review rows into canon `Card`s (`rounded-2xl bg-white p-4 shadow-md`), preserving `intake-review-row-*`, `intake-review-edit-*`, `intake-review-freetext`, `intake-review-edit-freetext`, `intake-validation-error`.
8. **Update intake-form.test.tsx** interactions (see Tests). Run `pnpm --filter mobile test intake-form` — green.
9. **app-title variant.** Add the `variant` prop (default unchanged, `hero` = `text-3xl font-bold text-brand-700`).
10. **welcome.tsx hero.** Gradient behind + `AppTitle variant="hero"` + decorative paw Ionicon + tagline + PrimaryButton + SocialAuthButtons inside one gated `FadeInDown` group (`testID="welcome-hero"`). No nav change.
11. **email.tsx / otp.tsx polish.** Add header blocks (new strings), refine spacing/hierarchy, keep all canon components + logic + testIDs.
12. **Update auth-onboarding-a11y.test.tsx** welcome assertion (see Tests). Run `pnpm --filter mobile test auth-onboarding-a11y auth-flow` — green.
13. **Checkpoint — full gates:** `pnpm typecheck && pnpm lint && pnpm --filter mobile test && pnpm build`. No `packages/ai` change ⇒ no ai-evals.

---

## Tests to write (map to acceptance criteria)

Part A:
- **A1 chips replace free-text primacy / serialize into freeText** → `intake.test.ts` › `buildDescriptorFreeText`: asserts chips-only join (`"a. b"`), chips + typed detail append (`"a. b. more"`), typed-only (`"more"`), and empty → `""`. Plus `intake-form.test.tsx` › re-targeted "free-text step is optional" test: press `intake-descriptor-other-0` (a chip), press `intake-freetext-toggle`, type into `intake-freetext-input`, advance, assert `intake-review-freetext` shows the serialized text.
- **A2 §7 chip copy safe / externalized / structured semantics intact** → `intake-descriptors.test.ts`: enum-completeness + `/diagnos/i` + dosing-pattern scans over `INTAKE_DESCRIPTORS`. Structured-answer intactness is covered by the UNCHANGED `intake-form.test.tsx` "submits the exact valid CompletedIntake" (payload with no chips → `freeText` omitted) and "gates Next on a required question" (required gating unchanged) and "fails closed" tests.
- **A3 interactive UI, testIDs + validation intact** → UNCHANGED `intake-form.test.tsx` progress/step-count/back/edit/submit/fail-closed tests (all still reference `intake-progress`, `intake-next/back/submit`, `intake-review-*`); UNCHANGED `question-renderer.test.tsx` (testIDs + `accessibilityState` preserved); UNCHANGED `intake-screen.test.tsx` (`intake-form`, `intake-question-prompt`, offline, back).
  - Legitimately-changed assertions (call out for checker): in `intake-form.test.tsx` the mutation-resistance walk's "step 6: free-text" line `expect(getByTestId("intake-freetext-input")).toBeTruthy()` becomes `expect(getByTestId("intake-descriptor-other-0")).toBeTruthy()` (input is now behind the toggle); the "typed text appears in review" test now taps `intake-freetext-toggle` before typing. Step counts and payload assertions are UNCHANGED.

Part B:
- **B1 welcome hero, testIDs, APP_DISPLAY_NAME via constant** → `auth-onboarding-a11y.test.tsx` › welcome: keep `bg-brand-50` present + `app-title` header + PrimaryButton `bg-brand-700` + social `border-brand-700`/`bg-white`; **change** the line `expect(queryByTestId("home-gradient-background")).toBeNull()` to `expect(queryByTestId("welcome-hero")).not.toBeNull()` (positively asserts the new hero group; the `home-gradient-*` internals fall back in jest so asserting on `welcome-hero` is the stable, meaningful check). `app-title` still sources the name from `APP_DISPLAY_NAME`.
- **B2 email/otp polished, canon, zero-logic-change** → UNCHANGED `auth-flow.test.tsx` (email invalid/valid submit + navigation; otp wrong-code) and UNCHANGED `auth-onboarding-a11y.test.tsx` email/otp assertions (`bg-brand-50`, no `gray-`, `email-error` alert/`text-red-700`, `otp-resend` ghost). These passing after the visual edits proves auth logic + canon compliance are intact.

### design-system §6 item → test mapping
- Canon surfaces (Card/Chip) → `intake-form.test.tsx`, `question-renderer.test.tsx` (testIDs render).
- Token colors only (no `gray-`) → `auth-onboarding-a11y.test.tsx` email/otp `gray-` guard.
- Touch targets ≥44pt → chips `min-h-[44px]`; covered by existing 44pt-pattern assertions style.
- Roles/states → `question-renderer.test.tsx` `accessibilityState`; a11y sweep header/button roles.
- Motion gated by `useReducedMotion()` → checker verifies `entering` props are reachable from the hook (static review; no `withRepeat` added).
- Strings externalized / display name via constant → `app-title` uses `APP_DISPLAY_NAME`; descriptors + UI copy externalized (data module + `strings.ts`).
- §7 chip copy → `intake-descriptors.test.ts`.

---

## Commands to run to self-verify
- `pnpm --filter mobile test intake-descriptors`
- `pnpm --filter mobile test intake.test`
- `pnpm --filter mobile test intake-form question-renderer intake-screen`
- `pnpm --filter mobile test auth-onboarding-a11y auth-flow`
- `pnpm typecheck && pnpm lint && pnpm --filter mobile test && pnpm build`

---

## Out of scope / do NOT touch
- `packages/types/**` (esp. `intake.ts`, `parseIntake`, `completedIntakeSchema`) and any api DTO/AI-triage prompt — payload schema is FROZEN. If chips seem to need a schema field, STOP and write `FOUNDER-UX-1.blocked.md` (per card).
- `apps/mobile/src/components/intake/photo-prompt-question.tsx` + `photo-prompt-question.test.tsx`.
- `<VetDisclaimer/>`, the Emergency interstitial, red-flag rules engine, `use-check-submission.ts`, `check/[category].tsx` submit orchestration — safety/escalation surfaces are unchanged (intake here is collection-only).
- Auth logic: `auth-store`, `requestOtp`/`verifyOtp`/`socialSignIn`, `EMAIL_PATTERN`, OTP verification, navigation targets.
- `AnimatedGradientBackground` internals, `native-gradient.ts`, `home/*` screens.
- No new dependencies (Ionicons, reanimated, expo-linear-gradient, expo-haptics all already present).

---

## Risks & the design decisions the planner made (checker: scrutinize)
1. **Chips serialize into `freeText`, no schema change (the core decision).** Descriptors become supplementary free-text context, NOT structured answers. This keeps `packages/types`/api/AI-prompts untouched per the card's hotfix boundary. Trade-off: descriptors are not individually machine-parseable and don't feed red-flag rules — acceptable because the card mandates exactly this and forbids schema changes.
2. **Descriptors live in a mobile DATA module, not `strings.ts`.** Justification: mirrors the existing precedent where `INTAKE_CATEGORIES` copy is externalized DATA (packages/types) explicitly exempted from the "no hardcoded strings in components" rule; a `Record<SymptomCategory,...>` gives compile-time completeness the flat `strings.ts` object cannot, and co-locating the §7-critical strings in one small auditable file makes the forbidden-language test and checker audit focused. Risk: a strict §6 "strings in strings.ts" reading — mitigated by the precedent + the explicit test.
3. **Quick-pick step keeps the free-text step's index; step count unchanged** (`questions.length + 2`). Chose this over merging into a new step to preserve the many step-count/progress assertions; only two interaction lines change. Alternative (dedicated extra chips step) was rejected as it would churn every step-count assertion for no product gain.
4. **Text input demoted behind an "Add more detail" toggle** (still `intake-freetext-input`). Realizes "writing becomes last-resort." Risk: two existing assertions that expected the input visible-by-default change (enumerated above as legitimate re-targets, not weakenings).
5. **Welcome uses the home `AnimatedGradientBackground`** — a deliberate override of design-system §2.1's "gradient is a home-*tab* signature." Rationale: the founder card explicitly mandates the gradient hero for the pre-auth welcome screen, which is NOT a bottom tab, so home remains the only *tab* with it. Asserting on the new `welcome-hero` wrapper (not `home-gradient-*` internals) keeps the test stable across the jest native-gradient fallback.
6. **No haptics added to intake chips.** design-system §3.3 scopes haptics to the tap-first *logger* + purchase moments; intake is neither, so adding them would be scope creep. Flagged so the checker can confirm the omission is intentional.
7. **`app-title.tsx` gains a `variant` prop with an unchanged default.** Minimal, backward-compatible; every other call site renders identically. Risk: touching a shared component — mitigated by default-path invariance and existing `app-title` assertions staying green.
