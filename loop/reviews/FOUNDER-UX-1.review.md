# CHECKER Review — FOUNDER-UX-1 (tap-first intake + welcome/login upgrade)

Adversarial review of the uncommitted diff (13 porcelain paths: 11 modified + 2 new) against
`loop/plans/FOUNDER-UX-1.plan.md`, PRODUCT_SPEC §5, and CLAUDE.md §6/§7.

## Gates (independently re-run)
- `pnpm typecheck` → EXIT=0 (16/16, FULL TURBO)
- `pnpm lint` → EXIT=0 (0 errors; 1 pre-existing unrelated api warning)
- `pnpm --filter mobile test` → **113 suites / 814 tests / 17 snapshots, EXIT=0**
- `pnpm build` → EXIT=0 (9/9)
- No `packages/` diff ⇒ ai-evals correctly not required. Confirmed: `git diff --stat -- packages/` empty.

## 1. §7 chip-copy audit (priority 1)
- All 12 category arrays in `apps/mobile/src/checks/intake-descriptors.ts` compared line-by-line
  against the plan's enumerated list (plan lines 68–79). **VERBATIM match, no additions/omissions**
  for vomiting, diarrhea, not-eating, limping, skin-itch, eyes, ears, urinary, breathing, behavior,
  injury, other (6 strings each).
- Every string is a neutral observation. No diagnosis/condition names, no severity grades, no
  treatment/medication/dosing, no urgency implications. Borderline items scrutinized ("Belly looks
  bloated", "Seems dazed", "Noticed a new lump or bump") are appearance/behavior observations, not
  conditions or conclusions — acceptable and plan-sanctioned.
- `Record<SymptomCategory, ...>` gives compile-time completeness; the 12 keys match
  `SYMPTOM_CATEGORIES` in `packages/types/src/intake.ts:33-46`.
- **Mutation-proof (1) executed:** injected `"possible diagnosis: parvo"` into the `vomiting` array →
  `intake-descriptors.test.ts` › "contains no diagnosis/diagnose language" FAILED (1 failed, 15
  passed). Restored; sha256 `badf770e…c25e0e` byte-identical. Scan is non-vacuous.

## 2. Payload freeze (priority 2)
- `packages/types` untouched (zero diff, confirmed).
- `apps/mobile/src/checks/intake.ts`: only additive — new `buildDescriptorFreeText` (trims segments,
  drops empties, appends trimmed detail, joins with `". "`, returns trimmed). `buildIntakeCandidate`,
  `describeAnswer`, `extractPhotoKeys` bodies unchanged.
- Chips feed ONLY `freeText`: `const freeText = buildDescriptorFreeText(selectedDescriptors, extraDetail)`
  passed to the existing `buildIntakeCandidate(categoryDef, answers, freeText)`. No structured `Answer`
  created/bypassed by chips (`toggleDescriptor` mutates only local `selectedDescriptors: string[]`).
- Required-question gating unchanged: `nextDisabled = currentQuestion?.required && answers[id] === undefined`.
- **Mutation-proof (2) executed:** forced `buildDescriptorFreeText` → `return ""` → `intake.test.ts`
  serialize block FAILED (3 failed) AND re-targeted `intake-form.test.tsx` "typed text appears in the
  review row" FAILED ("Unable to find intake-review-freetext"). Restored; sha256 `85a00bd8…59ad08`
  byte-identical.

## 3. Step contract (priority 3)
- `total = questions.length + 2` unchanged; `freeTextStepIndex = questions.length`;
  `reviewStepIndex = questions.length + 1`. Quick-pick occupies the old free-text index.
- `intake-freetext-input` reachable via `intake-freetext-toggle` (GhostButton toggles `showFreeTextInput`).
- Review `intake-review-freetext` renders the serialized `{freeText.trim()}`; `intake-review-edit-freetext`
  onPress → `setStepIndex(freeTextStepIndex)` (returns to chips step).
- All pre-existing testIDs preserved; new ones (`intake-descriptor-<id>-<i>`, `intake-freetext-toggle`,
  `welcome-hero`) match the plan contract exactly.

## 4. Test-change audit (priority 4)
- `intake-form.test.tsx`: exactly the 2 sanctioned re-targets — (a) mutation-walk "step 6" line
  `intake-freetext-input` → `intake-descriptor-other-0`; (b) "typed text appears in review" now presses
  `intake-descriptor-other-0` + `intake-freetext-toggle` before typing. Payload/step-count assertions
  unchanged. No weakening (the meaningful review assertion is preserved and strengthened).
- `auth-onboarding-a11y.test.tsx`: exactly the one welcome assertion flip
  (`queryByTestId("home-gradient-background")).toBeNull()` → `queryByTestId("welcome-hero")).not.toBeNull()`).
- `question-renderer.test.tsx`, `intake-screen.test.tsx`, `auth-flow.test.tsx`: diff-empty (not in git status).
- `intake.test.ts`: additive `buildDescriptorFreeText` describe block only; existing blocks unchanged.

## 5. Auth logic freeze (priority 5)
- `welcome.tsx`: only presentational — gradient behind, `AppTitle variant="hero"`, decorative paw
  Ionicon, `welcome-hero` group. `router.push("/(auth)/email")` byte-identical; no handler change.
- `email.tsx`: only a header `View` block added. `EMAIL_PATTERN`, `requestOtp`, `handleSubmit`,
  focus/`findNodeHandle` logic, `router.push({pathname:"/(auth)/otp",...})`, testIDs unchanged.
- `otp.tsx`: only an `auth.otp.title` header `Text` added above the existing prompt. `handleComplete`,
  `handleResend`, `router.replace("/(auth)/done")`, `OtpInput`, `otp-resend` unchanged.
- `app-title.tsx`: `default` branch className is exactly `"text-2xl font-bold text-brand-700"` (byte-identical
  render); `testID`/`accessibilityRole` unchanged. `AnimatedGradientBackground`/`native-gradient` untouched.

## 6. Design-system §6
- Chips ≥44pt (`min-h-[44px]`), `accessibilityRole="button"`, `accessibilityState={{selected}}`.
- Entrance groups gated via shared `useReducedMotion` hook (imported from `../../hooks/use-reduced-motion`);
  pattern `{...(reduced ? {} : { entering: FadeInDown.duration(320) })}` — semantically equal to
  `reduced ? undefined : …` (reduced motion omits the prop). No `withRepeat` added.
- Progress bar keeps `intake-progress` node with `stepOf` caption as a descendant Text.
- No `gray-*` introduced in any changed file. Strings externalized: only the plan's new keys added to
  `strings.ts` (`intake.quickPick.{title,hint,addDetail}`, `auth.email.{title,subtitle}`, `auth.otp.title`),
  verbatim. No new deps (`package.json` diff empty).

## 7. Safety surfaces
- photo-prompt files, `<VetDisclaimer/>`, emergency interstitial, `use-check-submission.ts`,
  `check/[category].tsx` all diff-empty (confirmed via `git status --porcelain`).

## 8. Hygiene
- 13 paths, all within the plan's exhaustive file list. No `any`, no `@ts-ignore`, no `console.log`,
  no secrets, no TODO. Both mutation-proofs failed as required and restored byte-identically.

## Conclusion
Every acceptance criterion verified literally. Chip copy is verbatim and §7-safe; payload/validation
frozen; step contract intact; only the two sanctioned test re-targets + one welcome assertion flip;
auth logic byte-identical; safety surfaces untouched; both mutation-proofs are non-vacuous.

VERDICT: PASS
- Gates green (typecheck/lint/build 0; mobile 113 suites/814 tests EXIT=0); zero packages/ diff.
- §7 chip strings verbatim + neutral; mutation-proof (1) fails and restores clean.
- Payload/validation byte-identical; chips feed only freeText; mutation-proof (2) fails on both targets and restores clean.
- Exactly the two sanctioned intake-form re-targets + one auth-a11y flip; no auth-logic or safety-surface drift.
