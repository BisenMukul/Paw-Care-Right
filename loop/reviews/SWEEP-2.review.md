# CHECKER Review — SWEEP-2 (auth + onboarding design-system batch)

Reviewer: CHECKER (adversarial). Scope: 25 uncommitted porcelain paths (18 modified + 7 new) vs `loop/plans/SWEEP-2.plan.md`, `docs/design-system.md` §1.1/§2.8/§2.9/§4/§6, CLAUDE.md §6/§7.

## Gates re-run independently (this machine)
- `npx jest` (full mobile): **105 suites / 720 tests passed, 17 snapshots passed, EXIT=0** (matches orchestrator 105/720; was 101/703). The "worker failed to exit gracefully" line is a pre-existing teardown warning, not a failure.
- `pnpm --filter @pawcareright/mobile typecheck` → **EXIT=0** (`tsc --noEmit`).
- `pnpm --filter @pawcareright/mobile lint` → **EXIT=0** (`eslint .`).
- Build: not re-run here (heavy); orchestrator-verified 0. No new build-affecting surface (no deps, no config).

## Executor's two unconfirmed mutation-proofs — I PERFORMED BOTH
1. **TextField alert-role removal** — removed `accessibilityRole="alert"` from the error `Text` in `text-field.tsx`, ran `__tests__/text-field.test.tsx`: **1 failed** (`text-field.test.tsx:42` — Expected "alert", Received undefined). Restored from backup (verified `text-field.tsx:70` has the role again), re-ran: **3 passed**. Working tree byte-identical after restore.
2. **SecondaryButton→PrimaryButton swap in `social-auth-buttons.tsx`** — swapped import + both usages, ran `__tests__/auth-onboarding-a11y.test.tsx`: **1 failed** (`auth-onboarding-a11y.test.tsx:102` — welcome hierarchy assertion, social button no longer `border-brand-700`). Restored, re-ran: **10 passed**. `git diff --stat` confirms the file returned to its original 8/4 change.

Both mutations fail when applied → the two target assertions are non-vacuous. Working tree fully restored (18 modified, same 212/141 stat; 7 untracked).

## Duty-by-duty findings

1. **Logic freeze — PASS.** Diffed every screen/component. `requestOtp`/`verifyOtp`/`socialSignIn`/`markPushAsked` calls, router targets, `add-pet-store` usage, XOR/name-required order, OTP focus/paste, breed debounce/`useBreedSearch`, image compress/permission all byte-equivalent. The only additive behavior is a11y focus-on-failed-submit (`focusEmailField`/`focusField` via `findNodeHandle` + `AccessibilityInfo.setAccessibilityFocus`), explicitly sanctioned by the plan (§4.4) and orthogonal to auth flow. `wizard-scaffold.tsx:59-64` keeps `wizard-next` PrimaryButton props (`label`/`onPress`/`disabled={nextDisabled}`) intact.

2. **testID superset — PASS.** Every ID in the Interfaces list is present verbatim (grep sweep). `details-sex-male|female|unknown` are the template literal `details-sex-${option.toLowerCase()}` (`details.tsx`), `otp-input-cell-N` = `${testID}-cell-${index}` (`otp-input.tsx:102`), `breed-row-<slug>` = `breed-row-${breed.slug}`. No renames. `docs/qa/billing-sandbox-checklist.md` not in diff.

3. **New canon contracts — PASS.** `TextField` (`text-field.tsx`) forwards `ref` to `TextInput`, renders error node only when `error` truthy with `accessibilityRole="alert"` + `text-sm text-red-700`, `border-red-600` on error / `border-brand-100` otherwise, `placeholderTextColor="#2f8f74"`, `text-base text-brand-900` — matches §2.8 code block exactly. `SecondaryButton`: role button, `accessibilityState={{disabled}}`, `border border-brand-700 bg-white px-6 py-3`, label `text-base font-semibold text-brand-700` `maxFontSizeMultiplier={1.5}`, pressed brand-50 tint, spinner `#1f6350` — matches §2.9. `GhostButton`: no border/fill (`px-4 py-3`), role button, `hitSlop {8,8,8,8}` (py-3+text-base ≈48pt already → >44pt effective), pressed opacity-70, cap 1.5 — matches §2.9. PrimaryButton call sites elsewhere untouched (only social-auth-buttons swapped to Secondary, per plan).

4. **Focus-to-first-error — PASS.** `email.tsx` wires `emailFieldRef` → TextField ref, focuses on invalid + on generic error. `details.tsx` maps name-required → `focusField(nameFieldRef)` and xor → `focusField(birthDateFieldRef)` — correct branch/field pairing (R5). Refs forward through TextField to the underlying TextInput.

5. **Strings — PASS.** Exactly 3 additions in `strings.ts`: `auth.otp.cellLabel(index)`, `addPet.details.neuteredA11y`, `addPet.photo.previewA11y`. Diff shows only insertions — no existing copy churn. New a11y labels sourced from `strings.ts`; no hardcoded user-facing text.

6. **Color/token sweep — PASS.** Zero `gray-` across all touched files (grepped). Error text `text-red-700` + `alert` role everywhere (email/otp/join/breed/photo/social/details). No `text-brand-500`. Only sanctioned raw hex: `#2f8f74` (placeholder), `#1f6350` (spinner/icon). See Note A for `#f2f8f6`.

7. **§6 mapping honesty — PASS.** Card/SectionHeader genuinely N/A (none imported; no bespoke card/shadow introduced). No `entering`/`withRepeat` added to any screen (motion zero-entrance confirmed). No haptics added. `breed-autocomplete.tsx` treats offline as its existing error branch (no new offline chrome). `add-pet/done.tsx` keeps the tinted `ActivityIndicator` (`add-pet-submitting`, `color="#1f6350"`) — mutation-in-flight spinner, not skeleton (R3), true in code.

8. **auth-onboarding-a11y.test.tsx non-vacuity — PASS (adequate).** Proven non-vacuous by mutation #2 (hierarchy assertion caught the swap). Header-role assertions compare `toBe("header")` against a reliably-located node → would catch a dropped role. The `gray-` absence checks (`toBe(false)`) are meaningful because the same render asserts `bg-brand-50` `toBe(true)`, proving className strings are present/findable. Ghost-button `not.toContain("border"/"bg-")` distinguishes Ghost from Secondary/Primary. Observation (not a defect): the `gray-` check runs only on the email + otp renders, so a `gray-` reintroduction on details/species/breed/photo would not be caught by this suite — I independently grepped all touched files and confirmed zero `gray-`.

9. **Hygiene — PASS.** No package.json changes (no new deps). No `console.log`, no `any` type usage, no `@ts-ignore`/unjustified disables (grep hits are the word "any" inside comments only). All renders/presses `await`ed in new tests. No `.env`/protected/check-flow/emergency/disclaimer/paywall diffs (`git diff --name-only` clean of those).

10. **Full suite — 105 suites / 720 tests / 17 snapshots, EXIT=0.**

## Notes (non-blocking)
- **Note A** — `secondary-button.tsx:40` uses inline `backgroundColor: "#f2f8f6"` for the pressed state. This is a third literal hex beyond the two the plan enumerated, but it is the exact `brand-50` token value and is the only way to express the §2.9-mandated "pressed `bg-brand-50`" through the CLAUDE §6-sanctioned pressed-state style-fn (a className cannot target `pressed`), mirroring PrimaryButton's own style-fn convention. `#1f6350` also appears as the Secondary icon color (brand-700), consistent with PrimaryButton's `#ffffff` icon color. Honest/faithful, not a violation.
- **Note B** — `breed-autocomplete.tsx` passes `strings.addPet.breed.searchPlaceholder` as both the TextField `label` and `placeholder`, so that text now also renders as a visible label. Cosmetically redundant but introduces no new string, no testID change, and all suites stay green.
- **Note C** — Wizard step titles and the OTP prompt keep `text-xl`/`text-base font-semibold` rather than §6's `text-2xl font-bold` page-header canon (only auth `done` and `join` were upgraded). This is a deliberate plan decision (step titles vs. page headers) with `role="header"` applied throughout; within plan scope.

## Conclusion
Presentation-only refactor with zero behavior drift, all testIDs preserved verbatim, contracts matching the design system, correct focus-to-first-error wiring, honest §6 mapping, no safety-surface or dependency changes. Both required mutation-proofs fail on mutation and go green on restore. All independently-run gates pass.

VERDICT: PASS
