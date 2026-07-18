# Plan — CRAFT-1: §7 craft-layer sweep, batch 1 (all non-check screens)

## Objective (from card)
Apply the design-system §7.8 CRAFT delta, screen by screen, to every non-check screen (batch 1) that is already §1–§6-compliant: thumb-zone bottom-pinned CTAs, type/weight discipline + `tabular-nums`, 60/30/10 accent demotion, Peak-End save confirmations, empty-state value previews. Presentation + copy-additive ONLY — zero logic/store/api/router-target changes; every existing testID preserved; safety chrome (CLAUDE §7 / PRODUCT_SPEC §5) untouched.

## Safety note (no SAFETY-ESCALATION)
Batch 1 excludes the entire check/intake/emergency/result flow (batch 2). No screen here renders `<VetDisclaimer/>`, the Emergency interstitial, dosing, or AI results. Every new string is record-only (see the tone-scan test). Nothing in scope weakens a Safety Policy surface, so this task is plannable. If the executor finds ANY edit would touch disclaimer/emergency/dosing copy or ordering, STOP and write `loop/plans/CRAFT-1.blocked.md` tagged SAFETY-ESCALATION.

---

## Files to create/modify (exhaustive — executor may touch NOTHING else)

### New shared code
- `apps/mobile/src/components/save-confirmation.tsx` — NEW. Small presentational Peak-End banner: `<View accessibilityRole="alert" testID={testID} className="flex-row items-start gap-2 rounded-lg bg-brand-50 px-4 py-3">` with a soft `Ionicons name="checkmark-circle" size={20} color="#2f8f74"`, `message` (`text-sm font-semibold text-brand-900`) and optional `nudge` (`text-sm text-brand-700`). Props `{ testID?: string; message: string; nudge?: string }`. No animation (stays out of the §3 motion contract), no dismiss button (parent owns lifetime).

### Shared components (touch canon; snapshot discipline noted)
- `apps/mobile/src/components/screen-scaffold.tsx` — add optional `footer?: ReactNode`. When `footer` is provided: wrap the `SafeAreaView` body in `KeyboardAvoidingView` (iOS `behavior="padding"`), render the existing `ScrollView` in a `flex-1`, and BELOW it render `<View testID="screen-scaffold-footer" className="border-t border-brand-100 bg-brand-50 px-4 pb-6 pt-3">{footer}</View>`. When `footer` is undefined: render EXACTLY as today (no KAV, no footer View) so every current caller is byte-identical. No other prop/behavior change.
- `apps/mobile/src/components/add-note-form.tsx` — convert to `forwardRef<AddNoteFormHandle>` exposing `{ submit: () => void }` via `useImperativeHandle`. Render ONLY the field group (`<View className="gap-4">…</View>`): drop its internal `KeyboardAvoidingView`, `ScrollView`, and the in-body `PrimaryButton` (the button relocates to the screen footer). Keep ALL validation state/logic (`validateNoteForm`, error slot testID `add-note-error`) and the `HealthLogPhotoPicker` unchanged. Export `AddNoteFormHandle` type.
- `apps/mobile/src/components/add-vet-visit-form.tsx` — same refactor: `forwardRef<AddVetVisitFormHandle>` with `{ submit }`, render field group only (drop internal KAV/ScrollView/`PrimaryButton`), keep validation + error slots (`add-vet-visit-error-*`) + picker unchanged.
- `apps/mobile/src/components/activity-quantity-sheet.tsx` — (a) add `tabular-nums` to the `activity-quantity-value` Text (`min-w-[56px] text-center text-2xl font-bold text-brand-900 tabular-nums`); (b) the cancel Pressable label `text-base font-medium text-brand-700` → `text-base font-semibold text-brand-700` (weight discipline §7.3). No behavior change.
- `apps/mobile/src/components/agenda-item.tsx` — add `tabular-nums` to the due-time Text (`formatDueTime` → `text-sm text-brand-700 tabular-nums`).
- `apps/mobile/src/components/home/today-preview-card.tsx` — add `tabular-nums` to the `AgendaRow` time Text (`text-xs text-brand-700 tabular-nums`).
- `apps/mobile/src/components/timeline-row.tsx` — add `tabular-nums` to the date Text and the numeric `summary` Text (`text-sm … tabular-nums`).
- `apps/mobile/src/components/pet-header-card.tsx` — the three chip Texts `text-xs font-medium text-brand-700` → `text-xs font-semibold text-brand-700` (§7.3: pet-home screen otherwise carries bold+semibold+medium = 3 weights). Snapshot-bearing (pet-home) — re-record.

### Screens — single-action (thumb-zone footer + Peak-End)
- `apps/mobile/app/note/[petId].tsx` — render fields via `<AddNoteForm ref={formRef} …/>` inside `ScreenScaffold`; pass `footer={<PrimaryButton testID="add-note-save" label={strings.note.save} loading={addNote.isPending} disabled={saved} onPress={() => formRef.current?.submit()} />}`. Add local `saved` state + a `useRef` back-timer: on mutation `onSuccess`, set `saved`, render `<SaveConfirmation testID="note-saved-confirmation" message={strings.note.savedConfirmation} nudge={strings.note.savedNudge}/>` as the first scaffold child, and schedule the EXISTING `router.back()` via `setTimeout(…, CONFIRM_MS=1200)`; clear timer on unmount. The mutation call itself is unchanged and un-delayed.
- `apps/mobile/app/vet-visit/[petId].tsx` — same pattern with `AddVetVisitForm` ref, footer `add-vet-visit-save`, `SaveConfirmation testID="vet-visit-saved-confirmation"` (`strings.vetVisit.savedConfirmation` / `.savedNudge`), deferred `router.back()`.
- `apps/mobile/app/weight/[petId].tsx` — (a) move `weight-add-button` PrimaryButton out of the scroll into `ScreenScaffold` `footer` (stays on-screen; no navigation). (b) `weight-unit-toggle` label `text-base font-medium` → `text-base font-semibold` (§7.3). (c) Peak-End: on `addWeight` success (existing `setFormVisible(false)`), set `saved` state and render `<SaveConfirmation testID="weight-saved-confirmation" message={strings.weight.savedConfirmation} nudge={strings.weight.savedNudge}/>` above the chart; auto-clear via a ref'd `setTimeout(…, 2500)` cleared on unmount. No router change.
- `apps/mobile/app/reminders/edit.tsx` — move the `reminder-save` PrimaryButton (and `reminder-save-error` Text) from end-of-scroll into `ScreenScaffold` `footer`, rendered ONLY when `!showMedicationForm` (medication mode keeps `MedicationCourseForm`'s own save — footer stays absent, so `queryByTestId("reminder-save")` remains null in med mode). Add `tabular-nums` to the `reminder-startdate` Text. No logic change.
- `apps/mobile/app/paywall.tsx` — (a) thumb-zone: move the primary `paywall-trial-cta` PrimaryButton out of the in-scroll offerings block into a pinned footer `<View>` below the `ScrollView` (inside the existing `relative flex-1` wrapper, above the `paywall-busy` overlay), keeping its exact `monthly &&` condition, label logic, `loading`/`disabled`, and testID. (b) radius fix: `paywall-plan-annual-highlight` `rounded bg-brand-700` → `rounded-full bg-brand-700` (§1.3/§7.7 — `rounded` is off-scale). (c) `tabular-nums` on `paywall-price-annual`/`-monthly`/`-family` Texts. Snapshot-bearing — re-record.

### Screens — activity (Peak-End on sheet-save)
- `apps/mobile/app/activity/[petId].tsx` — add an INDEPENDENT confirmation for the `handleSheetSave` success path (the recents deferred-undo machinery is untouched — decision R4). New state `sheetSavedLabel: string | null` + a dedicated `useRef` timer; in the sheet-save `onSuccess` (after existing `haptics.success()` / `addRecent` / `setSheetType(null)`) set the label (built from the saved `activityType` + input via `recentEntryLabel`) and render `<SaveConfirmation testID="activity-saved-confirmation" message={strings.activity.loggedConfirmation(sheetSavedLabel)} nudge={strings.activity.savedNudge}/>` in the scroll header region; auto-clear via ref'd `setTimeout(…, 2500)` cleared on unmount. Do NOT alter `commitEntry`, `flushPendingUndo`, `handleRecentPress`, `handleUndo`, `undoTimerRef`, or `pendingEntryRef`.

### Screens — accent demotion + empty-state value preview
- `apps/mobile/app/care-plan/[petId].tsx` — (a) 60/30/10: `care-plan-skip` PrimaryButton → `GhostButton` (import `GhostButton`; it is the tertiary "Not now", stacked under the primary Confirm — two green buttons is an accent leak). Keep testID + onPress. (b) empty state: pass `body={strings.carePlan.emptyBody}` to the `care-plan-empty` `EmptyState`. (c) `tabular-nums` on each `care-plan-date-*` Text. Thumb-zone footer NOT applied (see R3).
- `apps/mobile/app/family.tsx` — 60/30/10: `family-leave-cancel` PrimaryButton → `GhostButton` (tertiary Cancel under the destructive-primary Leave). Keep testID + onPress. No other change.
- `apps/mobile/app/(tabs)/care.tsx` — empty state: pass `body={strings.agenda.emptyBody}` to the `agenda-empty` `EmptyState`. (Tab/browse → thumb-zone exempt; agenda times get `tabular-nums` via `agenda-item.tsx` above.)
- `apps/mobile/app/(tabs)/timeline.tsx` — empty state: pass `body={strings.timeline.emptyBody}` to the `timeline-empty` `EmptyState`.
- `apps/mobile/app/add-pet/details.tsx` — §7.3 weight discipline: the sex-label Text and the neutered-label Text `text-sm font-medium text-brand-900` → `text-sm font-semibold text-brand-900` (2 instances). No other change (WizardScaffold footer already satisfies thumb-zone).

### Strings
- `apps/mobile/src/strings.ts` — add keys (record-only; see enumeration below).

### Tests (create/modify)
- `apps/mobile/__tests__/save-confirmation.test.tsx` — NEW.
- `apps/mobile/__tests__/craft1-strings-tone.test.ts` — NEW (tone scan over new strings).
- `apps/mobile/__tests__/craft1-craft.test.tsx` — NEW (mechanical §7 assertions on components without a dedicated test: agenda-item due-time, today-preview time, timeline-row date `tabular-nums`).
- `apps/mobile/__tests__/screen-scaffold.test.tsx` — MODIFY (footer renders below scroll).
- `apps/mobile/__tests__/note-screen.test.tsx` — MODIFY.
- `apps/mobile/__tests__/vet-visit-screen.test.tsx` — MODIFY.
- `apps/mobile/__tests__/weight-screen.test.tsx` — MODIFY.
- `apps/mobile/__tests__/activity-screen.test.tsx` — MODIFY.
- `apps/mobile/__tests__/activity-quantity-sheet.test.tsx` — MODIFY (`tabular-nums` on value).
- `apps/mobile/__tests__/reminder-edit.test.tsx` — MODIFY (footer save present; med-mode still null).
- `apps/mobile/__tests__/care-plan-wizard.test.tsx` — MODIFY (empty body; skip is Ghost, not primary fill).
- `apps/mobile/__tests__/family-screen.test.tsx` — MODIFY (leave-cancel is Ghost, not primary fill).
- `apps/mobile/__tests__/timeline-screen.test.tsx` — MODIFY (empty body present).
- `apps/mobile/__tests__/agenda-screen.test.tsx` — MODIFY (empty body present).
- `apps/mobile/__tests__/pet-home-snapshot.test.tsx` — MODIFY (re-record 4 snapshots).
- `apps/mobile/__tests__/paywall-snapshot.test.tsx` — MODIFY (re-record snapshot).
- Snapshot files under `apps/mobile/__tests__/__snapshots__/` for the two above — regenerate via `jest -u` (pet-home + paywall ONLY).

---

## New strings (record-only; every one listed for the §7 tone scan)
Add under the matching existing objects in `strings.ts`:
- `weight.savedConfirmation` = `"Weight saved."`
- `weight.savedNudge` = `"It's on the chart."`
- `note.savedConfirmation` = `"Note saved."`
- `note.savedNudge` = `"It's on the timeline."`
- `vetVisit.savedConfirmation` = `"Visit saved."`
- `vetVisit.savedNudge` = `"It's on the timeline."`
- `activity.savedNudge` = `"It's on the timeline."` (message reuses existing `activity.loggedConfirmation(label)`)
- `agenda.emptyBody` = `"Reminders you add will show up here so nothing slips by."`
- `timeline.emptyBody` = `"Once you log weight, notes, or visits, they'll appear here as a running history."`
- `carePlan.emptyBody` = `"When suggestions are ready, you'll be able to add them to your reminders here."`

Tone rules the executor must hold for EVERY string above: no `diagnos*`, no medication/dosing tokens, no outcome/health claims (`healthy`, `healthier`, `better`, `cure`, `treat`, `improve`, `prevent`), no streak/pressure framing. Pure record-keeping.

---

## Per-screen §7.8 audit result (delta OR verified-no-change)
| Screen | §7 delta applied | Verified-no-change items |
|---|---|---|
| home `(tabs)/index` | (via `today-preview-card` tabular-nums) | 60/30/10 ok; ≤4 sizes; gradient signature; empty hero already previews value |
| pet profile `pets/[id]` | (via `pet-header-card` font-medium→semibold) | CTA already pinned above scroll; accent = single primary CTA |
| auth welcome/email/otp/done | none | centered non-scroll single-action, CTA reachable; ≤4 sizes/2 weights; safety-free |
| push-rationale | none | centered single-action, GhostButton skip already correct |
| join | none | centered confirm screen |
| add-pet species/breed/photo/done | none | WizardScaffold already bottom-pins footer |
| add-pet details | font-medium→semibold (2) | WizardScaffold footer ok |
| care/agenda `(tabs)/care` | empty-state body; (agenda-item tabular-nums) | tab → thumb-zone exempt; Primary+Secondary hierarchy correct |
| timeline `(tabs)/timeline` | empty-state body; (timeline-row tabular-nums) | tab; SectionList page-contract per prior sweep |
| weight | footer-pin add button; unit-toggle weight; save confirmation | numeric weight values live in `weight-chart` (snapshot NOT in this batch's scope) → tabular-nums deferred |
| note | footer-pin save; save confirmation | fields already TextField/canon |
| vet-visit | footer-pin save; save confirmation | record-only fields, no dose field (kept) |
| activity | sheet-save confirmation; (sheet tabular-nums + weight) | recents undo banner already the peak; grid is browse → no single-CTA pin |
| care-plan | skip→Ghost; empty body; date tabular-nums | footer-pin deferred (R3) |
| reminders/edit | footer-pin save; startdate tabular-nums | Chip/ScheduleBuilder canon |
| paywall | footer-pin CTA; badge radius; price tabular-nums; success notice = warm ending | ≤4 sizes; annual highlight = the ~10% accent |
| family | leave-cancel→Ghost | list/browse → thumb-zone exempt; empty is an error-state, not teachable |
| settings `(tabs)/settings` | none | list/browse; ListRow canon; semantic notice colors |
| settings/notifications | none | settings form; Chip/ListRow/tints canon; not a single-action funnel (R3) |

---

## Ordered steps (with checkpoint suite runs)
1. **Strings** — add the 10 keys to `strings.ts` (step-1 so every consumer + the tone test can import them).
2. **New shared** — write `save-confirmation.tsx`; add the `footer` prop to `screen-scaffold.tsx`.
3. **Form refactors** — `add-note-form.tsx` + `add-vet-visit-form.tsx` to `forwardRef` field-group-only with `submit()` handles.
4. **Single-action screens** — edit `note`, `vet-visit`, `weight`, `reminders/edit`, `paywall` (footers + peak-end + radius + tabular-nums).
5. **Activity** — `activity/[petId].tsx` sheet-save confirmation + `activity-quantity-sheet.tsx` tabular-nums/weight.
6. **Craft components** — `agenda-item`, `today-preview-card`, `timeline-row`, `pet-header-card`.
7. **Accent/empty screens** — `care-plan`, `family`, `care`, `timeline`, `add-pet/details`.
8. **Tests** — write the 3 new test files; update the listed existing tests; regenerate ONLY pet-home + paywall snapshots (`jest -u` scoped to those two files).
9. **Checkpoint A (fast loop, run after step 5 and again after step 7):** `pnpm --filter mobile test` on the touched suites.
10. **Checkpoint B (full gate, final):** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. `packages/ai` is untouched → no `test:ai-evals` required.

---

## Tests to write (map to acceptance criteria)
- **Thumb-zone (§7.4)** → `screen-scaffold.test.tsx`: renders `screen-scaffold-footer` below the scroll when `footer` supplied, and does NOT render it (identical tree) when omitted. → `note-screen.test.tsx`/`vet-visit-screen.test.tsx`/`weight-screen.test.tsx`/`reminder-edit.test.tsx`: the save button (`add-note-save`/`add-vet-visit-save`/`weight-add-button`/`reminder-save`) resolves and is a descendant of `screen-scaffold-footer`; reminder-edit med-mode keeps `reminder-save` null.
- **Peak-End confirmation (§7.5)** → `note-screen.test.tsx`: valid save shows `note-saved-confirmation`; with fake timers, `router.back()` is called exactly once AFTER advancing `CONFIRM_MS` (preserves the existing "back called once" assertion, un-weakened); mutation still called with `{ text, photoKeys }`. Same shape for `vet-visit-screen.test.tsx`. → `weight-screen.test.tsx`: after a valid add, `weight-saved-confirmation` appears then clears after its timer; no navigation. → `activity-screen.test.tsx`: a sheet Save shows `activity-saved-confirmation` then clears; the recents-undo path (`activity-undo-banner`/`activity-undo-button`) still behaves exactly as before (deferred commit + Undo).
- **SaveConfirmation unit** → `save-confirmation.test.tsx`: renders `message`, optional `nudge`, `accessibilityRole="alert"`; no dismiss control.
- **Type/`tabular-nums` (§7.3)** → `craft1-craft.test.tsx`: `agenda-item` due-time, `today-preview` row time, `timeline-row` date Texts have `tabular-nums` in className. → `activity-quantity-sheet.test.tsx`: `activity-quantity-value` className contains `tabular-nums`. → `paywall-snapshot` snapshot captures `tabular-nums` prices + `rounded-full` badge.
- **60/30/10 accent (§7.1)** → `care-plan-wizard.test.tsx`: `care-plan-skip` className has no `bg-brand-700` primary fill (Ghost). → `family-screen.test.tsx`: `family-leave-cancel` className has no `bg-brand-700` fill; `family-leave-confirm-button` still primary.
- **Empty-state value preview (§7.6)** → `agenda-screen.test.tsx` (`agenda.emptyBody` present in `agenda-empty`), `timeline-screen.test.tsx` (`timeline.emptyBody`), `care-plan-wizard.test.tsx` (`carePlan.emptyBody`).
- **§7 tone scan** → `craft1-strings-tone.test.ts`: over the 10 new strings (and `activity.savedNudge`), assert none match `/diagnos/i`, the dosing pattern (mirrors `intake-descriptors.test.ts`), nor an OUTCOME/HEALTH-CLAIM pattern `/(healthy|healthier|cure|\btreat|improve|\bbetter\b|prevent)/i`.
- **Snapshots** → `pet-home-snapshot.test.tsx` + `paywall-snapshot.test.tsx` re-recorded (`jest -u`), reviewed to contain only the intended §7 diffs (font-semibold chips; footer CTA / `rounded-full` / `tabular-nums`).

---

## Interfaces/contracts the executor must match
- `SaveConfirmation`: `{ testID?: string; message: string; nudge?: string }` → `alert`-role banner.
- `ScreenScaffold`: add `footer?: ReactNode` to `ScreenScaffoldProps`; footer region testID `screen-scaffold-footer`; ZERO change when `footer` is absent.
- `AddNoteForm` → `forwardRef<AddNoteFormHandle>`, `AddNoteFormHandle = { submit: () => void }`; renders field group only; props otherwise unchanged (`{ petId, submitting, onSubmit }`). `AddVetVisitForm` → `forwardRef<AddVetVisitFormHandle>` analogously.
- Every relocated button keeps its EXACT prior `testID`, `label` (via `strings`), `loading`, and `onPress`/submit semantics.
- `CONFIRM_MS` (note/vet-visit back defer) = 1200; weight/activity confirmation auto-clear = 2500. All timers stored in `useRef`, cleared in an unmount effect.

## Out of scope / do NOT touch
- Any `check/**`, `intake/**`, emergency, result, `<VetDisclaimer/>`, `medication-course-form`, `MEDICATION_STATIC_COPY`, dosing copy (batch 2 / safety-pinned).
- `packages/config/tailwind-preset.mjs`, `packages/types`, api, web — no token, schema, or backend changes.
- `weight-chart.tsx` (+ its snapshot), `check-result`/other snapshots — only pet-home + paywall snapshots may be re-recorded.
- No navigation targets, store shapes, mutation payloads, query keys, or `router.*` destinations changed. No new dependencies. `home/index`, `settings`, `notifications`, `pets/[id]`, auth screens, `join`, `push-rationale`, `species/breed/photo/add-pet-done`, `quick-actions.tsx`, `pet-hero-card.tsx`, `empty-home-state.tsx` — NOT edited (verified-no-change; pet-home snapshot changes only via the `pet-header-card` child).

## Risks & the design decisions the planner made (scrutinize)
- **R1 (save-confirmation mechanism).** Peak-End confirmations use new LOCAL state + a `useRef` timer only. For the two screens that navigate away (note, vet-visit) the timer defers the EXISTING `router.back()` by `CONFIRM_MS`; the mutation fires and completes un-delayed — only navigation waits so the banner is briefly visible ("brief banner before back," card-sanctioned). Weight/activity stay on-screen and merely auto-dismiss. Consequence: `note`/`vet-visit` tests must advance fake timers to observe `router.back()` — the "called exactly once" assertion is preserved, not weakened. Alternative (confirm on destination) rejected: no toast infra exists app-wide.
- **R2 (footer via ScreenScaffold + forwardRef).** Bottom-pinning note/vet-visit required hoisting the save button out of the form into the scaffold `footer`; done by making the two forms `forwardRef` field-groups exposing `submit()` — validation logic stays inside the form, only the button relocates, all testIDs preserved. This is presentation/structure, not business logic. The `footer` prop is additive (default off), so all other scaffold callers are unchanged.
- **R3 (care-plan / notifications NOT footer-pinned).** The card's thumb-zone list enumerates weight/note/vet-visit/reminders-edit/paywall/add-pet only. care-plan (multi-item review) and notifications (settings form) are not named and are not pure single-action funnels; footer-pinning them would over-churn un-enumerated screens (planner over-engineering rule). Recorded as a deliberate verified-defer; their other §7 deltas (care-plan skip→Ghost/empty body/date nums) still apply.
- **R4 (activity dual-timer separation).** The new sheet-save confirmation uses its OWN state + timer, fully separate from the delicate recents deferred-undo machinery (`pendingEntryRef`/`undoTimerRef`/`flushPendingUndo`, which prior review flagged as B1-sensitive). No shared state; the undo path is byte-unchanged. Both timers clear on unmount.
- **R5 (`tabular-nums` availability).** §7.3 prescribes the `tabular-nums` class as the mechanism; it is a stock Tailwind/NativeWind utility not present in `packages/config`. If it does NOT resolve at runtime, the executor must STOP and write `loop/plans/CRAFT-1.blocked.md` (do NOT edit `packages/config`, which is out of scope) rather than fall back to an inline `fontVariant` style object (§6 forbids static inline styles).
- **R6 (snapshot scope).** Only pet-home and paywall snapshots are authorized for re-record. The pet-home diff must be limited to `pet-header-card` chip weight; the paywall diff to the footer CTA relocation, `rounded-full` badge, and `tabular-nums` prices. Any other snapshot going red means an unintended reach — stop and reassess.
- **R7 (accent demotions are copy/style-only).** `care-plan-skip` and `family-leave-cancel` change from PrimaryButton to GhostButton (same testID/onPress). GhostButton exists and is imported already elsewhere; this is presentational hierarchy correction (§7.1/§2.9 one-primary-per-region), not a logic change.
