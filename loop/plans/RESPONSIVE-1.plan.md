# Plan — RESPONSIVE-1: Responsive for any mobile size and tablet (founder mockup-fidelity, final batch 3/3)

## Objective (from card)
Make every screen render well from tiny phones (~320dp) through large phones and 7–13" tablets, both orientations, both themes — presentation-only, zero logic changes, every `testID` preserved, frozen surfaces frozen. Add a small responsive module (`useLayoutBucket`) and give `ScreenScaffold` + the enumerated grids a tablet-aware, dimension-conditional treatment; cap reading-column line length on the two bespoke reading screens.

---

## The decisions the planner locked (scrutinize under "Risks")

- **D1 — Mechanism = a `useWindowDimensions`-based hook, NOT NativeWind `sm:/md:/lg:` breakpoints.** Under this repo's jest (NativeWind 4.2.6 + the `.css` stub), `className` is kept as an un-resolved literal prop (PAWSAATHI-1 R3): a `md:` prefix would be an inert string, unverifiable, and on native NativeWind's RN breakpoints are themselves window-width driven — so a hook is both the honest and the testable choice. The hook is spy-testable exactly like `home-gradient-scheme.test.tsx` spies `useColorScheme`: we `jest.spyOn(ReactNative, "useWindowDimensions")`. A layout branch keyed on the hook produces different `className`/structure that IS observable in `toJSON()`.
- **D2 — Thresholds: `compact` width < 360, `regular` 360–767, `wide` ≥ 768.** The `wide`≥768 boundary is the classic phone↔tablet line (iPad portrait ≈768–834, landscape ≥1024; large phones in landscape ≥768 also get it). Chosen deliberately so **jest's default window width (750) resolves to `regular`** — see D3.
- **D3 — Snapshot policy: NO re-record, NO snapshot-test edits.** `@react-native/jest-preset`'s `DeviceInfo` mock defaults `window.width = 750` (`.../jest/mocks/NativeModules.js`). 750 < 768 ⇒ default bucket is `regular`. Every responsive change is **additive-conditional: only the `wide` branch adds classes/structure; the `regular` branch string is byte-identical to today's**. Therefore the four pinned snapshots (`pet-home`, `paywall`, `check-result`, `weight-chart`) render through the unchanged path and stay **byte-identical** — no `jest -u`, no edits to the `.snap` files or their tests. `check-result`'s `<VetDisclaimer/>` subtree is byte-identical for the same reason (it is never touched, and its container's `regular` string is unchanged). Wide/compact behavior is proven only by NEW spy tests. A guard test pins the 750→`regular` invariant so a future threshold change can't silently churn the frozen snapshots.
- **D4 — Emergency screen: zero-diff, NO §5 exception needed.** Audited `app/check/emergency/[checkId].tsx` at 320dp: single column, `px-6` gutter, centered wrapping `text-2xl` title, full-width stacked `PrimaryButton`s, no grid/chip/fixed-height — nothing overflows or breaks at 320. It is therefore NOT modified (no responsive hook added) and remains byte-identical. (No re-order/animate/recolor anywhere.)
- **D5 — Tiny-phone (320) fixes: none required (verified-no-change).** The app already had an iPhone-SE (320×568) budget target (`src/pets/pet-home-layout.ts`). Re-audited every grid/stack at 320 (arithmetic in the audit table): category grid (3×`w-[30%]`), quick-actions (2×`basis-[45%]`), activity chips (3×`basis-[28%]`), and the paywall vertical stack all fit within the 288dp content box. No genuine 320 overflow found ⇒ per the verified-no-change discipline, NO `compact` layout classes are added this task. `useLayoutBucket` still classifies `compact` (future-proofing + tested), but nothing consumes it.
- **D6 — Reading-column cap uses the Tailwind `max-w-*` scale, not arbitrary px.** `max-w-3xl` (768) for the general scaffold column, `max-w-2xl` (672) for the two text-heavy reading screens (design-system §7.3 "≈600px line-length" rule). This keeps design-system §7.2's "no arbitrary `[NNpx]`" law intact (the only sanctioned arbitraries stay `min-h-[44px]`/`min-h-[56px]`).

---

## Files to create/modify (exhaustive — executor may touch NOTHING else)

### Create
- `apps/mobile/src/hooks/use-layout-bucket.ts` — NEW. Pure `bucketForWidth(width)` + `useLayoutBucket()` reading `useWindowDimensions()`; exported threshold constants. (See Interfaces.)
- `apps/mobile/__tests__/layout-bucket.test.tsx` — boundary tests for `bucketForWidth`; spy tests for `useLayoutBucket`; the 750→`regular` invariant guard.
- `apps/mobile/__tests__/responsive-scaffold.test.tsx` — wide vs regular scaffold column + preserved safe-area/KeyboardAvoiding/gradient/footer.
- `apps/mobile/__tests__/responsive-grids.test.tsx` — wide vs regular column counts for the four grids; testIDs + reduced-motion preserved.
- `apps/mobile/__tests__/responsive-reading-columns.test.tsx` — wide vs regular content-column cap on check-result + paywall; disclaimer subtree + emergency-notice ordering + testIDs preserved.

### Modify (each change is `bucket === "wide" ? BASE + " " + WIDE_EXTRA : BASE`; `BASE` = today's exact string, unchanged)
- `apps/mobile/src/components/screen-scaffold.tsx` — call `useLayoutBucket()`; on `wide` append `w-full max-w-3xl self-center` to the ScrollView `contentContainerClassName`, and to the footer region's className (center the thumb-zone column). SafeArea `edges`, gradient mount, `KeyboardAvoidingView`, `footer`/`scrollTestID` wiring, and all default strings unchanged. Non-wide = byte-identical.
- `apps/mobile/src/components/category-grid.tsx` — item width `w-[30%]` → on `wide` `w-[18%]` (5 cols); keep `min-h-[44px]` + every other class in BOTH branches. testIDs (`check-category-grid`, `check-category-${id}`) unchanged.
- `apps/mobile/src/components/home/quick-actions-grid.tsx` — Animated.View wrapper `min-w-[45%] flex-1 basis-[45%]` → on `wide` `min-w-[22%] flex-1 basis-[22%]` (4 cols). `FadeInDown`/`useReducedMotion` gating, disabled logic, dark tokens, testIDs unchanged.
- `apps/mobile/src/components/activity-chip-grid.tsx` — tile `min-w-[28%] flex-1 basis-[28%]` → on `wide` `min-w-[18%] flex-1 basis-[18%]` (5 cols). Pressed-style, a11y label, testIDs (`activity-chip-grid`, `activity-chip-${type}`) unchanged.
- `apps/mobile/app/services/index.tsx` — call `useLayoutBucket()`; on `wide` the card container becomes `flex-row flex-wrap gap-3` and each card is wrapped in `<View className="basis-[48%] grow">` (2 cols); on non-wide the container stays exactly `gap-3` with `<Card>` rendered directly (byte-identical). Prefer passing a `className` straight to `<Card>` ONLY if `card.tsx` already supports it (executor verifies; if not, use the wrap-on-wide form so `card.tsx` stays untouched). All `services-card-*`/`services-badge-*` testIDs + `PreviewBanner` + note unchanged.
- `apps/mobile/app/check/result/[checkId].tsx` — call `useLayoutBucket()`; the main content `<View className="gap-6 px-4 pb-8 pt-4">` gets `+ " w-full max-w-2xl self-center"` on `wide` only. NOTHING else changes: emergency-notice-first ordering, `<VetDisclaimer/>`, fallback/urgency/cards/buttons, error + loading states, every `check-result-*` testID untouched.
- `apps/mobile/app/paywall.tsx` — call `useLayoutBucket()`; the scroll content `<View className="gap-6 px-4 pb-8 pt-4">` and the bottom-pinned CTA footer `<View className="border-t ...">` each get `+ " w-full max-w-2xl self-center"` on `wide` only. All `paywall-*` testIDs, notices, plan cards, links, busy overlay unchanged.
- `docs/design-system.md` — add a short "Responsive layout" subsection (buckets + thresholds + the `max-w-*` column rule + the jest-default/frozen-snapshot invariant). Documentation only; `design-system.md` is NOT a protected file.

---

## Per-screen / per-surface audit table (delta or verified-no-change)

| Surface | 320 (compact) | tablet (wide) finding | Plan |
|---|---|---|---|
| `ScreenScaffold` (all tab/stack screens using it: care, timeline, services, family, settings, activity, note, weight, vet-visit, reminders, add-pet steps, etc.) | Fits (px-4, single column) — no change | Content stretches edge-to-edge on tablets = wasted/awkward | **DELTA**: wide → centered `max-w-3xl` column. Every scaffold screen gets tablet sanity for free; no per-screen file edit. |
| `category-grid` (check/index) | 3×`w-[30%]`+2×gap-3 = 265/288 ✓ fits | 3 huge tiles stretched full width | **DELTA**: wide → 5 cols (`w-[18%]`). |
| `quick-actions-grid` (home) | 2×`basis-[45%]` ✓ fits | 2 oversized tiles | **DELTA**: wide → 4 cols (`basis-[22%]`). |
| `activity-chip-grid` (activity) | 3×`basis-[28%]` ✓ fits | 3 oversized tiles | **DELTA**: wide → 5 cols (`basis-[18%]`). |
| `services/index` cards | full-width list ✓ fits | 5 full-bleed cards on tablet | **DELTA**: scaffold cap + wide → 2-col (`basis-[48%]`). |
| `check/result/[checkId]` content | vertical, ✓ fits | text lines span too wide (harms readability, §7.3) | **DELTA**: wide → `max-w-2xl` centered reading column. Disclaimer/emergency ordering untouched. |
| `paywall` content + CTA bar | vertical stack ✓ fits | text + full-bleed CTA span too wide | **DELTA**: wide → `max-w-2xl` centered column on content and CTA footer. |
| `check/emergency/[checkId]` | ✓ fits (D4) | full-width red takeover is correct for a safety interstitial | **VERIFIED-NO-CHANGE** (frozen; D4). |
| `weight-chart` + snapshot | own fixed geometry, width-independent here | chart sizes to its container (inside the now-capped scaffold) | **VERIFIED-NO-CHANGE** (not modified). |
| `vet-disclaimer.tsx` | — | — | **VERIFIED-NO-CHANGE** (byte-identity required; untouched). |
| `pet-home` (pets/[id], SE-budgeted, bespoke) | already SE-budget tested | renders `quick-actions.tsx` (NOT the modified `quick-actions-grid`) | **VERIFIED-NO-CHANGE** for this task; snapshot byte-identical (D3). |

---

## Ordered steps
1. Create `use-layout-bucket.ts` (constants + pure fn + hook). Write `layout-bucket.test.tsx` (boundaries + spy + 750→regular guard). Run `pnpm --filter @pawcareright/mobile test -- layout-bucket`.
2. Modify `screen-scaffold.tsx` (wide centered column on content + footer). Write `responsive-scaffold.test.tsx`.
3. Modify the four grids (`category-grid`, `quick-actions-grid`, `activity-chip-grid`, `services/index`). Write `responsive-grids.test.tsx`.
4. Modify `check/result/[checkId].tsx` + `paywall.tsx` reading columns. Write `responsive-reading-columns.test.tsx`.
5. **Checkpoint A** — `pnpm --filter @pawcareright/mobile test`: confirm ALL existing tests + the four pinned snapshots pass **with zero `-u` and zero snapshot-test edits** (proves the additive-conditional/750→regular invariant). If any existing className/snapshot assertion fails, the change leaked into the `regular` path — fix the branch, do NOT weaken the assertion or re-record.
6. Update `docs/design-system.md` responsive subsection.
7. **Checkpoint B (full gate)** — `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

---

## Tests to write (map design-system §-item → named test → assertion)
- **D1/D2 mechanism + thresholds → `layout-bucket.test.tsx`**: `bucketForWidth` returns compact@320/359, regular@360/750/767, wide@768/834/1024; `useLayoutBucket` (spy `useWindowDimensions`) returns compact/regular/wide at 320/390/900; **guard**: with NO spy, `useLayoutBucket()` === "regular" (the 750-default → frozen-snapshot invariant, D3).
- **§2.1 scaffold + §4/§3.2 preservation → `responsive-scaffold.test.tsx`**: wide(900) content container className contains `max-w-3xl` and `self-center` and footer column is centered; regular(390) className contains neither (byte-identical base); at wide the gradient testID (when `gradient`), `screen-scaffold-footer` (when `footer`), title `role="header"`, and children still render (SafeArea/KeyboardAvoiding preserved).
- **§1.2/§7.2 grids widen, §4 touch-target + §3.2 motion preserved → `responsive-grids.test.tsx`**: category item `w-[18%]`@wide vs `w-[30%]`@regular (and `min-h-[44px]` in both); quick-actions `basis-[22%]`@wide vs `basis-[45%]`@regular (testIDs + reduced-motion gating intact); activity-chip `basis-[18%]`@wide vs `basis-[28%]`@regular; services card wrapper `basis-[48%]`@wide vs direct/`w-full`@regular, all `services-card-*` testIDs present in both.
- **§7.3 reading column → `responsive-reading-columns.test.tsx`**: check-result content wrapper contains `max-w-2xl self-center`@wide, not@regular; emergency-notice renders before the summary card, `<VetDisclaimer/>` present, `check-result-*` testIDs preserved in both; paywall content + CTA footer contain `max-w-2xl self-center`@wide, not@regular; `paywall-*` testIDs preserved.
- **D3 frozen surfaces → existing suite unchanged**: `pet-home`/`paywall`/`check-result`/`weight-chart` snapshots pass byte-identically (Checkpoint A); no `.snap` diff, no snapshot-test edits.

## Commands to run to self-verify
- `pnpm --filter @pawcareright/mobile test`
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build`

## Interfaces/contracts
```ts
// apps/mobile/src/hooks/use-layout-bucket.ts
import { useWindowDimensions } from "react-native";
export type LayoutBucket = "compact" | "regular" | "wide";
export const LAYOUT_COMPACT_MAX = 360; // width < 360  => compact (tiny/small phones incl. 320 SE)
export const LAYOUT_WIDE_MIN = 768;    // width >= 768 => wide (tablets & large-landscape); 750 jest-default stays regular
export function bucketForWidth(width: number): LayoutBucket {
  if (width >= LAYOUT_WIDE_MIN) return "wide";
  if (width < LAYOUT_COMPACT_MAX) return "compact";
  return "regular";
}
export function useLayoutBucket(): LayoutBucket {
  return bucketForWidth(useWindowDimensions().width);
}
```
Wide-branch `WIDE_EXTRA` strings (Tailwind scale, no arbitrary px): scaffold content/footer `"w-full max-w-3xl self-center"`; check-result + paywall content/CTA `"w-full max-w-2xl self-center"`. Grid wide widths: category `w-[18%]`, quick-actions `basis-[22%]`/`min-w-[22%]`, activity `basis-[18%]`/`min-w-[18%]`, services wrapper `basis-[48%] grow`.

## Out of scope / do NOT touch
- `apps/mobile/src/components/vet-disclaimer.tsx`; `app/check/emergency/[checkId].tsx` (both byte-identical/frozen).
- The four pinned `.snap` files and their snapshot test `.tsx` (must NOT re-record or edit — D3).
- `card.tsx`, `weight-chart.tsx`, and any store/api/hook/query/logic; `packages/types`; screens not in the file list.
- Any `dark:`/font/color token, spacing token, motion, or copy (this is layout-conditional only).
- Protected files: `CLAUDE.md`, `LOOP_PROTOCOL.md`, `docs/MODEL_STRATEGY.md`, `docs/PHASES.md`, `docs/AI_PROVIDERS.md`, `docs/OTA_UPDATES.md`, `.claude/**`, any `.env`. No new deps.

## Risks & the decisions the planner made
- **R1 (jest-default coupling / snapshot freeze) — D2+D3.** The whole "no re-record" guarantee rests on jest default `window.width = 750` < `LAYOUT_WIDE_MIN = 768` ⇒ default bucket `regular` ⇒ every conditional resolves to the byte-identical base string. The `layout-bucket.test.tsx` 750→regular guard pins this so it can't silently break. If a future card lowers `LAYOUT_WIDE_MIN` below 750, the four snapshots WOULD shift and would then require explicit phone-width spies added to those snapshot tests (documented migration path; not done now).
- **R2 (7" tablet portrait ≈600dp treated as large phone).** With `wide`≥768, a 7" tablet in portrait (~600dp) renders the phone layout (2-col grids, no column cap); its landscape (~960dp) and all iPads get `wide`. Accepted trade-off: 600dp phone-layout still reads fine, and this is what buys the clean 750→regular snapshot invariant. "Both orientations where sensible" (card) covers it. Alternative (wide≥600) was rejected because it forces snapshot re-records/spy edits on the safety-critical check-result surface.
- **R3 (additive-conditional correctness).** Each edit MUST keep `BASE` character-identical to today and add classes ONLY in the wide branch; a leak into the `regular` path is caught by Checkpoint A (existing snapshots/className tests fail). Executor must not "tidy" existing strings.
- **R4 (max-w reading rule vs §7.2).** Using `max-w-3xl`/`max-w-2xl` (Tailwind scale) rather than an arbitrary `[600px]` keeps §7.2's no-arbitrary-px law intact while honoring §7.3's ~600px line-length intent (D6).
- **R5 (services 2-col structure change).** Wrapping cards on `wide` is a structural change but only in the wide branch and only on a non-pinned screen; `regular` stays byte-identical and all testIDs survive. If `card.tsx` already accepts `className`, executor passes it directly instead of wrapping (still no `card.tsx` edit).
- **R6 (safety surfaces untouched).** No disclaimer, emergency ordering/escalation, or dosing/med copy is added, moved, reworded, recolored, or reordered — the changes are purely a conditional max-width/column-count. Emergency screen is not modified at all (D4). Nothing fails downward.
