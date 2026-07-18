# SWEEP-4 Review — App-wide UI modernization, batch 4 of 4 (CHECKER)

Reviewed: uncommitted diff (33 porcelain paths: 26 modified + 7 new) against `loop/plans/SWEEP-4.plan.md`, `docs/design-system.md`, CLAUDE.md §6/§7/§8. Executor claims verified independently; nothing taken on trust. (Note: this review consolidates one session interrupted by a transient limit; all evidence below was re-established or completed in the final session.)

## 1. Independent gates

| Gate | Result |
|---|---|
| `pnpm typecheck` | EXIT=0 |
| `pnpm lint` | EXIT=0 |
| `pnpm build` | EXIT=0 |
| `pnpm test` (turbo) | EXIT=1 — **api workspace only**: jest globalSetup cannot reach postgres (`P1001 localhost:5432`; docker daemon unavailable in this environment). Infra, not code; diff is 100% `apps/mobile`. |
| `pnpm --filter @pawcareright/mobile test` | EXIT=0 — **111 suites passed / 788 tests passed / 17 snapshots passed** (matches orchestrator-verified numbers; was 107/755 pre-sweep) |
| `pnpm test:ai-evals` | Not required — `packages/ai` untouched (porcelain confirms mobile-only). |

## 2. §7 frozen copy (duty 1) — PASS

- **Med form**: `git diff apps/mobile/src/components/medication-course-form.tsx` contains ZERO user-facing string-literal changes. All labels/placeholders remain `strings.medForm.*` SSOT references; stepper glyphs `-`/`+`/`-1w`/`-1d`/`+1d`/`+1w` byte-identical (moved into inner `<Text>` under new `Pressable` wrappers); only additions are className constants, `placeholderTextColor="#2f8f74"`, and a doc comment. `med-add-time` still present on the interactive `Text onPress={addTime}` node (medication-course-form.tsx:167). `medication-course-form.test.tsx` PASS unchanged.
- **Agenda dose label**: `strings.agenda.medDoseLabel` and the `agenda-item-dose-*` block appear nowhere in the diff (agenda-item.tsx diff touches only container→Card and complete/snooze buttons). `agenda-tz-drift.test.tsx` + `agenda-screen.test.tsx` PASS unchanged.
- **Paywall isolation**: `paywall-emergency-safety.test.tsx` and `paywall-trigger.test.tsx` have EMPTY diffs (not in porcelain) and both PASS in the full run. `strings.ts` diff adds exactly one key — `settings.title: "Settings"` (strings.ts:167) — no entitlement/pricing copy touched anywhere.

## 3. Paywall snapshot audit (duty 2) — PASS

Compared `git show HEAD:...paywall-snapshot.test.tsx.snap` vs working tree, filtered to className/testID/text deltas. Every delta maps to the sanctioned 6-item list, nothing else:
1. root `flex-1 bg-white` → `flex-1 bg-brand-50`
2. `gap-4 px-6` → `gap-6 px-4`
3. headline `text-2xl` → `text-3xl font-bold text-brand-900`
4. plan cards → `rounded-2xl bg-white p-4 shadow-md` (annual keeps `border-2 border-brand-700`; monthly/family drop `border-brand-300`)
5. notice radius `rounded-lg`→`rounded-2xl` (notices don't render in the two snapshotted states, so no snap delta — source change verified in paywall.tsx diff)
6. `paywall-restore`/`paywall-maybe-later` → GhostButton (accounts for all remaining deltas: `items-center` wrapper Views, GhostButton's `px-4 py-3` / `text-base font-semibold text-brand-700` / `maxFontSizeMultiplier` / hitSlop / accessibilityState internals, ×2 buttons ×2 snapshots)

Grep of new snap: `diagnos|dose|dosage|medication` → **0 matches**. Prices still fixture-offering-bound: `paywall-price-annual` $39.99/yr, `paywall-price-monthly` $4.99/mo, `paywall-price-family` $59.99/yr (snap lines 93–193, both snapshots). `Get more from Paw Care Right +` headline intact (snap:31); `Paw Care Right + Plus` (snap:469) pre-exists in HEAD snap (1 occurrence each). `pet-home-snapshot`/`check-result-snapshot`/`weight-chart-snapshot` snaps: empty diffs → byte-identical. No new snapshot files (still 4).

## 4. Billing-checklist testIDs (duty 3) — PASS

Scripted grep of all 37 static pinned IDs (17 paywall, 11 settings, 5 family static, 4 upsell): **zero missing**, each on its equivalent interactive node. Template IDs `family-member-${member.userId}` (family.tsx:103) and `family-member-role-${member.userId}` (family.tsx:107, role text content preserved: OWNER→owner/member strings). `settings-premium` ListRow title = `strings.settings.premium(APP_DISPLAY_NAME)` (settings.tsx via ListRow); `settings-premium-entry.test.tsx` PASS unchanged. `<BillingIssueBanner />` remains the FIRST child of the scaffold (settings.tsx:47); `billing-issue-banner.tsx` untouched.

## 5. Mutation-proofs (duty 4) — PASS, both re-run by checker

- **Proof A (Chip min-h)**: sha1 `b0f38356...` recorded; removed `min-h-[44px] justify-center` from both class constants in `chip.tsx` → `touch-targets.test.tsx` **fails 2/2** (at line 92, `.toContain("min-h-[44px]")`). Restored from backup; `sha1sum -c` OK; re-run → 2/2 green. Matches executor claim exactly.
- **Proof B (EmptyState CTA guard)**: sha1 `84aa2a3d...` recorded; mutated guard `ctaLabel && onCtaPress` → `ctaLabel` only → `empty-state.test.tsx` **fails 1/5** (4 passed — the "does NOT render a CTA when only ctaLabel is supplied" case catches it). Restored; `sha1sum -c` OK; re-run → 5/5 green. Matches executor claim exactly.
- Tree verified unmutated after both proofs (porcelain still exactly 33 paths).

## 6. Logic freeze (duty 5) — PASS

Spot-audited diffs; every handler/mutation/router-target/store expression is byte-identical (only re-indented or moved onto canon components):
- **settings.tsx**: `router.push("/family")`, `router.push("/settings/notifications")`, `router.push({pathname:"/paywall", params:{source:"settings"}})`, `openManageSubscription()` (still gated on `entitlement?.source === "own"`), `handleRestore` + `disabled={restoreBusy}`, analytics `Switch` value/onValueChange unchanged; restore notices intact.
- **reminders/edit.tsx**: `buildRRule`/`combineLocalDateTime` bodies appear nowhere in the diff; `setType/setTimeOfDay/setStartDate(shiftDateString ...)/setTitle/handleSave` expressions identical; `MedicationCourseForm petId onSaved={router.back}` identical; title input → TextField with pre-existing `strings.reminderForm.titleLabel`.
- **care-plan/[petId].tsx**: `toggleRow`/`shiftRow(±1/±7)`/`handleConfirm`/`goToPetHome` identical; empty-state CTA reuses `goToPetHome` with `ctaTestID="care-plan-skip"` (no new router target — sweep4-a11y presses it and asserts the pre-existing `router.replace` target).
- **family.tsx**: `handleInvite`/`handleLeave`/`setShowLeaveConfirm` and all mutation wiring identical; `family-leave-grace` stays red (600→700 token only).
- **care.tsx / timeline.tsx**: `handleComplete`/`handleSnooze`/router pushes/Share-prepare untouched; only `isRefetching` newly destructured (existing query-result field, plan-sanctioned) to feed `RefreshControl`.
- **timeline-screen.test.tsx re-target** (only test edit in the diff): line 182 `toHaveTextContent(strings.timeline.empty)` → same matcher with `{ exact: false }` because EmptyState's icon renders a sibling glyph node. Still asserts the ENTIRE `strings.timeline.empty` string is present — strengthening-or-equal, not weakened.

## 7. New canon contracts (duty 6) — PASS

- **Chip** (`chip.tsx`): single `Pressable` bears forwarded `testID` + `role="button"` + `accessibilityState={{selected}}` + pressed-opacity fn; className constants include `min-h-[44px] justify-center` on top of exact §2.5 fills (`rounded-full bg-brand-700 px-4 py-2.5` / `border border-brand-100 bg-white px-4 py-2.5`); inner Text `maxFontSizeMultiplier={1.5}` with §2.5 text classes. Matches plan interface block and design-system.md:121–122 verbatim. `touch-targets.test.tsx` pins the contract (proven by mutation A).
- **EmptyState** (`empty-state.tsx`): `items-center gap-4 rounded-2xl bg-white px-6 py-10`, Ionicons 56 `#2f8f74`, title/body classes exact, CTA = PrimaryButton rendered only when BOTH `ctaLabel && onCtaPress` (proven by mutation B), no container role. Matches plan verbatim.
- **ListRow** (`list-row.tsx`): Pressable-when-onPress else View; `flex-row items-center gap-3 py-3 min-h-[56px]`; role/state/pressed-fn on pressable; leading tile `h-10 w-10 rounded-full bg-brand-100` Ionicons 20 `#1f6350`; `trailing ?? (showChevron ? chevron : null)`, showChevron default true. Matches plan + design-system.md:127.
- **Deviations 1–3 verified justified and §7-clean**:
  1. Pressable-wrap (not hitSlop-on-Text) for schedule-builder/med-form steppers — RN `TextProps` has no `hitSlop`; onPress expressions moved verbatim, glyph copy unchanged, testIDs on the new Pressables; `schedule-builder.test.ts` + `medication-course-form.test.tsx` PASS unchanged.
  2. Conditional prop-spread (`{...(isDone ? {className:"opacity-60"} : {})}`, `{...(ctaTestID !== undefined ? {testID: ctaTestID} : {})}`) — correct under `exactOptionalPropertyTypes`; no behavior change.
  3. TextField labels reuse EXISTING strings only: `strings.weight.addWeight`, `strings.vetVisit.reasonPlaceholder`, `strings.vetVisit.clinicPlaceholder` — zero new prose (strings.ts diff is the single `settings.title` line).

## 8. §6 mapping honesty (duty 7) — PASS

- Skeletons replace every converted `ActivityIndicator` with testIDs preserved (`agenda-loading`, `timeline-loading`, `family-loading`, `care-plan-loading`, `reminder-form-loading`→checked via suite, `weight-screen-loading`, `note-screen-loading`, `vet-visit-screen-loading`, `notifications-loading`); sweep4-a11y "no ActivityIndicator spinners remain" block asserts absence by host-type search.
- EmptyState adopted at agenda/timeline/family/care-plan (asserted in sweep4-a11y with `{exact:false}` full-string containment); PTR (`RefreshControl` + `refreshing={isRefetching}`) on care/timeline/family, asserted via `props.refreshControl`.
- Offline banners `accessibilityRole="alert"`: agenda, timeline, notifications asserted in sweep4-a11y; form errors alert-roled + `text-red-700` asserted for add-weight/add-note/add-vet-visit.
- Header `role="header"` asserted for all 12 swept screens; caps asserted on timeline/activity/coming-soon.
- `weight-unit-toggle` untouched: `min-h-[44px] justify-center` intact (weight/[petId].tsx:100); `weight-screen.test.tsx:138` assertion unchanged and green.
- `gray-`: zero occurrences in added diff lines and zero in any touched file.
- Verified-no-change list confirmed: `activity-chip-grid.tsx`, `activity-recents-row.tsx`, `activity-quantity-sheet.tsx`, `weight-chart.tsx`, `billing-issue-banner.tsx` absent from porcelain.
- **sweep4-a11y non-vacuity**: substantive — renders all 12 real screens against mocked hooks, presses real nodes (care-plan skip → asserts the pre-existing `router.replace` target; add-weight/note/vet-visit save → asserts alert-roled errors), and searches real rendered trees. The one trivially-passing assertion, as required to name: **sweep4-a11y.test.tsx:260** `expect(screen.queryByTestId("home-gradient-background")).toBeNull()` — the care screen never had a gradient, so this can't fail against HEAD either (harmless no-regression guard, mirrors SWEEP-2 idiom). Also noted: line 435 pins `accessibilityRole` as `undefined` on care-plan stepper Pressables — the plan mapped steppers to the 44pt assertion only, so this is plan-consistent, but a future pass could add `role="button"` to stepper Pressables.

## 9. Hygiene (duty 8) — PASS

- No new dependencies (no package.json/lockfile in porcelain). No `console.log`, `any`, `@ts-ignore`/`@ts-expect-error`, `eslint-disable`, secrets, or unreferenced TODOs in added lines (scripted grep: clean).
- All new-test `render(...)`/`fireEvent` calls awaited (chip/empty-state/list-row/sweep4-a11y inspected).
- No diffs under `app/check/**`, `src/components/intake/**`, home tab, `pets/[id]`, or any protected file (CLAUDE.md §6-protected files untouched; porcelain is exactly the plan's file list).
- One pre-existing full-suite warning ("worker process failed to exit gracefully") — present independent of this diff, non-failing.

## Minor observations (non-blocking)

1. **agenda-item DONE tint**: old DONE style was `bg-brand-50 ... opacity-60`; new is Card (white) + `opacity-60` only. Plan said "DONE variant keeps `opacity-60`/tinted" — the brand-50 tint was dropped. Presentation-only nuance, no test pins it, `agenda-screen.test.tsx` green; flagging for the journal rather than failing a token-level ambiguity.
2. ListRow defaults `showChevron=true` on static (View) rows too; plan phrased the default as "for pressable rows". All current static usages pass `trailing` or `showChevron={false}`, so no rendered difference.
3. `pnpm test` cannot go green end-to-end in this environment (docker daemon unavailable → api integration suite blocked at globalSetup). Mobile-only diff; mobile gate independently green.

## Verdict

Every acceptance criterion verified with evidence; both mutation-proofs reproduce exactly as claimed with sha1-verified restores; §7 copy byte-frozen; snapshot deltas fully sanctioned; all 37+ pinned testIDs present; zero logic drift; the single test edit is coverage-equal; hygiene clean.

VERDICT: pass
