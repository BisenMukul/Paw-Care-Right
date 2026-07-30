# T110 Checker Progress Log

Append-only. One entry per mandatory check.

- [x] C1 inventory vs plan / deps / snapshots / api empty
- [x] C2 identity fast-path
- [x] C3 safety-key exclusion
- [x] C4 hard serve gate
- [x] C5 translation quality spot-check
- [x] C6 pseudo-locale leak test
- [x] C7 RTL smoke
- [x] C8 AC3 date/number/unit
- [x] C9 deviations
- [x] C10 gate reproduction + own mutations
- [x] C11 T097 machinery

## Entries

### C1 — inventory / deps / snapshots / api
`git status --porcelain -uall`: exactly 31 created + 7 modified (excluding `loop/**`), byte-for-byte
the plan §4 inventory. `git diff --stat HEAD -- pnpm-lock.yaml '**/package.json' package.json` EMPTY
→ zero-new-deps claim VERIFIED. `git diff --stat HEAD -- apps/api` EMPTY. `git diff --stat
apps/mobile/__tests__/__snapshots__` EMPTY (19 pre-existing snapshots byte-identical, re-verified
AFTER my own full test run); the only snapshot artefact is the untracked new
`rtl-smoke-snapshot.test.tsx.snap`. No hook-protected file, no `loop/loop-state.json`, no
`loop/journal.md`, no `docs/PHASES.md`, no `.github/**` touched. Forbidden-pattern grep (`any`,
`@ts-ignore`, `console.log`, bare `TODO`) over every created/modified file: ZERO hits. GREEN.

### C2 — identity fast-path
`apps/mobile/src/i18n/runtime.ts:61-67` → `resolveStrings(en, undefined)`;
`packages/config/src/i18n/resolve.ts:37-40` returns `en` by reference when overrides is
undefined/empty. `getLocaleOverrides` (`locale-registry.ts:73-87`) returns `undefined` for `en`
(and `ar`), so English is never cloned or proxied on the served path. 183 import sites confirmed
untouched: the whole diff is 7 files, and the only strings-related edits are inside `strings.ts`
itself (const rename + 1 import + 4 appended lines; zero copy bytes). Mutation B2 proves the
identity is genuinely pinned. GREEN.

### C3 — safety-key exclusion
Mobile English tree has 38 top-level sections; `TRANSLATED_SECTIONS` declares 6; the literal
`SAFETY_PINNED_PREFIXES` (32 entries, `locale-registry.ts:31-64`) is exactly the complement — I
enumerated the tree independently and the sets match. `check.`, `chat.`, `medForm.`, `weight.`,
`notifications.`, `intake.`, `breedGuide.`, `privacy.`, `paywall.` etc. are all pinned. Mutation A
(Spanish disclaimer plant) turns 3 independent specs RED. GREEN on mobile.
**NOT green on web:** `footer` is a declared translated section and `footer.notice` is the
"…is not a substitute for veterinary care" line — a §5-adjacent safety surface — and it is
machine-translated in all three web dictionaries. See finding F2.

### C4 — hard serve gate
`resolveServedLocale` (`locales.ts:150-153`) forces DEFAULT on anything not `reviewed:true`. I probed
`packages/config/dist/index.js` directly with 10 forced inputs: every production-path and every
device-negotiated path (`es-ES`, `ar-EG`, `hi-IN`) returns `en`; `prod + es override` → `en`;
`prod + en-XA override` → `en`. Only `NODE_ENV !== "production"` + an explicitly set env var can
select a non-`en` locale (intentional — it is the only way to exercise the pseudolocales), except
for the fail-open case when `nodeEnv` is *undefined* (finding F3). Pins: `locales.spec.ts:110-126`
and `i18n-safety-pins.test.ts:24-59` both go RED on a `reviewed:true` flip. GREEN with F3 noted.

### C5 — translation fidelity
Read all 3 web dicts in full (7 leaves each) and ~60 leaves each of the mobile es/pt-BR/hi dicts.
All are genuine, idiomatic translations of the exact English source (verified against
`strings.ts`'s `home`/`care`/`switcher`/`addPet` sections) — no copies, no garbage. Interpolation
placeholders preserved with correct parameter names (`stepOf(step,total)` → `Paso ${step} de
${total}`; `notice(appName)` → `${appName} ofrece…`). No translated string makes a medical claim
the English does not; `es`'s "no sustituye la atención veterinaria" and `hi`'s "पशु चिकित्सा
देखभाल का विकल्प नहीं है" both preserve the English hedge faithfully. Only nit:
`hi.home.greetingAfternoon` = "नमस्कार" (generic greeting, not literally "good afternoon") —
acceptable for an explicitly unreviewed machine dict. GREEN.

### C6 — pseudo-locale leak test
`pseudoTree` + `isPseudoTransformed` (`pseudo.ts:75-137`) mark every string leaf and wrap function
leaves with arity preserved (`Object.defineProperty(wrapped,"length",…)`, pinned by
`i18n-runtime.test.ts:121-127` — it matters for the T097 collector). The rendered leak test covers
Home / Check Result / Chat with an explicit dynamic-fixture allowlist plus a letter-free escape,
and a non-vacuity case asserting ≥600 leaves and 100 % of string leaves marked. 3-screen choice is
sane — Check Result is the §5 surface. The static scan is honest but weak — finding F5.
GREEN with F5 noted.

### C7 — RTL smoke
New snap file only; 3 `exports[` blocks, 78 RLM (U+200F) occurrences and 39 pseudo-bracket pairs in
43 854 bytes — genuinely RTL-marked output, e.g. `accessibilityLabel="‏⟦Ḃäċķ⟧‏"`. `getTextDirection`
table asserted for `ar`, `ar-XB`, `en`, `es`, `pt-BR`, `hi`
(`rtl-smoke-snapshot.test.tsx:225-232`) plus base-language resolution in `locales.spec.ts:34-57`.
The fake-timers fix (`rtl-smoke-snapshot.test.tsx:149`) is legitimate — the Home greeting is
time-of-day dependent and the fix mirrors `home-screen.test.tsx`'s existing `freezeHour` pattern;
it only regenerated the NEW snap file. GREEN.

### C8 — AC3
All 7 AC3 rows present in `i18n-format.test.ts` and passing, including the whole-domain
byte-equality pin (`WEIGHT_MIN_GRAMS`..`WEIGHT_MAX_GRAMS` step 37, both units, against an in-test
replica of the pre-T110 `toFixed(1)`) and the `formatCheckDate` end-to-end ISO pin. Both modified
modules are behaviour-preserving for `en` by construction: `formatEntryDate(iso,"en")` returns the
identical `toISOString().slice(0,10)`, and `formatDecimal(…,"en")` with `useGrouping:false` is
byte-identical to `toFixed(1)` over the domain. GREEN.

### C9 — deviations
(1) Render tests `jest.mock("../src/strings", …)` instead of `resetModules` + env: the cited hazard
is real and documented in-repo — `apps/mobile/__tests__/breed-guide-explore.test.tsx:15-16`
("no `jest.resetModules()`/re-require needed, so there is no risk of a duplicate React module
instance"). The mock applies the *exact* transform the runtime applies for `en-XA`/`ar-XB`, and the
env-var→runtime wiring is separately pinned by `i18n-runtime.test.ts:106-118`. ACCEPTED.
(2) `LocaleOverrides<T>` `| undefined` arm (`resolve.ts:10-18`): correct under
`exactOptionalPropertyTypes` (`?:` alone rejects an explicit `undefined`), and the resolver honours
it (`resolve.ts:52` skips `undefined` → keeps English). Does not weaken the excess-property or
leaf-kind pins. ACCEPTED.

### C10 — gates + own mutations
Full independent re-run (log:
`/tmp/claude-0/-home-user-Paw-Care-Right/f54fd007-b021-502a-b165-6ca50411f587/scratchpad/gates.log`):
`config build` OK → `typecheck` 16/16 → `lint` 15/15 → `test` 16/16 → `build` 9/9. Per-workspace
counts match the executor's claims exactly (mobile 216/1928/22; web 20/249; api 120/1223; config
5/83; types 28/655; ai 42 of 44 suites, 631/634, 3 pre-existing skips). `packages/ai` untouched →
`pnpm test:ai-evals` not required. 5 checker mutations, each sha1-restored — see the review file.

### C11 — T097 machinery
`strings-detector-lint.test.ts` (mobile) + `strings-detector-lint.spec.ts` (web) are unmodified and
green over the post-T110 tree (mobile lint re-run explicitly: 7 suites/100 tests/3 snapshots PASS;
web lint green inside the 20/249 run). Their `>= 600` / `>= 150` leaf-count non-vacuity assertions
still hold — Mutation B (a value-destroying clone) turned them RED, proving they are live. The
locale dictionaries are deliberately NOT scanned by `scanUnsafeText` (English-pattern-only, plan
R3) — a sane exemption strategy — but the substitute scan T110 ships in its place has a proven hole
(findings F1/F2).

---

## RE-REVIEW (fix round F1/F2/F3)

- **Fix scope:** inventory unchanged at 38 paths (31 created + 7 modified); `git diff --stat HEAD`
  on tracked files byte-identical to pre-fix (56+/11-) → only task-created files were edited. api
  diff EMPTY, lockfile/package.json diff EMPTY, 19 snapshots byte-identical, forbidden patterns 0.
  Mobile `es.ts` sha1-identical to my pre-fix backup (correctly untouched).
- **F1 RESOLVED:** both scans invoke function leaves via the `fn.length` idiom
  (`i18n-safety-pins.test.ts:113-126`; `locale-coverage.spec.ts:120-132`/`:157-169`); web gained the
  dose+diagnosis scans it lacked. Re-plant into web `es.globalError.body` → RED ×2; re-plant into
  mobile function leaf `es.addPet.common.stepOf` → RED ×2. Both previously passed silently. Each
  scan also carries a function-leaf non-vacuity control.
- **F2 RESOLVED:** web `TRANSLATED_SECTIONS` = `["globalError"]`; `footer.` added to
  `SAFETY_PINNED_PREFIXES`; footer block genuinely deleted from all 3 web dicts (grep + backup diff);
  byte-identity pin at `locale-coverage.spec.ts:104-106`. Re-plant of a translated footer → RED ×3.
  Fallback probe: a section absent from a dict is preserved by REFERENCE
  (`merged.footer === en.footer` true), so the English vet-care notice is served verbatim.
- **F3 RESOLVED:** allowlist at `locales.ts:176`. Probe: undefined / "" / "staging" / "production"
  + override → all `en`; `test`/`development` overrides still yield `en-XA`/`ar-XB`. 2 new pins.
- **docs/I18N.md:** §5 and §6 re-read sentence by sentence against the specs — every claim now true.
- **Gates round 2** (`scratchpad/gates2.log`, EXIT=0): typecheck 16/16, lint 15/15, test 16/16,
  build 9/9; mobile 216/1930/22, web 20/262, config 5/85, api 120/1223 unchanged. Deltas fully
  accounted for (+2 / +13 / +2).
- **VERDICT: pass.** Residual F4-F8 are LOW/INFO follow-ups.
