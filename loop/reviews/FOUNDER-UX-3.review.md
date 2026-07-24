# CHECKER Review — FOUNDER-UX-3 (canon AppHeader across pushed screens)

Reviewer: CHECKER (independent). Tree is uncommitted; all mutation restores used sha1-verified file backups, never `git checkout`.

## Gates (independently re-run)
- `pnpm typecheck` → exit 0
- `pnpm lint` → exit 0
- `pnpm --filter mobile test` → **146 suites / 1137 tests passed, 17 snapshots passed**, exit 0
- `pnpm build` → 9/9 tasks, exit 0
- packages/ai untouched → `test:ai-evals` not required.

## Duty 1 — §5 SAFETY
- **check/result bar is back-only.** `apps/mobile/app/check/result/[checkId].tsx:91` renders `<AppHeader onBack={onBack} />` (no `title` → zero new §5 copy). Filtering the file's diff of the three header lines (import, `useNavBack`, `<AppHeader>`) yields **empty** — the content region (emergency notice, urgency banner, `<VetDisclaimer/>`, all `check-result-*` testIDs) is byte-identical to HEAD.
- **Content hierarchy byte-frozen.** `check-result-snapshot.test.tsx.snap` delta = **497 added / 0 removed**; the only new node is the `app-header` `View` prepended above `check-result-screen`'s children. Existing subtrees unchanged. The disclaimer byte-identity pins (PAWSAATHI-3 "no `dark:`", FIDELITY-2 `bg-brand-50`) remain in `check-result-snapshot.test.tsx:114/135` and pass unchanged.
- **Emergency precedence verified by tracing navigation myself.** `check/[category].tsx:47` `onEmergency → router.replace(emergency)`; `check/emergency/[checkId].tsx:39` `handleAcknowledge → router.replace(result)`; `check/waiting/[checkId].tsx:29` `→ router.replace(result)`. Every hop is `replace()`, so the emergency interstitial is never on the back stack when result mounts. The new back affordance runs `useNavBack("/(tabs)/timeline")` → `canGoBack() ? back() : replace(timeline)`; `back()` returns to whatever preceded the intake (e.g. `check/index`), and the fallback is `timeline` — **neither path can re-enter the emergency screen.**
- **Emergency screen zero-diff:** `git diff apps/mobile/app/check/emergency/` = 0 lines. `BackHandler.addEventListener` and `gestureEnabled:false` pins intact.
- **Intake stepper / WizardScaffold untouched:** neither appears in the diff.

## Duty 2 — Scaffold additivity
- `screen-scaffold.tsx`: `showInScrollTitle = Boolean(title) && !onBack`. With `onBack` absent this equals the old `title ?` truthiness; `AppHeader` is gated on `onBack`; the new subtitle `else-if` requires `onBack`. **No-`onBack` path is byte-identical to HEAD** (also asserted by `app-header.test.tsx:77`).
- `onBack` branch: title moves to the bar, in-scroll `text-2xl` block suppressed, subtitle preserved as first scroll child (R7) — asserted by `app-header.test.tsx:91`.
- Tab roots unchanged: `timeline-screen.test.tsx` + `agenda-screen.test.tsx` assert `queryByTestId("app-header")` null; both suites green.

## Duty 3 — Adoption completeness vs plan
- 21 screens (16 Group A + 5 Group B) each carry the header with the **exact** fallback from R6: services children `/services`, `services/index` `/(tabs)/settings`, `adopt-detail` `/services/adopt`, `check/result` `/(tabs)/timeline`, all other Group A + Group B `/(tabs)`. Verified via `grep useNavBack` across `app/`.
- No out-of-list adoption: `app-header` imported only in the 5 Group B screens; Group A flows through scaffold; `useNavBack` appears only in the 21 sanctioned files.
- `services-adopt-detail-back` hand-rolled Pressable/icon removed — **plan-sanctioned** (plan line 54). `router` still used (preview-end push), no dead imports.

## Duty 4 — AppHeader contract
- 44pt target (`h-11 w-11`), `accessibilityRole="button"`, `accessibilityLabel={strings.nav.back}`, `hitSlop 8`, pressed `opacity 0.85`. Title (when present): `font-display-semibold text-brand-900 dark:text-ink-dark`, role `header`, `maxFontSizeMultiplier 1.5`. Icon color `#1f6350`/`#2EA57C` matches design-system §1.6 pair. No right-action slot (R3 honored).

## Duty 5 — Mutation-proofs (both re-run, sha1-verified restores)
- **(a) back target 44→32pt** (`h-11 w-11`→`h-8 w-8`): `app-header.test.tsx` [AC5] **FAILED** as required (`Expected substring "h-11"`). Restored; `sha1sum -c` OK.
- **(b) fallback dropped:** the naive "drop join arg" is behaviorally inert because join's fallback `/(tabs)` equals `DEFAULT_FALLBACK`. The load-bearing mutation — removing the `canGoBack()` gate so `useNavBack` always calls `router.back()` — **FAILED** both `use-nav-back.test.tsx` [AC2] and `join-route.test.tsx` [AC2] (`expect(mockReplace).toHaveBeenCalledWith("/(tabs)")`). Restored; `sha1sum -c` OK. Fallback AC is non-vacuous.

## Duty 6 — Snapshots
- Only `pet-home-snapshot` (71 added / 0 removed) and `check-result-snapshot` (497 added / 0 removed) re-recorded — each a single additive `app-header` node, matching the plan's sanctioned list. `paywall-snapshot` and `weight-chart-snapshot` absent from the diff; 17 snapshots pass without `-u`.

## Duty 7 — Test honesty
- Header-present tests use `getByTestId` (throws if header missing); tab-root/back-only tests use `queryByTestId(...).toBeNull()`. `header-sweep.test.tsx` covers 7 present + 2 absent representatives. Existing assertions not weakened; router mocks only widened with `back`/`canGoBack`. Mutation-proofs confirm the suites would catch a missing header and a broken fallback.

## Duty 8 — Hygiene
- Only `strings.nav.back = "Back"` added (§7 tone fine, no diagnosis/dosing). No new dependencies. No `any`/`@ts-ignore`/`console.log`/TODO in source or new files. Renders awaited (RNTL v14). All existing testIDs preserved except the plan-sanctioned `services-adopt-detail-back`.

## Deviation (noted, not disqualifying)
- `apps/mobile/__tests__/weight-screen.test.tsx` was modified but is **not** in the plan's exhaustive test list. The change is a mechanically-required `expo-router` mock extension (`useRouter` added) because `weight/[petId]` — an explicitly sanctioned Group A screen — now resolves `onBack` through `useNavBack()→useRouter()` via the scaffold; without it the existing suite would throw. Test-mock-only, clearly documented in-file, keeps the suite green, and does not weaken any assertion. Within the spirit of the sanctioned Group A change.

## FAIL-condition sweep
No back affordance can re-enter emergency; no result content drift; scaffold change is additive; no missing/wrong fallback; no unsanctioned dropped testID; no unsanctioned snapshot delta; both mutation-proofs fail as required.

VERDICT: PASS
- All gates green (typecheck/lint 0, test 146/1137 exit 0, build 9/9).
- §5 surface: back-only header, content byte-frozen, emergency precedence provably intact, emergency screen zero-diff.
- Scaffold additive; 21/21 screens carry the correct R6 fallback; no out-of-list adoption; adopt-detail testID removal sanctioned.
- Snapshot churn limited to the two sanctioned files, purely additive; disclaimer subtree byte-identical.
- Both mutation-proofs fail correctly (sha1-verified restores).
- One minor, justified, test-only deviation (`weight-screen.test.tsx` router mock) — insufficient to fail.
