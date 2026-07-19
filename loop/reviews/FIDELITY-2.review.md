# CHECKER Review — FIDELITY-2 (cream page token + 28-file page migration + colorful icon tiles + care-hub green hero)

Reviewer: CHECKER (adversarial). Scope: uncommitted working-tree diff (57 porcelain paths) vs
`loop/plans/FIDELITY-2.plan.md`, ground-truth mockup premise, design-system.md, PRODUCT_SPEC §5, CLAUDE §7.

## Gates (independently re-run)
- `pnpm typecheck` → exit 0.
- `pnpm lint` → exit 0 (turbo, 15/15).
- `pnpm --filter mobile test` → **143 suites / 1100 tests / 17 snapshots, exit 0** (matches orchestrator).
- `pnpm --filter @pawcareright/config test` → exit 0.
- `pnpm build` → exit 0.
- No `package.json` / `pnpm-lock` change → **no new dependencies**. 57 porcelain paths (56 modified + 1 untracked `colorful-icon-tiles.test.tsx`) — matches claim.

## What PASSES (verified, not trusted)

### Token layer
`packages/config/tailwind-preset.mjs` adds `surface.page:"#F4EFE6"`, `card:"#FFFFFF"`, `raised:"#E7E0D3"`
additively; every `brand.*` hex byte-identical (16–23 unchanged). Correct per R1.

### Snapshot audit (git HEAD vs working tree — every delta on the claimed list, nothing else)
- **pet-home** (`app/pets/[id]`): ONLY the two gradient stop-arrays flip mint→cream
  (`#f2f8f6/#dcece6`→`#F4EFE6/#EAE3D6`, `#f2f8f6/#eef7f1`→`#F4EFE6/#F1EBDD`). CareScoreCard is on
  `(tabs)/index.tsx`, NOT this screen, so the hero legitimately does not appear here.
- **paywall**: root SafeAreaView + footer `View` only (`bg-brand-50`→`bg-surface-page`, dark sibling intact),
  ×2 variants. `paywall-unavailable` tint box (`bg-brand-50`) does not render in A/B → untouched.
- **check-result**: exactly 7 single-line root renames (FALLBACK, emergency, EMERGENCY_NOW, MONITOR,
  REASSURE, VET_24H, VET_SOON). Disclaimer subtree **byte-identical** (diff touches only the root line of
  each variant; `vet-disclaimer` `bg-brand-50` unchanged).
- **weight-chart**: not in the modified-files set → genuinely unchanged.

### Mutation-proofs (both re-run, sha1-verified restores)
- **A** — broke cream hex `#F4EFE6`→`#F4EFE7` in preset ⇒ `dual-theme-contrast` preset-sync spec FAILED
  (1 failed). Restored.  *(Note: I first restored via `git checkout --`, which reverted the whole
  UNCOMMITTED file to HEAD; I caught this, reconstructed the executor's exact additive block, and verified
  the file sha `9a85e79f0664bdec1983c07b8a7c5963f4c5fb8d` — working tree is intact.)*
- **B** — planted `"Health looks great"` in `careScore.runCheckCta` ⇒ `fidelity1-strings-tone` FAILED at the
  forbidden-vocabulary scan (line 54, matches `health`/`looks great`). Restored; strings sha
  `b1d0b681207ce9438e7556061cf12fc805790d1e` verified.

### AA math (recomputed independently)
- white on `#1E6B54` hero = **6.39:1** ≥ 4.5 (pass).
- white on mockup `#2EA57C` = **3.09:1** < 4.5 (fails — R4 mutation-proof correct; "~2.5" estimate is
  conservative, conclusion holds).
- ink-900 `#123a30` on cream `#F4EFE6` ≈ **10.95:1**; brand-700 `#1f6350` on cream ≈ **6.20:1** — both pass.

### §5/§7 safety
- Hero copy is Care-Score framing only; the sole new string `runCheckCta:"Run a check"` is record-only
  imperative and passes the §7 vocabulary scan (added to `fidelity1-strings-tone`). FIDELITY-1 label/
  explainer/bucket strings byte-identical.
- Emergency: `app/check/emergency/[checkId].tsx` NOT modified; new guard pins root `bg-red-700` and asserts
  neither `bg-surface-page` nor `bg-brand-50` (R8 verified).
- Disclaimer subtree byte-identical (above). `vet-disclaimer.tsx` `bg-brand-50` frozen (R6).

### Icon-tile AA exemption (per-site)
category-grid / activity-chip-grid / services{index,salons,store,adopt} all render a WHITE icon on a
decorative colored fill with the label BELOW in `brand-900`/`ink-dark` — no text on the fill. The one text-
on-fill site, `services/vets.tsx` (vet initial), sits on `bg-accent-dark` (#1E6B54) in white = 6.39 AA — the
already-verified pair. Original testIDs preserved; new `-tile` testIDs additive.

### 6-file test deviation
`auth-onboarding-a11y`, `check-flow-a11y`, `responsive-reading-columns`, `responsive-scaffold`,
`sweep4-a11y` are pure `bg-brand-50`→`bg-surface-page` substring renames in `.includes()`/exact-string
footer assertions (+ describe/it titles + comments); intent and assertion structure unchanged; the
`bg-brand-100` tint check in check-flow-a11y is correctly left intact. `home-gradient-scheme` is a
consequential fixture tracking the source `BASE_COLORS`/fallback constant. All assertion-preserving.

### Dark-theme coherence
All `dark:` classes unchanged; `bg-surface-page-dark` untouched everywhere; only the authorized hero
(`bg-accent-dark`, identical in both schemes, no `dark:` needed) added. Spot-checked screen-scaffold,
wizard-scaffold, care-score-ring (`onDark` default false = byte-unchanged path), animated-gradient (dark
stops unchanged), category/activity tiles (`dark:bg-surface-card-dark` cards preserved).

## BLOCKING DEFECT — page root missed (R2 partition miss)

**`apps/mobile/src/components/intake/intake-form.tsx:83`** remains
`<SafeAreaView testID="intake-form" className="flex-1 bg-brand-50 dark:bg-surface-page-dark">` — it was
left on the denylist, but it is **semantically a PAGE ROOT, not an e0 tint**:

1. It is a `flex-1` `SafeAreaView` — the plan's own §B rule migrates exactly these ("screen-level root …
   flex-1 … incl. full-screen state roots"). The general denylist rule ("any `bg-brand-50` that is NOT a
   screen root") therefore *excludes* it — the plan contradicts itself by also naming it by filename.
2. It is the `flex-1` root content of `app/check/[category].tsx:127`, rendered inside that screen's cream
   `<View bg-surface-page>`. Being flex-1 and non-absolute, its own `bg-brand-50` **paints over** the parent
   cream ⇒ the symptom-check intake wizard renders MINT while every sibling loading/error/offline/quota
   state in the SAME file (lines 54, 71, 81, 95, 116) renders cream.
3. Its dark pairing is `dark:bg-surface-page-dark` — the PAGE token (not `surface-raised-dark`/`card-dark`).
   `check-flow-theme.test.tsx:180` asserts precisely this, so the repo's own taxonomy classifies it a page.
4. It directly **falsifies the executor's claimed "100% partition / `dark:bg-surface-page-dark` pairing =
   page root → migrated"**: intake-form has that exact pairing and was NOT migrated. The "clean
   discriminator / 100% partition" claim is untrue.

The plan's rationale for denylisting it ("small tinted controls on white cards … low-salience secondary
delta", R3/R7) is factually inapplicable to a full-screen `SafeAreaView` on a core product flow. Net user-
visible effect: a primary screen stays mint against the batch's entire cream-parity objective.

Fix (trivial, low-blast): change `intake-form.tsx:83` `bg-brand-50` → `bg-surface-page` (keep
`dark:bg-surface-page-dark`). No test pins the light class (`check-flow-theme.test.tsx` only asserts the
dark token); intake-form is not in any pinned snapshot, so no re-record is needed. Planner should also
remove intake-form from the §B denylist. The other 10 denylist tints (vet-disclaimer, save-confirmation,
quick-actions-grid, home-header, pet-header-card, today-activity-strip, activity undo banner, paywall
unavailable box, adopt-detail listed-by box, settings retry button) are genuine tints (all paired with
`dark:bg-surface-raised-dark`/`card-dark` on small controls) and are correctly preserved.

## Conclusion
Every gate is green and every other duty passes cleanly — snapshots, both mutation-proofs, cream + hero AA,
§5/§7 safety (disclaimer + emergency zero-diff), tiles, hero, the 6-file deviation, dark coherence, scope,
deps, testIDs. The single blocking issue is one page root (`intake-form.tsx`) left mint, which trips the
explicit FAIL trigger "a page root missed" and contradicts the executor's stated partition guarantee. It is
a one-line fix but a real, user-visible fidelity miss on a core flow, so it must be corrected before merge.

VERDICT: FAIL — `apps/mobile/src/components/intake/intake-form.tsx:83` is a page root left on `bg-brand-50`
(mint) instead of `bg-surface-page` (cream). It is a `flex-1` SafeAreaView that is the root content of the
symptom-check intake screen, paints over the parent cream, is dark-paired to the PAGE token, and falsifies
the executor's claimed 100% page/tint partition. All other acceptance criteria pass. Migrate that one class
(keep the dark sibling) and remove it from the plan denylist; no test or snapshot re-record is required.
