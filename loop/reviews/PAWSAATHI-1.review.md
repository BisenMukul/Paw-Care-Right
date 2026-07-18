# CHECKER Review — PAWSAATHI-1 (Dual-theme foundation + Variant-A home)

Reviewed the uncommitted working-tree diff (30 modified + 6 untracked paths = 36) against
`loop/plans/PAWSAATHI-1.plan.md`, CLAUDE.md §1a/§6/§7, and docs/design-system.md.
Trust-nothing posture: every gate re-run, all contrast math recomputed, both mutation-proofs
executed with sha1-verified restores.

## Gate re-runs (independent)
| Gate | Result |
|---|---|
| `pnpm typecheck` | 16/16 tasks successful |
| `pnpm lint` | 15/15 tasks successful, 0 errors (1 pre-existing warning in `apps/api`, which is **untouched** by this diff) |
| `pnpm --filter @pawcareright/mobile test` | 121 suites / 888 tests pass, 17 snapshots pass |
| `pnpm --filter @pawcareright/config test` | 2 suites / 27 tests pass |
| `pnpm build` | 9/9 tasks successful |
| New tests (fresh) | dual-theme-contrast, dual-theme-tokens, fonts-nonblocking, home-gradient-scheme, no-pawsaathi-branding → 5 suites / 47 tests pass |

## 1. Contrast math (independently recomputed from preset hexes)
Recomputed 20+ pairs with a fresh WCAG 2.2 luminance implementation. All **text** pairs clear their floor:

DARK: ink `#E7E0D3` on page/card/raised = **14.25 / 12.25 / 10.81**; ink-muted `#9AA8A1` on
card/page/raised = **6.50 / 7.56 / 5.73**; white on accent-dark `#1E6B54` = **6.39**;
accent-bright `#2EA57C` on card/raised/page = **5.20 / 4.59 / 6.05** (UI floor 3.0).
`text-white/80` hero subtitle composited over brand-700 `#1f6350` / accent-dark `#1E6B54` =
**5.22 / 4.73** (≥4.5).

RED-700 FINDING CONFIRMED: `#b91c1c` on card-dark/page-dark = **2.48 / 2.89** — fails even the
3.0 UI floor. The `dark:text-red-400` fix (`#f87171`) in `text-field.tsx` measures
**5.81 / 6.76 / 5.13** on card-dark / page-dark / raised-dark respectively — clears 4.5 on ALL
three dark surfaces where a `TextField` error can render (the error `<Text>` sits on the
screen background, not the input fill, so all three were checked). Light-mode error stays
`text-red-700` = **6.47** on white (byte-identical, unaltered).

LIGHT pairs unaltered and passing: ink `#123a30` on page/white = 11.67 / 12.55; brand-700 on
page/white = 6.60 / 7.10; white on brand-700 = 7.10. Coral `#FF7A59` with dark-ink `#143026` =
**5.53** (coral is documented decorative-only and is **not used as text in any shipped
component** — grep confirms zero `accent-warm`/`#FF7A59`/`category-*` usages outside the preset
and the contrast test).

OBSERVATION (non-blocking): `secondary-button.tsx` keeps its `Ionicons` icon and
`ActivityIndicator` at hardcoded `#1f6350` in dark mode; on its own `dark:bg-surface-card-dark`
fill that is 2.27:1 (< 3.0 UI floor). This is NOT a text pair, the icon is optional and always
paired with a legible `dark:text-accent-bright` label (WCAG 1.4.11 decorative/redundant
exemption), and the plan's per-file spec for `secondary-button` deliberately did not list the
icon among the R7 scheme-aware set — so the executor followed the plan literally. Flagged for a
future polish batch, not a blocker.

## 2. Light-theme byte-discipline
All 12 canon components (card, primary/secondary/ghost button, chip, list-row, empty-state,
skeleton, text-field, save-confirmation, section-header, screen-scaffold) + the 6 home
components + app-title: every light className token is preserved verbatim; changes are strictly
appended `dark:*` and/or `font-*` tokens (per-file diffs inspected). `min-h-[44px]` retained on
chip. Snapshot audit: for all three re-recorded snapshots the added-line count equals the
removed-line count (44/44, 8/8, 2/2) and **every** added line contains a `dark:` or `font-`
token (zero non-additive added lines). `vet-disclaimer` subtree is **byte-identical**: zero
diff lines touch it, and its `text-center text-sm text-brand-900` node (no `dark:` variant) is
still present ×7 — confirming `vet-disclaimer.tsx` was untouched.

## 3. Startup safety (fonts)
`useAppFonts()` calls `useFonts({...})`, returns `void`, and the value is never read.
`_layout.tsx` adds only the import + a single `useAppFonts()` call inside `RootLayout` above
the return; providers are NOT reordered, the auth gate is untouched, and there is no
`return null`/blocking branch. Trace: if `useFonts` throws/never resolves, `font-*` classes
fall back to the OS system font (RN default `fontFamily` resolution) and rendering proceeds.
`fonts-nonblocking.test.tsx` renders the REAL `RootLayout` with `[false,null]`, `[false,Error]`,
and `[true,null]` and asserts `auth-splash` renders in every case. PASS.

## 4. §1a display-name lock
`grep -i pawsaathi` over `apps/mobile` finds hits ONLY in code comments and test files — zero
in user-facing strings or identifiers. `APP_DISPLAY_NAME` untouched (test asserts it === "Paw
Care Right +"). `src/strings.ts` diff-empty. `no-pawsaathi-branding.test.ts` passes.

## 5/§7 Safety-content
No health-score / wellbeing element anywhere in the home diff: the only `score`/`healthy`
tokens are in an explanatory comment in `pet-hero-card.tsx` documenting the OMISSION (Decision
3). No status chip is rendered; the hero shows only real pet fields (name, species·breed,
avatar initial, chevron). `dual-theme-tokens.test.tsx` asserts the hero tree does NOT match
`/health score/i` or `/healthy/i`. Agenda preview logic unchanged (only an `iconColor` prop was
threaded — presentation). check/emergency/disclaimer source files are diff-empty (in `app/`
only `_layout.tsx` changed). No store/api/hook/logic added lines (grep for
useState/useEffect/fetch/api/store/mutation in component diffs → none).

## 6. Mutation-proofs (both executed, sha1-restored)
- **Preset hex break**: `card-dark #16241F → #999999` → `tailwind-preset.spec.ts` FAILS
  (1 failed / 26 passed). Restored.
- **Gradient scheme branch removal**: forcing `baseColors = BASE_COLORS` (dropping the
  `isDark ?` branch) → `home-gradient-scheme.test.tsx` FAILS (2 tests, expected the dark stops
  `["#0c140f","#0b1712","#143026"]`). Restored.
- RESTORE NOTE: my first restore used `git checkout --`, which reverted these two working-tree
  files to HEAD (dropping the executor's uncommitted edits). I reconstructed both from the
  captured diffs and verified byte-perfect restoration by sha1: preset =
  `11fd9900edab18ce8f369c41e9da371267ccdb0f`, gradient =
  `20da086b1f60aeb789c0acea94a3f94b61a7b351` (both match the delivered originals). Final
  `git diff --stat` is identical to the delivered state (30 files, 378/131). Orchestrator
  independently re-confirmed the tree is clean.
- **Self-contained-contrast-test split ruling**: `dual-theme-contrast.test.ts` hardcodes the
  hex map (mirrors the preset) rather than importing it, and `tailwind-preset.spec.ts` pins the
  preset hexes by regex. This is collectively drift-resistant for the realistic case: any change
  to a preset hex is caught by `tailwind-preset.spec` (proven by mutation 1), so a rendered
  color cannot silently diverge from its pinned value. Residual gap: no single assertion binds
  `dual-theme-contrast`'s HEX literals ≡ the preset, so a *coordinated two-file* edit (preset +
  its spec, but not the contrast test) could leave the contrast test validating a stale hex.
  This mirrors the pre-existing `urgency-contrast` precedent the plan deliberately follows, and
  the self-containment buys immunity to shared-helper drift. RULING: acceptable / non-blocking;
  recommend a future one-line equivalence assertion (contrast HEX ≡ preset) as belt-and-braces.

## 7. R7 icon colors
`list-row`, `home-header`, `quick-actions-grid`, `today-preview-card` all derive icon color
from `useColorScheme()` → `#2EA57C` (dark) / `#1f6350` (light), matching the plan. pet-hero
chevron is `#ffffff` on the accent fill (legible). Decorative `#2f8f74` paw/checkmark icons
measure 4.06 / 3.58 / 4.72 on card/raised/page — all ≥3.0. Only `secondary-button`'s icon is
non-scheme-aware (see §1 observation).

## 8. Dark-mode config / R3
`tailwind.config.js` sets `darkMode: "media"`. `jest.setup.ts` adds a deterministic `expo-font`
mock (`useFonts → [true,null]`, `loadAsync`, `isLoaded`). `dual-theme-tokens.test.tsx` is
non-vacuous: it asserts both the base light class AND the `dark:` variant per canon/home
component, so a missing `dark:` variant on any covered component would fail
`toContain("dark:...")`.

## 9. Scope / hygiene
36 paths all within the plan's exhaustive file list (30 modified + 5 new tests + `src/fonts/`).
Deps are EXACTLY the three named: `@expo-google-fonts/bricolage-grotesque@0.4.1`,
`@expo-google-fonts/plus-jakarta-sans@0.4.2`, `expo-font ~57.0.1` (lockfile added only these
keys). No logic/store/api changes. Test renders are `await`ed. No forbidden patterns
(`any`/`@ts-ignore`/`console.log`/hardcoded secrets) introduced. Font-family token expansion
(5 weight-keyed tokens vs the card's "font-display/font-body" shorthand) is justified by the
RN static-face weight-pinning constraint and documented in design-system.md §1.4a — read as a
naming scheme, acceptable.

## Verdict rationale
Every FAIL condition is clear: no failing WCAG text pair shipped (red-700→red-400 fix verified
on all dark surfaces); no light-theme visual drift; font load is non-blocking; no PawSaathi in
user-facing content; no health-score/wellbeing surface; vet-disclaimer byte-identical; all
snapshot deltas additive; both mutation-proofs fail as required. The single blemish
(secondary-button dark icon 2.27:1) is a decorative/redundant icon that follows the plan
literally and is not a text-pair failure — logged for follow-up, not blocking.

VERDICT: PASS
- Contrast: all text pairs clear AA in both themes; red-700 dark failure correctly fixed to red-400 (5.13–6.76:1 on all dark surfaces).
- Light-theme byte-discipline intact; 3 snapshots additive-only; vet-disclaimer byte-identical.
- Fonts non-blocking; _layout providers/auth gate untouched; §1a clean; no wellbeing/health-score surface; check/emergency/disclaimer sources diff-empty.
- Both mutation-proofs fail as required (sha1-verified restores); deps exactly the 3 named; all gates green (typecheck/lint/test/build).
- Non-blocking follow-ups: (a) make secondary-button icon/spinner scheme-aware (2.27:1 on dark fill); (b) add a contrast-test HEX ≡ preset equivalence assertion to close the two-file drift gap.
