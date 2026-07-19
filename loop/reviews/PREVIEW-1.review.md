# CHECKER Review — PREVIEW-1 (preview-labeled service flows)

Scope reviewed: 19 porcelain paths — 10 new `app/services/*` screens, `PreviewBanner`,
`preview-fixtures.ts`, 4 new test suites, `services-hub.test.tsx` rewrite, `strings.ts`
`servicesPreview` namespace, and the `services.tsx → services/index.tsx` move.

## Gates (independently re-run)
- `pnpm --filter @pawcareright/mobile test` → **137 suites / 1050 tests / 17 snapshots, EXIT 0**.
- `pnpm typecheck` → 16/16 successful (FULL TURBO, mobile `tsc --noEmit` clean).
- `pnpm lint` → 0 errors. 1 pre-existing warning in `apps/api/coverage/lcov-report/block-navigation.js`
  (generated artifact, unrelated to this diff, not in scope).
- `pnpm --filter @pawcareright/mobile build` → pass (no-op native build, T008).
- ai-evals not required (no `packages/ai` change).

## 1. Honesty architecture audit — PASS
- **Banner on every screen (walked all 10 files):** hub `index.tsx:52`, `book.tsx:60`,
  `vets.tsx:33`, `salons.tsx:26`, `slots.tsx:56`, `store.tsx:27`, `adopt.tsx:42`,
  `adopt-detail.tsx:49`, `insurance.tsx:28`, `preview-end.tsx:54` each mount `<PreviewBanner/>`
  as the first scroll child. `preview-banner.tsx` root is a plain `View` with no `onPress`/close
  control → non-dismissible.
- **Single terminal is the only CTA outcome (traced every route):** hub→flows only;
  `book` vet/salon→`/services/vets|salons`, emergency→`/check`; `vets` Book→`/services/slots?kind=vet`;
  `salons` card→`/services/slots?kind=salon`; `slots` confirm→`/services/preview-end?service=<kind>`;
  `store` `+`→`/services/preview-end?service=store`; `adopt` card→`/services/adopt-detail`;
  `adopt-detail` apply→`/services/preview-end?service=adopt`. Every Book/Apply/buy CTA lands on the
  shared `preview-end.tsx`. Insurance carries NO CTA (informational only).
- **No success framing:** `preview-end.tsx:58` renders a neutral `information-circle-outline` in a
  `brand-100` circle (NOT the mockup's `#2EA57C ✓` / `#8B7BD8 ♥` success circles); title = `end.title`
  = "This is a preview". Honesty test forbidden-regex `/(confirmed|booked|purchased|approved|success|order placed)/i`
  passes on the serialized tree for all 4 services.
- **Forbidden success vocabulary grep (diff-wide, excluding test assertions):** none in flow/component/
  fixture/strings source. The only `strings.ts` hits (lines 548/550 "confirmed"/"success") are the
  pre-existing billing/paywall namespace — outside `servicesPreview` and outside this diff's scope; the
  tone-scan test correctly scopes to `strings.servicesPreview` only.
- **No TextInput anywhere in the flows** (grep clean; adopt preview-end renders read-only bulleted
  `adoptFields`, `preview-end.tsx:77`).
- **No numeric prices:** every price slot renders a "Sample" pill (vets/salons/slots/store) per D4.
  No `[₹$€£]` in any flow/fixture. Rating "★ 4.9" and "120+ reviews" are ratings/counts, not prices,
  and don't trip the phone-number fixture scan (`\+\d{2,}` requires `+` *before* digits; "120+" is safe).
- **Insurance stays informational** (`insurance.tsx`): no waitlist/"Notify me"/"You're on the list"/
  price/launch-date — the mockup's `₹99/month` + `Notify me at launch` + `You're on the list! 🎉`
  were correctly dropped.

## 2. Fixtures audit — PASS
- Vets (Dr. Maya Rivera / Aran Patel / Noor Haddad / Leo Fontaine): generic person names, no business
  collision. Salons (Fluff & Fold Grooming, The Happy Tail Spa, Whisker Works, Paws & Relax): generic
  descriptive pet-grooming names; no famous-trademark collision identified. All fictional; no phone/
  address/email/URL (fixtures test enforces `\d{7,}`, `@`, `http`, street tokens all absent).
- Store products (bed/rope toy/treats/dry food/brush/shampoo): toys/food/grooming only — no
  supplement/vitamin/medication/dose token (`preview-fixtures.test.ts` scoped scan passes).
- Adopt fixtures §7-clean: rescue framing, `vaccinated` flags, every `listedBy` carries "(sample)";
  no breeder/sale/stud/pedigree/price. Shared About blurb is positive-welfare framing.

## 3. Mutation-proofs — BOTH RUN, sha1-verified restores — PASS
- **#1 preview-end title → "Booking confirmed!":** backed up `strings.ts`
  (sha1 `fc58359a…3536097`), mutated `end.title`, ran honesty suite → **5 tests failed** (terminal
  forbidden-regex + tone-scan both trip on "confirmed"/"booked"), matching the orchestrator's observation.
  NOTE: `git checkout` would have wiped the *uncommitted* PREVIEW-1 strings work, so restore was done
  from a file backup; post-restore sha1 = `fc58359a…3536097` (identical) and "This is a preview" present.
- **#2 remove `<PreviewBanner/>` from one flow (salons.tsx):** backed up
  (sha1 `eae69169…bc978c`), deleted the banner render, ran honesty suite → exactly the
  **`salons` banner case failed** ("Unable to find … services-preview-banner"), 14 others passed.
  The `it.each(SCREENS)` genuinely walks all 10 screens (hub, book, vets, salons, slots, store, adopt,
  adopt-detail, insurance, preview-end) — **no screen missed**; the theme suite is a second net.
  Restored from backup; post-restore sha1 = `eae69169…bc978c` (identical).
- Working tree re-verified: porcelain matches the original 19 paths; no snapshot files and no
  api/config/data/`_layout`/`settings` paths touched.

## 4. §5 fence — PASS
- `book.tsx:82` emergency affordance (`services-book-emergency`) → `router.push("/check")` with copy
  "In a real emergency, this preview can't reach a vet. Use Symptom Check for urgent help." — routes
  urgent users to the REAL check flow and explicitly disclaims the preview.
- No preview screen renders `<VetDisclaimer/>`-bearing AI content, no Emergency-interstitial mimicry,
  and no import/embed of the real check/emergency components — an added escalation affordance, not a
  weakening. The persistent banner reinforces "nothing here is a real service."

## 5. §1a + tokens — PASS
- Branding: no user-facing "PawSaathi" in new source (only "PAWSAATHI-4 plan" task-id comments);
  `no-pawsaathi-branding.test.ts` green. No hardcoded display name.
- D5 honored — the mockup's failing white-on-`#FF7A59`/`#8B7BD8`/`#4C9BD6` hero fills were NOT
  reproduced; flows use the already-verified brand/ink tokens. Recomputed the two banner pairs:
  brand-900 `#123a30` on brand-100 `#dcece6` = **10.27** (AAA); ink-dark `#E7E0D3` on
  surface-raised-dark `#143026` = **10.81** (AAA) — matching the plan; the latter is already asserted
  in `dual-theme-contrast.test.ts:89`. No new pair, so no `packages/config` change (correct).
- Reduced-motion: all 5 animated screens (book/vets/salons/store/adopt) gate `FadeInDown` entrances
  behind `useReducedMotion()`; theme/reduced-motion suites render all screens both ways.

## 6. Scope / testIDs / snapshots — PASS
- All plan-enumerated new testIDs present; preserved testIDs (`services-screen`,
  `services-card-*`, `services-badge-*`) intact after the `services.tsx→services/index.tsx` move;
  `../app/services` import resolves to `index.tsx`; old file deleted.
- `settings-services` unchanged, still `router.push("/services")` (`(tabs)/settings.tsx:52-55`).
- Four pinned snapshots byte-identical — untouched before and after both mutation runs (git status
  shows zero `__snapshots__`/`.snap` changes; 17 snapshots passed in-suite).

## 7. New-test non-vacuity
Suites are substantive (honesty forbidden-regex + TextInput-absence + tone-scan; fixtures negative
scans; theme className-presence; flows router-target assertions). **Weakest / near-vacuous:** the
`services-preview-flows.test.tsx › reduced motion` `it.each` block renders each screen with
`useReducedMotion → true` but carries **no `expect`** — it only proves "does not throw," not that
entrances are actually omitted (a screen ignoring the hook would still pass). Acceptable as a
smoke check but the least rigorous assertion in the four suites.

## 8. Hygiene
No `any`, `@ts-ignore`, `console.*`, `TODO/FIXME`, or hardcoded secrets/display-name in the diff.

## Orchestrator lint-fix assessment
- Unused `RenderResult` import removed from the honesty test: correct — the honesty test uses neither
  the value nor the type; the theme test legitimately keeps `type RenderResult` (used at
  `services-preview-theme.test.tsx:33`).
- Unused `iconColor` + `useColorScheme` removed from `vets.tsx`: **did NOT orphan scheme-aware icon
  behavior** — `vets.tsx` renders no `Ionicons` at all (avatar = text initial, rating = literal "★"
  glyph), so there was no colored icon to theme. Clean removal.

## Findings (non-blocking)
- **Minor a11y (below-44pt tap targets):** two raw `Pressable`s lack `hitSlop` and fall under the
  44pt target — store `+` button `h-8 w-8` (32px, `store.tsx:66`) and adopt-detail back button
  `h-10 w-10` (40px, `adopt-detail.tsx:60`). The codebase has an established `hitSlop` pattern for
  small icon buttons (e.g. `ghost-button.tsx`, `section-header.tsx`). These mirror the mockup's 32px
  `+` and are not among the enumerated FAIL conditions, and all primary CTAs use canon
  `Card`/`PrimaryButton`/`SecondaryButton`/`Chip` that meet the target — but a follow-up should add
  `hitSlop` to reach 44pt effective.

## Verdict rationale
Every enumerated FAIL condition is clear: no missing banner (all 10 verified + mutation-proven),
no CTA reaches a success-framed state, no forbidden vocabulary, no real-data collection
(no TextInput), no real-business fixture, no snapshot delta, and both mutation-proofs fail exactly
as required. Gates green. The only defect is a minor, non-blocking sub-44pt tap target on two icon
buttons.

VERDICT: PASS — banner honesty architecture, single honest terminal, §5 fence, fixtures, tokens, and
scope all verified; both mutation-proofs confirmed with sha1-identical restores. One non-blocking
a11y follow-up: add `hitSlop` to the store `+` (32px) and adopt-detail back (40px) Pressables to
reach the 44pt target.
