# Plan — PREVIEW-1: Full service-flow UI, preview-labeled (mockup-fidelity batch 2/3)

## Objective (from card)
Upgrade the existing `/services` hub into the gateway for a set of tap-through, PREVIEW-labeled service flows (vet booking, salon, store, adoption, insurance). Every screen looks like the founder mockup but is honest: static local fixtures only, a persistent non-dismissible PREVIEW banner, and every terminal CTA lands on ONE shared honest "this is a preview — launching soon" state — never a fake confirmation. Presentation + static fixtures only; zero api/store/deps changes.

## Scope decisions locked before file list (see Risks for justification)
- **D1 (route topology):** the flows live as sibling files under `app/services/` in the ROOT stack (no `_layout.tsx` — matches how `services.tsx` currently auto-routes unlisted). `app/services.tsx` is CONVERTED to `app/services/index.tsx` (byte-identical import path `../app/services`).
- **D2 (book-menu path):** hub cards **Vet consultation** AND **Pet salon** both route to `/services/book` (the mockup BOOK MENU), which branches to vet-list / salon-list. This gives the mockup-faithful book menu a real purpose and is the one screen that carries the §5 emergency affordance.
- **D3 (one terminal state):** ALL terminal CTAs (vet Book, salon pick, slot confirm, store buy `+`, adopt Apply) route to the SINGLE shared `app/services/preview-end.tsx?service=…`. The adopt variant additionally renders a READ-ONLY "what you'll be asked" list (collects nothing).
- **D4 (pricing):** NO numeric prices anywhere. Every mockup price slot renders a neutral **"Sample"** pill. Justified in Risks (numbers imply a real payable fee; a preview must not).
- **D5 (palette/AA):** NO new color pair is introduced, so NO new contrast math and NO `packages/config` / `dual-theme-contrast.test.ts` change. The mockup's orange/purple/blue white-text hero cards FAIL AA (computed in Risks) and are therefore NOT reproduced — fidelity is LAYOUT/structure/spacing, rendered with the app's already-verified brand/accent/ink tokens.

## Files to create/modify (exhaustive — executor may touch NOTHING else)

### Create — route screens (all `apps/mobile/app/services/`)
- `index.tsx` — the hub, MOVED + UPGRADED from `app/services.tsx`. Five cards; all five become tappable `Card`s (`onPress`). Vet & Salon → `/services/book`; Store → `/services/store`; Adoption → `/services/adopt`; Insurance → `/services/insurance`. Vet/Salon/Store/Adoption cards keep their `services-badge-*` testID but show `strings.services.preview` ("Preview"); insurance keeps `strings.services.comingSoon` ("Coming soon"). Renders `<PreviewBanner/>` at top. Keeps `services-screen`, `services-card-{key}`, all dark tokens.
- `book.tsx` — BOOK MENU (~261): two canon `Card`s (Vet consultation / Pet salon) → `/services/vets` / `/services/salons`; PREVIEW banner; the §5 emergency affordance row (`services-book-emergency`) → `router.push("/check")`.
- `vets.tsx` — VET LIST (~278): mode segment chips (Video/Clinic/Home), 4 vet `Card`s from fixtures (avatar initial, name, specialty·exp, star rating, "Sample" pill in the price slot, "Preview booking" `PrimaryButton` per card) → `/services/slots?kind=vet&id=…`.
- `salons.tsx` — SALON LIST (~294): 4 salon `Card`/`ListRow`s (icon, name, duration·desc, "Sample" pill) → `/services/slots?kind=salon&id=…`.
- `slots.tsx` — SLOT PICKER (~304): selected-service summary card; "Select day" horizontal `Chip` row (sample relative-day labels); "Sample times" 3-col grid of time `Chip`s; bottom-pinned `PrimaryButton` "Preview this booking" (`services-slots-confirm`) → `/services/preview-end?service=<vet|salon>`. Reads `kind`/`id` params.
- `store.tsx` — STORE (~397): 2-col grid of 6 product `Card`s (icon, category tag, name, "Sample" pill, `+` `services-store-add-{id}` button) → `/services/preview-end?service=store`.
- `adopt.tsx` — ADOPT BROWSE (~348): species `Chip` filters (All/Dogs/Cats — v1 species scope), 2-col grid of 4 pet `Card`s (photo placeholder, name, mix, meta, vaccinated pill) → `/services/adopt-detail?petId=…`; `EmptyState`/empty text when a filter matches none.
- `adopt-detail.tsx` — ADOPT DETAIL (~365): reads `petId`; hero photo placeholder + back, name/mix/meta, vaccinated pill, "About …" card (fixture blurb), "Listed by <sample shelter>" dashed card, bottom-pinned `PrimaryButton` "Preview adoption for {name}" (`services-adopt-apply`) → `/services/preview-end?service=adopt`.
- `insurance.tsx` — INSURANCE COMING SOON (~384): hero + 3 benefit `ListRow`s + "Coming soon" state. **NO waitlist / "Notify me" button, NO "You're on the list", NO ₹99/price, NO launch date** (honesty + forbidden-vocab). PREVIEW banner + `strings.servicesPreview.insurance.note`.
- `preview-end.tsx` — SHARED honest terminal (replaces CONFIRM ~319 + APPLIED ~378). Reads `service` param; neutral brand icon (no colored success circle), title `strings.servicesPreview.end.title`, body `end.body(serviceLabel)`. For `service==="adopt"` also renders read-only `end.adoptAsk` + `end.adoptFields` list (NO `TextInput`). One `SecondaryButton` back to `/services` (adopt: back to `/services/adopt`). PREVIEW banner present.

### Create — component & data
- `apps/mobile/src/components/services/preview-banner.tsx` — `PreviewBanner`: persistent, NON-dismissible (no close control, no `onPress`), both themes. Root `View testID="services-preview-banner"` (prop-overridable), `bg-brand-100 dark:bg-surface-raised-dark rounded-lg px-4 py-3`, brand icon + `strings.servicesPreview.banner.label` bold + `.banner.text`, `accessibilityLabel={strings.servicesPreview.banner.a11y}`. Uses only §1.1/§1.1a-verified pairs (brand-900/brand-100 = 10.27 AAA; ink-dark/raised-dark = 10.81 AAA).
- `apps/mobile/src/services/preview-fixtures.ts` — the ONLY data source: exported typed arrays `PREVIEW_VETS`, `PREVIEW_SALONS`, `PREVIEW_STORE_PRODUCTS`, `PREVIEW_ADOPT_PETS`, `PREVIEW_SLOT_DAYS`, `PREVIEW_SLOT_TIMES`, `PREVIEW_VET_MODES`. All fictional; enumerated below. No real businesses/phones/addresses/emails/URLs; no meds/dosing in products; adopt fixtures §7-clean (rescue/adoption framing, never breeder/sale).

### Modify
- `apps/mobile/src/strings.ts` — (a) extend `services`: add `preview: "Preview"`, `cardA11yPreview: (t)=>`${t}, preview``; (b) add the full `servicesPreview` namespace (enumerated below). No currency/year/notify tokens.
- `apps/mobile/__tests__/services-hub.test.tsx` — rewrite the "coming-soon states / no capture" + a11y blocks for the upgraded hub (see Tests). Keep the navigation-entry + services-namespace tone-scan blocks.

### Create — tests
- `apps/mobile/__tests__/services-preview-flows.test.tsx`
- `apps/mobile/__tests__/services-preview-honesty.test.tsx`
- `apps/mobile/__tests__/services-preview-fixtures.test.ts`
- `apps/mobile/__tests__/services-preview-theme.test.tsx`

### Delete
- `apps/mobile/app/services.tsx` (moved to `app/services/index.tsx`).

## Enumerated new strings (`strings.servicesPreview`) — executor uses VERBATIM
```
banner: { label: "Preview", text: "A sneak peek of what's coming. Nothing here is a real booking, order, or application.", a11y: "Preview mode. Nothing on this screen is a real service." }
book: { title: "Book a service", subtitle: "See how booking will work", vetTitle: "Vet consultation", vetDesc: "Video call, clinic visit, or home visit.", salonTitle: "Pet salon", salonDesc: "Grooming, bath, and spa.", emergencyNote: "In a real emergency, this preview can't reach a vet. Use Symptom Check for urgent help.", emergencyCta: "Open Symptom Check" }
vets: { title: "Vet consultation", subtitle: "Sample vets — preview only", perConsult: "per consult", sampleTag: "Sample", book: "Preview booking", ratingA11y: (n) => `Rated ${n} out of 5` }
salons: { title: "Pet salon", subtitle: "Sample salons — preview only", sampleTag: "Sample" }
slots: { title: "Pick a slot", selectDay: "Select day", availableTimes: "Sample times", cta: "Preview this booking", sampleTag: "Sample", summaryA11y: "Sample service, preview only" }
store: { title: "Pet store", subtitle: "Sample products — preview only", sampleTag: "Sample", addA11y: (name) => `Preview ${name}` }
adopt: { title: "Adopt", subtitle: "Sample listings — preview only", speciesAll: "All", speciesDog: "Dogs", speciesCat: "Cats", empty: "No sample pets match these filters.", vaccinated: "Vaccinated", listedBy: "Listed by", aboutTitle: (name) => `About ${name}`, apply: (name) => `Preview adoption for ${name}` }
insurance: { title: "Pet insurance", heroTitle: "Cover the unexpected", heroBody: "Accident and illness cover, cashless vet visits, and wellness add-ons.", comingSoon: "Coming soon", benefit1: "Cashless visits at partner clinics", benefit2: "Covers accidents, surgery, and illness", benefit3: "Flexible wellness add-ons", note: "This isn't available yet. There's nothing to sign up for." }
end: { title: "This is a preview", body: (service) => `${service} isn't available yet — this was just a preview. Nothing here is real.`, adoptAsk: "When adoption launches, you'll be asked for:", adoptFields: ["Your name and contact", "Where you live and your home type", "Other pets in your home", "Your experience caring for pets"], done: "Back to services", browseMore: "Back to adoption", serviceVet: "Vet booking", serviceSalon: "Salon booking", serviceStore: "The pet store", serviceAdopt: "Adoption" }
```
Modes (`vets.tsx`) label via existing pattern: `PREVIEW_VET_MODES` carry their own labels ("Video","Clinic","Home visit").

## Enumerated fixture strings (`preview-fixtures.ts`) — for audit
- **PREVIEW_VET_MODES:** `Video`, `Clinic`, `Home visit`.
- **PREVIEW_VETS (4):** "Dr. Maya Rivera" / "Small-animal medicine" / "8 yrs" / 4.9 / "120+ reviews"; "Dr. Aran Patel" / "Feline health" / "6 yrs" / 4.8 / "90+ reviews"; "Dr. Noor Haddad" / "Skin & coat" / "10 yrs" / 4.7 / "60+ reviews"; "Dr. Leo Fontaine" / "General practice" / "5 yrs" / 4.9 / "40+ reviews". (initials derived in code.)
- **PREVIEW_SALONS (4):** "Fluff & Fold Grooming" / "Full groom · 90 min"; "The Happy Tail Spa" / "Bath & brush · 45 min"; "Whisker Works" / "Nail & ear care · 30 min"; "Paws & Relax" / "Spa day · 120 min".
- **PREVIEW_STORE_PRODUCTS (6, toys/food/grooming only):** "Cozy Fleece Bed"/"Comfort"; "Chew-Tough Rope Toy"/"Play"; "Salmon Crunch Treats"/"Treats"; "Everyday Dry Food"/"Food"; "Gentle Slicker Brush"/"Grooming"; "Oatmeal Pet Shampoo"/"Grooming". (No supplement/vitamin/medication/dosing anywhere.)
- **PREVIEW_ADOPT_PETS (4, §7-clean, dogs+cats only, rescue framing, NO breeder/sale/price):** "Biscuit" / "Indie mix" / species DOG / "1 yr · Male" / vaccinated:true / listedBy "Sunrise Animal Shelter (sample)"; "Pepper" / "Domestic shorthair" / CAT / "2 yrs · Female" / vaccinated:true / "Paws Rescue (sample)"; "Rusty" / "Labrador mix" / DOG / "3 yrs · Male" / vaccinated:false / "Sunrise Animal Shelter (sample)"; "Clover" / "Tabby mix" / CAT / "8 mo · Female" / vaccinated:true / "Paws Rescue (sample)". About blurb (shared): "A gentle, playful companion looking for a loving home. Good with kids and other pets, and up to date on basic health checks."
- **PREVIEW_SLOT_DAYS (5, relative — no calendar dates):** `Today`, `Tomorrow`, `Sat`, `Sun`, `Mon`.
- **PREVIEW_SLOT_TIMES (6):** `9:00`, `10:30`, `12:00`, `2:30`, `4:00`, `5:30`.

## Ordered steps
1. Extend `strings.ts`: add `services.preview` + `services.cardA11yPreview`, then the full `servicesPreview` namespace verbatim above. (No currency/year/notify.)
2. Create `src/services/preview-fixtures.ts` with the typed exported arrays above (species uses the existing `"DOG"|"CAT"` string literals; do NOT import api types that would pull store deps — plain local `type` unions only).
3. Create `src/components/services/preview-banner.tsx` (`PreviewBanner`, verified tokens, non-dismissible, `useReducedMotion` not needed — static).
4. Create `app/services/index.tsx` from the current `app/services.tsx`: keep all existing testIDs + dark tokens; make every `Card` pressable with the D2 routing; flow cards show `strings.services.preview` badge, insurance keeps `comingSoon`; mount `<PreviewBanner/>`; a11y label via `services.cardA11yPreview` (insurance via existing `cardA11y`). Then DELETE `app/services.tsx`.
5. Create `book.tsx`, `vets.tsx`, `salons.tsx`, `slots.tsx`, `store.tsx`, `adopt.tsx`, `adopt-detail.tsx`, `insurance.tsx`, `preview-end.tsx` — each: `ScreenScaffold` (calm `bg-brand-50`, no gradient), `<PreviewBanner/>` as the first scroll child, canon components only (`Card`/`Chip`/`ListRow`/`PrimaryButton`/`SecondaryButton`/`EmptyState`), verified tokens only, icon colors computed from `useColorScheme()`, entrances via `Animated.View` + `FadeInDown.delay(i*80).duration(320)` gated by `useReducedMotion()` (quick-actions pattern), 44pt via canon, `maxFontSizeMultiplier={1.5}` on chrome text. Bottom-pinned CTAs (slots/adopt-detail/preview-end) via `ScreenScaffold` `footer`.
6. Wire terminal CTAs to `/services/preview-end?service=…` (D3); wire book emergency affordance to `/check`.
7. Rewrite the two affected blocks in `services-hub.test.tsx`; add the four new test files.
8. Self-verify (commands below). Confirm the four pinned `.snap` files are untouched and `git status` shows no change under any `api`/`store`/`packages/config` path.

## Tests to write (map to acceptance criteria / governing §-items)
- **AC scope-1 routes + hub gateway** → `services-preview-flows.test.tsx › hub routes into each flow`: renders `index`, presses each `services-card-*`, asserts `router.push` targets `/services/book` (vet, salon), `/services/store`, `/services/adopt`, `/services/insurance`.
- **AC scope-1 flow chaining** → same file › `vet/salon/slots/adopt chains`: vets Book → `/services/slots`; slots confirm → `/services/preview-end`; adopt card → `/services/adopt-detail`; adopt-detail apply → `/services/preview-end`; store `+` → `/services/preview-end`.
- **AC scope-2 PREVIEW banner on EVERY screen (non-dismissible)** → `services-preview-honesty.test.tsx › banner present`: render each of the 10 screens, assert `getByTestId("services-preview-banner")` exists and exposes NO close/dismiss control (`onPress` undefined on banner root).
- **AC scope-2 single honest terminal, no success framing** → `services-preview-honesty.test.tsx › preview-end`: render `preview-end` for each service; assert title = `end.title`, body contains "isn't available yet"/"preview", and the serialized tree matches NONE of `/\b(confirmed|booked|purchased|approved|success|order placed)\b/i`; assert NO `TextInput` present (adopt shows read-only fields only).
- **AC scope-2 forbidden-vocab string scan** → `services-preview-honesty.test.tsx › string tone scan`: serialize `strings.servicesPreview`; assert no match for `/\b(confirmed|booked|purchased|approved)\b/i`, no `/\bnotify\b/i`, no `[₹$€£]`, no `/\b(19|20)\d\d\b/`, no `/\b(dose|dosage|mg|diagnos)/i`.
- **AC scope-2 fixtures audit** → `services-preview-fixtures.test.ts`: over all fixture strings assert — no digit run ≥7 and no `+\d{2,}` (no phone numbers); no `@`/`http`/street tokens `/\b(street|road|ave|avenue|marg|nagar|lane|block)\b/i` (no addresses); store products contain no `/\b(mg|ml|dose|dosage|supplement|vitamin|medication|antibiotic|dewormer|tablet|capsule|painkill)\b/i`; adopt fixtures contain no `/\b(breeder|breeding|for sale|stud|pedigree|price)\b/i`; every `listedBy` contains "sample"; no `[₹$€£]`; no forbidden success vocab.
- **AC scope-2 no capture / hub honesty** → `services-hub.test.tsx › upgraded hub`: insurance badge shows `comingSoon`; flow badges show `preview`; hub renders `services-preview-banner`; serialized hub has no `/notify me|waitlist|on the list/i`; `services` namespace tone-scan (existing block, kept) still passes.
- **AC scope-3 dual-theme** → `services-preview-theme.test.tsx`: for each flow-screen root assert a `dark:bg-surface-*-dark` class and a key text node `dark:text-ink-dark`; assert `PreviewBanner` carries `dark:bg-surface-raised-dark`.
- **AC scope-3 reduced-motion** → `services-preview-flows.test.tsx › reduced motion`: mock `useReducedMotion` → true, render each screen, assert renders without error (entrances omitted branch).
- **AC scope-4 emergency non-confusion (§5)** → `services-preview-flows.test.tsx › emergency affordance`: render `book`, assert `services-book-emergency` renders `book.emergencyNote` text and presses to `router.push("/check")`.
- **Governing design-system §7 / CLAUDE §7 record-only** → covered by the honesty + fixtures scans (no diagnos/dose/mg, no success framing).

## Commands to run to self-verify
- `pnpm --filter @pawcareright/mobile test` (all mobile jest incl. the 5 services test files)
- `pnpm typecheck` · `pnpm lint` · `pnpm --filter @pawcareright/mobile build` (or `pnpm build` affected)
- Confirm untouched: `git status` shows no diff under `apps/api/**`, `packages/config/**`, `apps/mobile/**/__snapshots__/{weight-chart,check-result,pet-home,paywall}-snapshot.test.tsx.snap`, `dual-theme-contrast.test.ts`, `app/(tabs)/settings.tsx`, `app/_layout.tsx`.

## Interfaces/contracts
- `PreviewBanner(props?: { testID?: string })` — default testID `services-preview-banner`; renders static, no dismiss.
- Fixtures: `PREVIEW_VETS: {id,name,specialty,experience,rating,reviews,initial}[]`, `PREVIEW_SALONS: {id,name,detail,icon}[]`, `PREVIEW_STORE_PRODUCTS: {id,name,tag,icon}[]`, `PREVIEW_ADOPT_PETS: {id,name,mix,species:"DOG"|"CAT",meta,vaccinated,listedBy}[]`, `PREVIEW_SLOT_DAYS: string[]`, `PREVIEW_SLOT_TIMES: string[]`, `PREVIEW_VET_MODES: {key:"video"|"clinic"|"home",label}[]`.
- Params: `slots.tsx` reads `{kind:"vet"|"salon", id}`; `adopt-detail.tsx` reads `{petId}`; `preview-end.tsx` reads `{service:"vet"|"salon"|"store"|"adopt"}`.
- New testIDs (all new): `services-preview-banner`; `services-book-screen`,`services-book-vet`,`services-book-salon`,`services-book-emergency`; `services-vets-screen`,`services-vet-card-{id}`,`services-vet-book-{id}`,`services-vet-mode-{video|clinic|home}`; `services-salons-screen`,`services-salon-card-{id}`; `services-slots-screen`,`services-slots-day-{i}`,`services-slots-time-{i}`,`services-slots-confirm`; `services-store-screen`,`services-store-card-{id}`,`services-store-add-{id}`; `services-adopt-screen`,`services-adopt-card-{id}`,`services-adopt-species-{all|dog|cat}`; `services-adopt-detail-screen`,`services-adopt-apply`; `services-insurance-screen`; `services-preview-end-screen`,`services-preview-end-title`,`services-preview-end-cta`. Preserved: `services-screen`,`services-card-{vet|salon|store|adoption|insurance}`,`services-badge-{…}`,`settings-services`.

## Out of scope / do NOT touch
- Any `apps/api/**`, any store/Prisma/queue, `packages/config/**` (no token/palette add → D5), `packages/data/**`.
- `dual-theme-contrast.test.ts` (no new pair), the four pinned snapshot `.snap` files + their test files, `app/(tabs)/settings.tsx`, `app/_layout.tsx` (services auto-routes; do NOT register — keeps root diff zero).
- No new dependency, no `@gorhom/bottom-sheet`, no payment/cart/form-input UI, no waitlist/notify capture, no `APP_DISPLAY_NAME` hardcode.
- Do NOT alter any `<VetDisclaimer/>`, Emergency interstitial, or check-flow file — only ADD the outbound `/check` affordance from `book.tsx`.

## Risks & the design decisions the planner made (scrutinize)
- **D2 (two hub cards → one book menu):** Vet + Salon cards both land on `/services/book`. Slightly redundant, but it is the only mockup-faithful home for the vet/salon split and the natural anchor for the §5 emergency affordance. Alternative (direct vet-list / salon-list, orphaning the book menu) was rejected because the card explicitly cites BOOK MENU as a route to build.
- **D4 (no prices, "Sample" pill):** the mockup shows ₹ prices; showing any number implies a real, payable fee and risks reading as a live transaction. A "Sample" pill preserves the card's price-slot layout while staying honest and sidesteps currency-token pollution. Card permits this ("a 'sample' watermark approach is acceptable").
- **D5 (no new AA pair — mockup accent hero cards not reproduced):** computed white-on-mockup-accent ratios — white on `#FF7A59` (salon/warm) = **2.59:1**, on `#8B7BD8` (applied/lilac) ≈ 3.6:1, on `#4C9BD6` (insurance/sky) ≈ 3.06:1; warm FAILS even the 3:1 large-text floor, and category.* are §1.1a "decorative/large-only, not yet wired." Rather than add + AA-math a new darker palette in `packages/config` (broader blast radius, out of this batch's presentation-only intent), fidelity is delivered as layout/structure/spacing on the ALREADY-verified brand/accent/ink tokens (vet green `accent.dark` hero, white text 6.39:1, stays faithful). If the founder wants the exact mockup hues, that is a separate `packages/config` + `dual-theme-contrast.test.ts` task.
- **D1 (file move `services.tsx`→`services/index.tsx`):** import path `../app/services` resolves identically; all hub testIDs preserved; `/services` route unchanged. Risk: transient dual route if the old file isn't deleted — step 4 deletes it in the same change.
- **§5 SAFETY (not an escalation-weakening change):** the vet-booking preview is routine-consultation only and is explicitly fenced from the real emergency path by (a) the persistent PREVIEW banner stating nothing here is real, and (b) the `book.tsx` emergency affordance routing to the real Symptom Check (`/check`). This ADDS an escalation affordance and never renders `<VetDisclaimer/>`-bearing AI content, so it does not weaken any §5 surface — no `SAFETY-ESCALATION` block warranted.
- **Terminal vocab boundary:** "book/booking" (feature nouns) are allowed; the honesty regex targets only success lexemes `confirmed|booked|purchased|approved|success|order placed`. The mockup's "Booking confirmed" / "Application sent!" are deliberately dropped for `end.title`/`end.body`.
