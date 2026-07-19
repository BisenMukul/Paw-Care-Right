# Plan — FIDELITY-2: cream-light ground-truth correction + colorful icon tiles + care-hub green hero

## Objective (from card)
Correct the mis-read that the app screens are dark: the in-phone light surfaces are **warm cream**
(page `#F4EFE6`, white cards). Shift the LIGHT page surface to cream via an additive semantic token,
apply the mockup's signature colorful rounded-square icon tiles (white icon, dark label below), and
restyle the CareScore surface into the deep-green hero (ring + white text + white pill CTA). VISUAL
parity only — zero business logic, every §7-frozen copy string byte-identical, every safety surface
(disclaimer, emergency, dosing) untouched, every `testID` preserved.

## Ground-truth audit (what the mockup HTML + screenshots actually say)
Verified against `docs/design/pawsaathi.dc.html` (the `C` palette, lines 459-463 + inline styles) and the
three rendered screenshots (`docs/design/screenshots/{01-care,02-care,carehub}.png` — all show a cream
field behind white cards inside the phone; the `#0c140f` radial is OUTSIDE the frame only).

Per-surface classification INSIDE the phone frame:
- **Cream page** `#F4EFE6` (`C.paper`) — the inner-screen scroll container background (`.dc.html` line 31).
  Secondary cream tones: `#F1EBDD` (in-card dividers, `border-bottom`), `#E7E0D3` (`C.line`, hairlines/
  borders), `#EAE3D6` (segmented-control track, tab-bar top border).
- **White** `#FFFFFF` (`C.card`) — every card/tile/list-row/sheet surface. **Already what the app uses**
  (`bg-white`) ⇒ card layer is ALREADY at parity; no card migration needed.
- **Dark inks on cream/white** — `#143026` (`C.ink`, headings/back-buttons), `#16241F` (`C.text`, card
  titles/body), `#6E827A` (`C.muted`, secondary), `#9AA8A1` (faint/meta).
- **Deep-green surfaces INSIDE the frame** (NOT the page): the care-hub hero gradient
  `linear-gradient(150deg,#2EA57C,#1E6B54)` (line 143), the home companion hero `#1E6B54→#143026`
  (line 60), the food card `#143026→#1E6B54`, the feed header `#143026`, book/insurance banners. These
  are intentional colored CARD surfaces, not the page — they stay dark in BOTH themes.
- **Colorful icon tiles**: rounded-square (`border-radius:13px`) fills with WHITE stroke icons and the
  label BELOW in dark ink. Exact hexes (all already present as preset tokens):
  `#2EA57C`=accent.bright, `#4C9BD6`=category.sky, `#FF7A59`=accent.warm, `#F6A623`=category.amber,
  `#8B7BD8`=category.lilac, `#1E6B54`=accent.dark, `#143026`=surface.raised-dark. Icon-on-fill is
  **decorative** (icon only; text lives below on white/cream) ⇒ AA-exempt per the card + design-system §4.6.

## Files to create/modify (exhaustive — executor may touch NOTHING else)

### A. Token layer (do FIRST) — `packages/config`
- `packages/config/tailwind-preset.mjs` — ADD light semantic surface tokens, symmetric with the existing
  dark ones, **additive only**: `surface.page: "#F4EFE6"`, `surface.card: "#FFFFFF"`,
  `surface.raised: "#E7E0D3"`. **DO NOT touch `brand.50`/`brand.100`/`brand.200` or any `brand.*` hex**
  (keeps apps/web byte-identical and the design-system §1.1 brand-contrast table valid; `surface.page`
  is the only new token consumed this batch — `card`/`raised` are added for dark-parity symmetry, wired
  later). No web-app file is touched.

### B. Page-surface migration (cream) — mobile PAGE ROOTS ONLY
Rule the executor MUST apply mechanically: change `bg-brand-50` → `bg-surface-page` **only** on a
screen-level root (`SafeAreaView`/root `View` that is `flex-1` and fills the screen, incl. full-screen
loading/error/offline/empty state roots). The paired `dark:bg-surface-page-dark` stays unchanged. NEVER
change `bg-brand-50` on a tile/card/box/banner/pill/disclaimer (those are e0 TINT surfaces — see denylist).
- `apps/mobile/src/components/screen-scaffold.tsx` — the two `SafeAreaView` roots + the footer `View`
  (3 occurrences). This one file re-colors ~30 screens' page.
- `apps/mobile/src/components/wizard-scaffold.tsx` — wizard page root(s) only.
- Full-screen-STATE roots (loading/offline/error/empty `SafeAreaView`s that hardcode `bg-brand-50` as the
  page): `apps/mobile/app/(tabs)/care.tsx`, `apps/mobile/app/(tabs)/timeline.tsx`,
  `apps/mobile/app/(tabs)/settings.tsx`, `apps/mobile/app/paywall.tsx`,
  `apps/mobile/app/check/result/[checkId].tsx`, `apps/mobile/app/check/[category].tsx`,
  `apps/mobile/app/check/waiting/[checkId].tsx`, `apps/mobile/app/check/history/[petId].tsx`,
  `apps/mobile/app/check/index.tsx`, `apps/mobile/app/services/adopt-detail.tsx`,
  `apps/mobile/app/activity/[petId].tsx`, `apps/mobile/app/family.tsx`,
  `apps/mobile/app/settings/notifications.tsx`, `apps/mobile/app/vet-visit/[petId].tsx`,
  `apps/mobile/app/note/[petId].tsx`, `apps/mobile/app/weight/[petId].tsx`,
  `apps/mobile/app/coming-soon.tsx`, `apps/mobile/app/push-rationale.tsx`,
  `apps/mobile/app/join/[code].tsx`, `apps/mobile/app/add-pet/done.tsx`,
  `apps/mobile/app/reminders/edit.tsx`, `apps/mobile/app/care-plan/[petId].tsx`,
  `apps/mobile/app/(auth)/done.tsx`, `apps/mobile/app/(auth)/otp.tsx`,
  `apps/mobile/app/(auth)/email.tsx`, `apps/mobile/app/(auth)/welcome.tsx`.
- `apps/mobile/src/components/home/animated-gradient-background.tsx` — swap the LIGHT stop arrays
  (`BASE_COLORS`/`OVERLAY_COLORS`, raw hexes) to the cream family (`#F4EFE6`/`#ffffff`/`#EAE3D6` +
  `#fdf8ef`/`#F4EFE6`/`#F1EBDD`) so the home page reads cream, not mint. Dark stop arrays UNCHANGED.
  Text-over-gradient re-verified (see contrast test).

**Denylist — `bg-brand-50` stays byte-identical (e0 TINT, not page):**
`apps/mobile/src/components/vet-disclaimer.tsx` (SAFETY-FROZEN — see R6),
`apps/mobile/src/components/save-confirmation.tsx`, `apps/mobile/src/components/home/quick-actions-grid.tsx`,
`apps/mobile/src/components/home/home-header.tsx`, `apps/mobile/src/components/pet-header-card.tsx`,
`apps/mobile/src/components/intake/intake-form.tsx`, and any `bg-brand-50` that is NOT a screen root.
(These are small tinted controls on white cards; leaving them minty is a bounded, verified-acceptable
secondary delta — see R7. Their `bg-brand-50` class is untouched ⇒ no snapshot churn.)

### C. Colorful icon-tile treatment (both themes; existing tokens only)
- `apps/mobile/src/components/category-grid.tsx` — replace the emoji-glyph white tile with a rounded-square
  colored fill (`rounded-2xl`, per-category color from the schema-driven map) + WHITE Ionicon inside +
  the existing `text-brand-900 dark:text-ink-dark` label BELOW. Per-category color comes from a
  data-driven map keyed on `category.id` (keep it presentational + `INTAKE_CATEGORIES`-driven, no new
  types). Preserve `testID`s `check-category-grid` / `check-category-${id}`.
- `apps/mobile/src/components/activity-chip-grid.tsx` — wrap the `Ionicons` in a colored rounded-square
  tile (per-activity color from `ACTIVITY_TYPE_CONFIG` or a local color map), icon color `#ffffff`, label
  below unchanged. Preserve `activity-chip-grid` / `activity-chip-${type}` testIDs and press feedback.
- Services cards (colored leading icon tile, white icon): `apps/mobile/app/services/vets.tsx`,
  `apps/mobile/app/services/salons.tsx`, `apps/mobile/app/services/store.tsx`,
  `apps/mobile/app/services/index.tsx`, `apps/mobile/app/services/adopt.tsx` — restyle the leading
  icon container to a filled rounded-square with a white icon per the mockup's `svc`/`shopTiles`/`salonCards`
  color assignments. Preserve every `testID`, route, and the `PreviewBanner` (untouched).
  (Scope note: touch ONLY the leading-icon tile styling; do not alter list logic, prices, or copy.)

### D. Care-hub deep-green hero (restyle the existing CareScore surface)
- `apps/mobile/src/components/home/care-score-card.tsx` — restyle the white card into the deep-green hero:
  colored surface (AA-mandated `bg-accent-dark`/`#1E6B54` solid or `#1E6B54→#143026` gradient — NOT the
  mockup's `#2EA57C→#1E6B54`, see R4), white ring + white label/explainer/bucket text, and a white pill CTA
  "Run a check" that routes to the existing `/check` entry (`useRouter().push({ pathname: "/check",
  params: { petId: pet.id } })`). Keeps CareScore data + FIDELITY-1 bucket/label strings verbatim. Preserve
  `home-care-score-card` / `home-care-score-bucket` testIDs; add `home-care-score-cta` testID.
- `apps/mobile/src/components/home/care-score-ring.tsx` — add an `onDark`/variant prop so the ring draws
  WHITE progress + white number when hosted on the green hero (track = translucent white per mockup). Default
  (unhosted) behavior byte-unchanged. Preserve `home-care-score-ring` + sub-testIDs.
- `apps/mobile/src/strings.ts` — add ONE string `careScore.runCheckCta: "Run a check"` (record-only,
  imperative — no health claim). No other string changes.

### E. Tests (create/modify)
- `apps/mobile/__tests__/dual-theme-contrast.test.ts` — extend (see Tests): cream-page ink pairs,
  white-on-hero pass, white-on-`#2EA57C` mutation-proof FAIL, `#F4EFE6` present-in-preset sync.
- `apps/mobile/__tests__/screen-scaffold.test.tsx` — assert the page root renders `bg-surface-page`
  (light) + `dark:bg-surface-page-dark` (unchanged).
- `apps/mobile/__tests__/dual-theme-tokens.test.tsx` — extend token-presence coverage for the tile
  fills / hero surface / `bg-surface-page` (className-literal assertions, per this repo's NativeWind
  jest note).
- `apps/mobile/__tests__/care-score-card.test.tsx` — hero surface class, white-ring variant, `Run a check`
  CTA present + routes to `/check`, states preserved, both themes.
- `apps/mobile/__tests__/care-score-ring.test.tsx` — add the white-variant prop assertions (white stroke/
  number when `onDark`), default path unchanged.
- `apps/mobile/__tests__/fidelity1-strings-tone.test.ts` — add `careScore.runCheckCta` to the §7
  forbidden-vocabulary scan.
- Tile assertions: extend the existing `category-grid` and `activity-chip-grid` tests (whichever cover
  them — e.g. `apps/mobile/__tests__/intake-screen.test.tsx` for category, and the activity logger test
  for chips) to assert white icon + colored tile + label-below + preserved testIDs. If no dedicated test
  exists, create `apps/mobile/__tests__/colorful-icon-tiles.test.tsx`.
- Snapshots to RE-RECORD (sanctioned delta = page-root token flip only): the four pinned
  `apps/mobile/__tests__/__snapshots__/{pet-home,paywall,check-result,weight-chart}-snapshot.test.tsx.snap`.
- `apps/mobile/__tests__/check-result-snapshot.test.tsx` — keep/add the assertion that the
  `vet-disclaimer` subtree is byte-identical (unchanged `bg-brand-50`).

## Ordered steps (token change FIRST, then screens — per card)
1. **Token:** add `surface.page/card/raised` light values to `tailwind-preset.mjs` (brand-* untouched).
2. **Contrast math FIRST:** extend `dual-theme-contrast.test.ts` with the cream-page + hero + mutation-proof
   pairs and run it. **CHECKPOINT A:** contrast test green — this validates every ink/surface pair the
   sweep will produce BEFORE any screen changes. If white-on-hero-light-end fails, R4's darker green is
   mandatory.
3. **Page migration:** edit `screen-scaffold.tsx` + `wizard-scaffold.tsx` + the enumerated full-screen-state
   roots (§B) + the gradient light stops. Apply the page-vs-tint RULE strictly; touch no denylist file.
4. **Tiles:** restyle `category-grid`, `activity-chip-grid`, and the services leading-icon tiles (§C).
5. **Hero:** restyle `care-score-card` + add `care-score-ring` white variant + `careScore.runCheckCta`
   string + CTA route (§D).
6. **Tests + snapshots:** write/extend all §E tests; re-record the four pinned snapshots reviewing that the
   ONLY delta is the page-root token (and, in check-result, that the disclaimer subtree is byte-identical).
   **CHECKPOINT B:** `pnpm --filter mobile test`, `pnpm typecheck && pnpm lint`, `pnpm build` (mobile) green.

## Tests to write (map every card scope-item to a named test)
- **Scope 1 (cream ground-truth + AA re-verify)** → `dual-theme-contrast.test.ts`: `brand-900 on #F4EFE6`
  and `brand-700 on #F4EFE6` ≥ 4.5; `#F4EFE6` present-verbatim in `tailwind-preset.mjs`. Plus
  `screen-scaffold.test.tsx`: page root class is `bg-surface-page` (+ dark sibling intact).
- **Scope 1 (blast radius / frozen surfaces)** → re-recorded `{pet-home,paywall,check-result,weight-chart}`
  snapshots reviewed for page-root-only delta; `check-result-snapshot.test.tsx` disclaimer-subtree
  byte-identity assertion; emergency guard (below).
- **Scope 2 (colorful icon tiles, decorative)** → `category-grid`/`activity-chip-grid`/services tile
  assertions: colored rounded-square fill + `color="#ffffff"` icon + dark-ink label present + testIDs
  preserved (both themes).
- **Scope 3 (green hero + white CTA, AA)** → `care-score-card.test.tsx` (hero surface class, white ring,
  `Run a check` → `/check`), `care-score-ring.test.tsx` (white variant), `dual-theme-contrast.test.ts`
  (`white on #1E6B54` ≥ 4.5 pass **and** `white on #2EA57C` < 4.5 FAIL mutation-proof),
  `fidelity1-strings-tone.test.ts` (`runCheckCta` passes the §7 vocabulary scan).
- **Safety zero-diff** → emergency guard: assert `emergency-interstitial` root stays `bg-red-700` (extend an
  existing emergency test); disclaimer byte-identity (above). No dosing/diagnosis copy introduced.

## Commands to run to self-verify
- `pnpm --filter mobile test`
- `pnpm typecheck && pnpm lint`
- `pnpm build` (affected: mobile; packages/config change is additive)

## Interfaces/contracts
- New tokens: `surface.page="#F4EFE6"`, `surface.card="#FFFFFF"`, `surface.raised="#E7E0D3"` (light).
- `CareScoreRing` gains an optional `onDark?: boolean` (default `false`; `false` = current behavior verbatim).
- New string: `careScore.runCheckCta: "Run a check"`. CTA route: `/check` with `{ petId }`.
- Tile color maps are presentational, keyed on the existing schema ids (`INTAKE_CATEGORIES` / `ActivityType`);
  no `packages/types` change.

## Out of scope / do NOT touch
- `brand.*` hexes; anything in `apps/web`; `packages/types`, Prisma, any API/NestJS/store code.
- `vet-disclaimer.tsx` (SAFETY-FROZEN — keeps `bg-brand-50`, copy byte-identical), the Emergency
  interstitial (`app/check/emergency/[checkId].tsx` — independent `bg-red-700`), any dosing surface.
- Every §7-frozen / FIDELITY-1 copy string (bucket/label/explainer, "Care score" framing) — byte-identical;
  the only new string is `runCheckCta`.
- Denylist e0-tint `bg-brand-50` usages (§B); protected files (`CLAUDE.md`, `PHASES.md`, `.claude/**`, etc.).
- No new dependencies; awaited renders in tests (this repo's convention).

## Risks & the design decisions the planner made (scrutinize these)
- **R1 — Cream via an ADDITIVE `surface.page` token, NOT by editing `brand-50`.** Editing `brand-50` would
  propagate to apps/web and invalidate the §1.1 brand-contrast table and the vet-disclaimer color. Adding a
  new token + migrating only mobile PAGE roots keeps web, the §1.1 brand table, and the disclaimer all
  byte-frozen. Cost: the migration is a real ~28-file mechanical sweep (the honest blast radius).
- **R2 — Page-vs-tint is the sweep's core hazard.** `bg-brand-50` is BOTH the page and the e0 tint
  (design-system §1.5). The plan resolves it with an explicit mechanical RULE (screen-root only) + an
  allowlist/denylist + a `screen-scaffold` guard test. If the executor cannot classify an occurrence with
  certainty, it must STOP and flag rather than guess — a mis-migrated tint is a visible defect.
- **R3 — Scope decision: page migrates to cream; CARD stays white (already parity); TINT/`raised` stays
  `bg-brand-*` this batch.** `surface.card`/`surface.raised` tokens are added for symmetry but not wired,
  since white cards already match the mockup and re-tinting every `bg-brand-100` border/tile would balloon
  the file list past what one pass can safely verify. Minty e0 tints on cream are a bounded, low-salience
  secondary delta (R7).
- **R4 — Hero AA overrides exact mockup gradient.** The mockup hero is `#2EA57C→#1E6B54`; white text on the
  `#2EA57C` end is ~2.5:1 (FAILS AA). Accessibility (§4.6 / §1.1 "new color = new math first") beats pixel
  parity, so the hero uses `#1E6B54` solid (white = 6.39 AA) or `#1E6B54→#143026`. The mutation-proof test
  pins that `white on #2EA57C` fails, documenting WHY the darker green is used.
- **R5 — Hero replaces FIDELITY-1's white CareScore card.** FIDELITY-1 deliberately shipped a white card;
  this batch converts that same surface to the green hero (the mockup's care-hub signature) since the app
  has no separate "Care Center" screen. CareScore DATA + record-only strings are unchanged; only the
  surface + a `Run a check` CTA are added. `care-score-card.test.tsx` / `home-screen.test.tsx` update
  accordingly. The CTA is the one sliver of "logic" (a router push) in an otherwise presentational batch —
  called out because the card says "zero logic"; it is navigation to an existing route, no new behavior.
- **R6 — vet-disclaimer FROZEN (not tracking cream).** Decision: the disclaimer keeps `bg-brand-50`
  byte-identical. This preserves the check-result disclaimer-subtree byte-identity the card requires and
  keeps the primary §5 mobile surface out of a visual-only churn. (Tracking cream was offered as an option;
  freezing is the safer, snapshot-clean choice.)
- **R7 — Snapshot re-record discipline.** The four pinned snapshots change ONLY because their ScreenScaffold
  page root flips `bg-brand-50`→`bg-surface-page` (+ any migrated full-screen-state root they render). The
  sanctioned per-snapshot delta is exactly that token substring; the disclaimer subtree (check-result) and
  all copy stay byte-identical. Any other diff in a re-recorded snapshot is a defect to investigate, not
  accept.
- **R8 — Emergency verified zero-diff.** `app/check/emergency/[checkId].tsx` uses its own `bg-red-700`
  SafeAreaView and does not consume `ScreenScaffold`/`bg-brand-50`, so the page token change cannot reach it;
  a guard assertion pins `bg-red-700`.
- **R9 — Blast-radius honesty / gate risk.** This card bundles four independently-large changes (token+
  contrast, ~28-file page migration, tile recolor across ~7 files, hero rebuild) plus 4 snapshot re-records.
  It is near the ceiling of a single safe executor pass. Recommend the orchestrator watch GATE-EXEC closely;
  if it fails to converge, the natural split is: (1) token + contrast + page migration, (2) tiles,
  (3) hero — in that dependency order. Documented so the checker/orchestrator can make that call.

### Safety statement
No AI output, diagnosis, or dosing copy is added or altered. The vet-disclaimer and Emergency interstitial
are frozen/independent and verified. All §7/FIDELITY-1 frozen copy is byte-identical (only additive
`runCheckCta`, itself §7-scanned). No PRODUCT_SPEC §5 / CLAUDE §7 surface is weakened — this is a
presentation/token batch.
