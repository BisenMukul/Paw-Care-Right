# T098 — Full regression + coverage gate

## 1. CI-run honesty statement (read first)

**No GitHub Actions run has been executed or observed for T098. The three runs below are LOCAL
full-gate runs. The real-CI green requirement is founder-verifiable on the next push and is recorded
as OPEN.**

This environment cannot trigger, observe, or link a GitHub Actions run. The substitute mandated by the
plan is 3 consecutive full LOCAL gate runs of the entire CI command set, cold (`TURBO_FORCE=true`,
zero cache reuse for the forced tasks; `test:cov`/`test:ai-evals` are always uncached), all green, with
real per-workspace test counts and exit codes recorded below. This statement, unhedged, also appears in
the M9 readiness section (§7) and must be carried into `loop/journal.md` verbatim.

---

## 2. Flake docket disposition (items 1–7)

| # | Item | Root cause | Fix | File:line | Proof |
|---|---|---|---|---|---|
| 1 | `billing-webhook-fuzz.e2e-spec.ts` global-count drift | `countRows()` used unscoped `prisma.processedWebhookEvent.count()` / `prisma.subscription.count()`, so unrelated e2e specs sharing the same live Postgres could contaminate the before/after diff, making the four count assertions order/concurrency-dependent (`loop/reviews/T097.review.md §7`). | Scoped both counts to the fixture's own rows: `{ where: { eventId: { in: eventIds } } }` / `{ where: { rcAppUserId: { in: userIds } } }`. `in: []` correctly yields 0 for the first three tests (no owner context yet). | `apps/api/test/billing-webhook-fuzz.e2e-spec.ts:63-73` | MU1 (§6) — scoped counter still goes RED when a fixture-keyed row appears unexpectedly. |
| 2 | `dynamic-type.test.tsx` intermittent flake | Hypothesized: `await render(...)` is not an async settle-gate; the home/chat screens fetch through a real `QueryClientProvider` answered by a mocked `apiClient.get`, so the walked tree could be loading-skeleton or loaded-content depending on scheduling. **Reproduction probe (MU17) did NOT reproduce a flip** in this environment (12/12 green with a deliberately delayed mock resolution) — see §6. Root cause therefore stated honestly as UNCONFIRMED. | Applied both plan-mandated strengthenings anyway as determinism hardening: (a) `mockedGet.mockReset()` before each describe's `mockImplementation` (removes queued `mockImplementationOnce` bodies that `jest.clearAllMocks()` does not clear — the T094-F2 root-cause family); (b) an explicit settled-tree gate before every `toJSON()`/node-walk. **Deviation from the plan's literal text, discovered and fixed under orchestrator adjudication (option b):** the plan named `"home-header"` as the home describe's gate, but that testID is `HomeHeader`'s unconditional first-child chrome (rendered before `useActivePet()` resolves) — gating on it did not reliably settle the query-dependent branch (measured: still 2/3 flaky with the literal gate). The correct gate is `"home-open-active-pet"` (`PetHeroCard`'s own testID, rendered only inside the `hasActivePet && pet` branch). With the corrected gate, `no fixed-height container wraps text` went **deterministically RED (4/4)**, exposing a real, previously-hidden §4.5 violation in `apps/mobile/src/components/home/pet-hero-card.tsx` (see docket-2b below). | `apps/mobile/__tests__/dynamic-type.test.tsx:184-231` (home describe), `:335` (chat describe, `mockReset` only — chat's gate was already correct) | MU17 (§6) — unreproduced; honest statement recorded. |
| 2b | (new, discovered by closing #2) `pet-hero-card.tsx` avatar box — real §4.5 violation | `PetHeroCard`'s avatar (`home-pet-avatar`) was a fixed `h-20 w-20` (80×80) box wrapping the pet-name-initial `Text`, with neither `allowFontScaling={false}` nor `maxFontSizeMultiplier` — a genuine, pre-existing `docs/design-system.md §4.5` violation ("No fixed heights on text containers"), invisible before because the racy/ungated test in isolation always happened to capture the tree *before* this box committed. **Orchestrator-adjudicated (option b)**: `apps/mobile/src/components/home/pet-hero-card.tsx` added to the file list for a narrowly-scoped fix. Two remedies were weighed: (i) cap the initial's `maxFontSizeMultiplier` (decorative-monogram framing) — **rejected**: `dynamic-type.test.tsx`'s `isRealText()` only exempts nodes with font scaling disabled outright (the Ionicons-ligature case), not merely capped ones, so a capped-but-still-fixed box would still trip `fixedHeightTextContainers()`, and rightly so (an unusually wide glyph could still clip at extreme scales). (ii) **chosen**: `h-20 w-20` → `min-h-20 min-w-20` — the doc's own prescribed remedy ("min-heights + flex only"); the circle grows with the initial instead of clipping it. | `apps/mobile/src/components/home/pet-hero-card.tsx:53` | `dynamic-type.test.tsx`'s home-describe "no fixed-height container" test, now green 5/5 isolated runs; related regression sweep (dual-theme-tokens, home-screen, home-gradient-scheme, pet-home-snapshot, pet-home-screen) 71/71 green, snapshots unaffected. |
| 3 | `storage-audit.test.ts` second-store-per-file gap | The credential-shape and pinned-names tests each used a single `.match()` (first hit only) against `name:`/`partialize:` declarations, so a *second* persisted store in the same source file (its own `name`/`partialize` pair) was invisible to the scan (T096 review nit). | Extracted two pure helpers, `persistedRegions(source)` and `persistedStoreNames(source)`, both using `matchAll` (global flags) to collect every declaration, not just the first. Rewrote both tests to use the helpers; updated the stale `:136-142` comment to describe the real (now-correct) behavior. | `apps/mobile/__tests__/storage-audit.test.ts:104-131` (helpers), `:159-207` (rewritten tests + new non-vacuity test) | New test "a second persisted store in the same file is detected" — synthetic two-store source, asserts both names are found and the credential-shaped `partialize` in the *second* store is flagged (MU12, §6). |
| 4 | `strings-detector-lint.spec.ts` exemption is excerpt-shaped, not exact-value (T097 review F2) | `ALLOWLISTED_NORMALIZED_FINDINGS` matched on a *stripped finding excerpt* (`stripPath`), so a leaf that merely *contained* the exempted excerpt string, embedded in otherwise-harmful copy, would also be silently exempted. | Replaced with `EXEMPT_LEAF_VALUES = new Set(EXEMPTIONS.map(e => e.value))`, keyed on the **exact leaf value**; filter leaves (not findings) before scanning. Deleted `stripPath` (now unused). Added a dedicated collision test proving a leaf that contains the exempted excerpt (but isn't byte-identical to it) is still flagged. Strengthened "allowlist hygiene" with a genuinely-needed proof (`scanUnsafeText(exemption.value, "EXEMPT")` must be non-empty and contain the exemption's own code). Fixed the F1 comment inaccuracy (byte-pin is this spec's own stale-entry check, not `legal-content.spec.ts`, which only asserts a lowercase `toContain("cruelty")` substring). Mobile counterpart has zero exemptions — left untouched (not in scope). | `apps/web/src/strings-detector-lint.spec.ts:75-84` (comment fix), `:117-121` (exact-value exemption set), `:151-158` (no-strings-leaf test using it), `:187-195` (new collision test), `:197-212` (strengthened hygiene test) | New test "the exemption is exact-value, not excerpt-shaped" (MU13, §6); "allowlist hygiene"'s new genuinely-needed check (MU14, §6). |
| 5 | `docs/PERFORMANCE.md:21` aggregation-method inaccuracy (T095 review F5) | The doc said `numberOfRuns: 3` provides "median-of-3 variance protection", but `apps/web/lighthouserc.json` never sets `aggregationMethod`, so lhci's documented default (`optimistic`) applies — for a `minScore` assertion, `optimistic` selects the **best** of the 3 runs (`Math.max`), not a median. The shipped gate is honestly "best-of-3 ≥ 0.90", weaker than the prose implied. | Corrected the doc prose to state the true `optimistic`/best-of-3 semantics, citing `@lhci/utils`'s `assertions.js:139` default and `loop/reviews/T095.review.md` F5 — **not** flipping `aggregationMethod` to `"median"` (the T095 checker's own fresh landing measurement was exactly 0.90, on the line; switching to median would put a required gate on a coin-flip, and the only exits from that flake would be a perf fix — out of scope for a stabilization card — or a forbidden threshold lowering). Added a jest pin so config and prose cannot drift apart again. `apps/web/lighthouserc.json` itself is frozen and untouched. | `docs/PERFORMANCE.md:21-46` (reconciled prose) | New test "the config does not override lhci's aggregationMethod" in `apps/web/src/perf/lighthouse-budget.spec.ts` (MU7-adjacent; direct pin, not a numbered MU row). |
| 6a | `a11y-static-scan.test.ts` rule-4 non-vacuity floor too weak (T093 advisory 2) | The `[AUTO]` tag count floor was `toBeGreaterThan(0)`, so a doc that shrank from 16 rows to 1 would still pass. | Measured the real, current count (16, grep-confirmed independently of the T093 checker's own count) and raised the floor to `toBeGreaterThanOrEqual(16)`. | `apps/mobile/__tests__/a11y-static-scan.test.ts:206-211` | MU15 (§6) — deleting 10 `[AUTO]` rows from the script now goes RED (was GREEN before this fix). |
| 6b | `a11y-sweep.test.tsx` duplicate test title (T093 advisory 3) | The title `"every interactive element exposes a role or a label"` appeared in both the welcome and chat describes, making the two `[AUTO]` citations in `docs/qa/a11y-script.md` (Flow 1 step 4, Flow 5 step 1) ambiguous. | Renamed to flow-scoped titles (`"every welcome-screen interactive element exposes a role or a label"`, `"every chat-screen interactive element exposes a role or a label"`), following the file's own existing idiom; updated both `[AUTO]` tags in `docs/qa/a11y-script.md` verbatim. No assertion body touched. | `apps/mobile/__tests__/a11y-sweep.test.tsx:194,516`; `docs/qa/a11y-script.md:40,95` | Rule 4 (doc↔test agreement) stays green with the disambiguated titles — itself the proof the rename and doc edit shipped together correctly. MU16 (§6) — renaming one title without updating the script now goes RED. |
| 7 | T084-F1-era exact-count issue (fixed in T088) | N/A — verified by observation only, per plan. | No fix needed this round. | — | Observed across the fresh 3× mobile + 3× api sweep (§5) and the 3× full-gate `pnpm test` runs (§6): **no count-drift failure recurred in any of the 6+ mobile/api runs performed while building this task.** Every suite/test count was stable and reconciled exactly against the expected deltas from this task's own edits (see §6's per-run tables). |

---

## 3. Coverage

### 3a. `apps/api` (scope: `src/**/*.service.ts`, CLAUDE §6 "coverage on services")

Measured (real `pnpm --filter @pawcareright/api test:cov` run, live Postgres+Redis+MinIO):

| Metric | Global | Threshold |
|---|---|---|
| Statements | **96.7%** | ≥ 80% (pre-existing, T020) |
| Branches | **82.02%** | ≥ 70% (pre-existing, T020, **unchanged**) |
| Functions | **97.57%** | ≥ 80% (pre-existing, T020) |
| Lines | **96.77%** | ≥ 80% (pre-existing, T020) |

**Every individual `*.service.ts` file measured ≥ 80% statements** (minimum observed:
`reminder-scheduler.service.ts` at 88.37%; next-lowest `account-export.service.ts` 91.54%,
`breeds.service.ts` 91.42%, `analytics.service.ts` 92.59%, `push-sender.service.ts` 94.4% — no file below
80%). Because every service file clears the bar, the per-path threshold added this task is **born
green**, per H2 ("a gate born red is forbidden"):

```json
"src/**/*.service.ts": { "statements": 80 }
```

No global number was changed in either direction; `branches: 70` remains the pre-existing T020 value.

**Known coverage gaps NOT closed by T098:** none at the service-file level (all clear 80%). Processors
and guards are outside `collectCoverageFrom`'s glob (`src/**/*.service.ts` only) — a known T040-era
scope note (journal line ~480); widening the glob is explicitly out of scope for this stabilization card
(D3) to avoid shipping a red-born gate.

### 3b. `packages/ai` (no coverage config existed before this task)

Added `test:cov` script, `collectCoverageFrom`, `coverageDirectory`. Measured (no threshold, pure
measurement first, per H2):

| Metric | Global |
|---|---|
| Statements | **93.58%** |
| Branches | **77.08%** |
| Functions | **97.58%** |
| Lines | **93.92%** |

All four clear `80/80/80/70`, so the threshold added mirrors the api's shape exactly and is **born
green**:

```json
"global": { "statements": 80, "lines": 80, "functions": 80, "branches": 70 }
```

`collectCoverageFrom` excludes four non-product entrypoints (D3), each with a one-line reason:
- `src/index.ts` — pure barrel re-export, no logic of its own.
- `src/evals/run.ts` — CLI harness runner (invoked by `test:ai-evals`), not a unit-testable module.
- `src/content/generate-breed-guides.ts` — one-shot content-generation CLI script.
- `src/**/*.spec.ts` — the tests themselves.

No exclusion was needed beyond these four to clear the bar (all four metrics already cleared 80/80/80/70
before any exclusion was even strictly necessary; they are excluded on principle as non-product code, not
to inflate the measurement).

### 3c. How to run it locally

```
pnpm --filter @pawcareright/api test:cov
pnpm --filter @pawcareright/ai test:cov
pnpm test:cov   # both, via turbo, cache: false
```

### 3d. Pipeline wiring

`turbo.json` declares `test:cov` with `cache: false` (D4 — a cached green would make the "3 cold
consecutive runs" evidence meaningless; precedent: `test:ai-evals` is already `cache: false`). Root
`package.json` exposes `"test:cov": "turbo run test:cov"`. `.github/workflows/ci.yml`'s existing `build`
job runs `pnpm test:cov` immediately after `pnpm test`, unconditionally (no `if:` at step or job-preamble
level) — living in that job (not a new one) because postgres/redis/MinIO are already provisioned there
(D2); the tradeoff is a longer critical path (api+ai suites re-run instrumented) in exchange for not
duplicating the services block. `apps/api/test/coverage-gate.spec.ts` pins all of the above so it cannot
be silently disabled, weakened, or re-cached.

---

## 4. E2E smoke (Playwright)

Two tests in `apps/web/e2e/smoke.spec.ts`:

1. **"landing renders its hero and the vet disclaimer"** — `goto("/")`; asserts the `h1` equals
   `buildLandingModel(APP_DISPLAY_NAME).hero.title`; asserts `[data-testid="vet-disclaimer"]` is visible
   and contains the real disclaimer sentence; asserts `[data-testid="landing-emergency-note"]` is
   visible.
2. **"a toxic food page renders the verdict hero and the emergency hotline CTA"** — asserts the fixture
   precondition (`buildFoodPageModel("can-dogs-eat","grapes")` is non-null and `showHotlineCta === true`)
   first, so a dataset change fails loudly; `goto("/can-dogs-eat/grapes")`; asserts the `h1`, the verdict
   label/headline (exact text match — see finding below), the hotline CTA's visibility and its
   `tel:`-href link, and that the CTA appears **before** the `h1` in DOM order (CLAUDE §7 rule 4 —
   escalation before content).

**Dependency:** `@playwright/test` added as an `apps/web`-only devDependency (card-sanctioned per CLAUDE
§3/§2 rule 7). Resolved version **1.62.0**. Lockfile resolution-count delta: **1672 → 1676** (+4:
`@playwright/test`, `playwright`, `playwright-core`, `fsevents@2.3.3`).

**Browser resolution (Step 10b):** the resolved chromium revision for playwright-core 1.62.0 is
**1234**, not the `/opt/pw-browsers/chromium-1194` precedent from T085/T095. Branch taken: **3** —
`pnpm --filter @pawcareright/web exec playwright install chromium`, downloaded via the configured proxy
to `/opt/pw-browsers/chromium-1234` (184.3 MiB Chrome for Testing 151.0.7922.34 + 114.7 MiB headless
shell). `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` used on the command line for local runs only, never
committed to `playwright.config.ts`.

**A genuine environment finding, investigated and resolved without touching any frozen file:**
Playwright's own module loader (regardless of `import`, `require()`, or dynamic `import()` syntax)
mis-resolves the `@pawcareright/types` workspace package specifically — it returns an empty/default-only
module in this environment, reproducibly, for every named export (`vetDisclaimerLine`, `petIdSchema`,
etc.), while `@pawcareright/config` (a much smaller bundle) resolves correctly via the identical
resolution shape. This was verified NOT to be a product bug: `packages/types/dist/index.js` and
`dist/index.cjs` both load correctly (157 named exports) via plain Node (`node -e "require(...)"` and
`node --input-type=module -e "import(...)"`), and via `ts-jest` (the "frozen copy is byte-identical" jest
test in `strings-detector-lint.spec.ts` passes, proving `strings.disclaimer` resolves correctly under
jest). The break is isolated to Playwright's own transform/loader for this one large tsup-bundled ESM
package. Since `apps/web/src/strings.ts` (frozen, cannot be edited) imports `vetDisclaimerLine` from
`@pawcareright/types` at module scope, `strings.disclaimer(...)` is `undefined` under Playwright in this
repo/environment specifically — every other `strings.*` property (plain template literals with no
`@pawcareright/types` dependency) is unaffected. **Fix, entirely within `apps/web/e2e/smoke.spec.ts`
(not a frozen file):** the expected disclaimer text is computed via `execFileSync` spawning a genuinely
separate `node` process that correctly requires the real `@pawcareright/types` package — still fully
derived from the real source of truth (CLAUDE §6, never hardcoded), zero product-file touch, and
documented inline in the spec file. A second, unrelated, real bug was also found and fixed in my own
first draft of the test: `page.getByText(model.verdictLabel)` without `{ exact: true }` was a Playwright
strict-mode violation (9 ambiguous substring matches on the food page) — fixed by adding `{ exact: true
}` to both `getByText` calls in test 2.

**Local run result (Step 10h):** `pnpm --filter @pawcareright/web build` then
`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers pnpm --filter @pawcareright/web test:e2e` — run **3 times**
independently (once standalone, twice more as part of each of the 3 cold full-gate cycles in §6): **2/2
tests passed every time**, deterministic (`retries: 0`, no flakes observed).

**CI wiring:** `.github/workflows/ci.yml`'s `web-e2e` job follows the `web-perf-budget` pattern exactly —
unconditional (no `if:` at job or step level), no secret, `pnpm i --frozen-lockfile` →
`pnpm --filter @pawcareright/web build` → `npx playwright install --with-deps chromium` →
`pnpm --filter @pawcareright/web test:e2e`, plus an `if: always()` Playwright-report artifact upload.
`apps/web/src/e2e/e2e-gate.spec.ts` pins the config shape, the package script, the CI job, and the
smoke suite's exact two-test count.

---

## 5. Fresh flake sweep (Step 11 — "the hunt") — this section's own findings turned out to be the main event

Per H1/D1 honesty, the 3× mobile + 3× api sweep this step calls for is satisfied by (and cross-checked
against) the `pnpm test`/`pnpm test:cov` steps inside the **9 individually-green full-gate cycles** run
while building this task (§6) — collectively far more than a standalone 3×/3× sweep would provide. No
count-drift failure (docket 7) recurred in any run; every mobile/api suite/test count was stable and
reconciled exactly against this task's own edits across all 9 green runs and all red ones alike (the
counts never drifted — every red run failed on an *assertion inside one test*, never on a *changed
count*).

**This step's "hunt" surfaced real, reproducible, pre-existing, out-of-scope flakes — recorded honestly,
not fixed, not masked:**

1. **`test/account-deletion.e2e-spec.ts` — Prisma-engine-connect timing race (observed 3× total,
   2 different test cases within the file):**
   - First occurrence (during initial coverage measurement, §3a, before official gate cycles): `sole-owner
     deletion… proves the full cascade (AC1)` failed with `expect(await
     storage.objectExists(petAOriginal)).toBe(false)` receiving `true` (an S3/MinIO object-still-present
     timing symptom). An immediate re-run of the identical command was 107/107 suites, 1093/1093 tests,
     fully green.
   - Second occurrence (gate cycle v2, run 3): `grace period is enforced… survives while
     deletionScheduledAt is in the future, then is erased once it's in the past` failed with `Invalid
     this.prisma.accountExport.findMany() invocation … Engine is not yet connected`, inside a BullMQ
     `QueueEvents.onFailed` callback calling into `apps/api/src/workers/account-deletion.service.ts:120`'s
     `purgeExpiredExports`.
   - Third occurrence (gate cycle v4, run 3): the same `Engine is not yet connected` symptom, a
     *different* test case (`F1 regression (checker review): a user who left a shared household still
     gets fully erased`).
   - **Diagnosis (read-only investigation, no file touched):** `account-deletion.service.ts` itself has
     no direct `QueueEvents`/`onFailed` code — that lives in the *test file*, which registers its own
     `QueueEvents` listener per test and tears down its own `PrismaClient`/Nest app in `afterAll`. The
     working hypothesis: under `test:cov`'s added instrumentation overhead (measurably slower execution
     throughout this task's own timing data), a job's asynchronous BullMQ failure/completion event can
     fire *after* a preceding test's `afterAll` has already begun disconnecting its Prisma engine,
     racing the connect/disconnect lifecycle — a pre-existing test-cleanup ordering issue that mostly
     stays latent at normal `pnpm test` speed but surfaces reliably under `test:cov`'s slower profile
     (never observed in a plain, non-coverage `pnpm test` run across this entire task; always in
     `test:cov`).
   - **Named owner task:** the `account-deletion.e2e-spec.ts` teardown-ordering / Prisma-engine-lifecycle
     race under coverage-instrumented load. Out of scope for T098 — `apps/api/src/**` is frozen and the
     spec file is not on this card's file list.

2. **`test/devices.e2e-spec.ts` — concurrent-request `ECONNRESET` (observed 2×):** `parallel register of
   the same token → all 200, exactly 1 row` — a test that deliberately fires several concurrent requests
   — failed both times with a raw socket-level `read ECONNRESET` (once during the `test` step in cycle
   v3 run 2, once during `test:cov` in cycle v7 run 1). Not a code assertion failure; a genuine
   connection-handling race under concurrent load in this resource-constrained (4-CPU) container.
   **Named owner task:** investigate whether the app/test needs connection-pool or keep-alive tuning
   under concurrent load; out of scope for T098 (file not on this card's list, `apps/api/src/**`
   frozen).

3. **eslint/tsup/jiti temp-bundled-config race (observed 2×, two different packages):** `@pawcareright/
   analytics` (cycle v5 run 3) and `@pawcareright/api-client` (cycle v6 run 1) both failed `lint` with
   `ENOENT: no such file or directory, open '.../tsup.config.bundled_<hash>.mjs'` — a race between
   ESLint's jiti-based config loading and tsup's own jiti-based config bundling for the same package
   under turbo's parallel task scheduling (turbo runs each package's `build` — a `lint` dependency per
   `turbo.json` — and its `lint` step, and the two can race on the same temp filename). This is a
   tooling/environment characteristic of this container under repeated heavy parallel load, not a
   repo-code bug; `git diff --stat` confirmed zero diff in either package for both occurrences.

All three are genuinely new findings this stabilization card's "hunt" step exists to surface — and they
are the direct, documented reason the literal "3 consecutive full-gate runs" AC in §6 was not achieved
despite 9 individually-green cycles. See §6/§7 for the full ledger and the honest final position.

---

## 6. The three consecutive full local gate runs (the AC, per H1) — HONEST RESULT: NOT ACHIEVED

Sequence (from repo root, cold): `pnpm typecheck` → `pnpm lint` → `pnpm test` → `pnpm test:cov` →
`pnpm build` → `pnpm test:ai-evals` → `pnpm audit --audit-level high` →
`node scripts/scan-secrets.js --tracked` → `pnpm --filter @pawcareright/web build` →
`pnpm --filter @pawcareright/web test:e2e`.

**Note on scope:** the lighthouse (`web-perf-budget`) job is intentionally **excluded** from this
sequence — it is a separate CI job already proven green by T095, and it needs the container-only
`CHROME_PATH`/`--no-sandbox` invocation rather than the `PLAYWRIGHT_BROWSERS_PATH` used for the E2E
smoke. This exclusion is stated explicitly rather than implying full-CI parity.

**Bottom line, stated plainly: across 7 attempted 3-run cycles (this section's full ledger below),
the literal AC — three consecutive cold full-gate runs, zero red in between — was NOT achieved.** This
is reported honestly rather than papered over. What *was* achieved: **9 individually-green full-cycle
runs** across the session (see the ledger), and every single red run was independently investigated and
confirmed to touch **zero T098 files** (checked via `git status`/`git diff` immediately after each), with
one exception — the very first attempt at the very first run, which hit a real bug in *this task's own*
new code and was fixed before any run was counted (see below). No red was ever masked, retried away
silently, or hidden; every one is itemized here with its own diagnosis.

### Attempt-by-attempt ledger (all timestamps UTC, all cold/`TURBO_FORCE=true` per the sequence above)

| Cycle | Run | Result | Notes |
|---|---|---|---|
| v1 (first pass) | 1 | **RED at typecheck** | Real bug in this task's own new code: `apps/mobile/__tests__/storage-audit.test.ts:129,201` — `match[1]` from `matchAll()` and an array index read are both typed `string \| undefined` under this tsconfig's `noUncheckedIndexedAccess`; my new `persistedStoreNames` helper and a test line didn't account for it (TS2322/TS2345). **Fixed immediately** (filtered `undefined` out of the helper's result; non-null-asserted the already-length-guarded `partializeRegions[0]`) — exactly the kind of thing this stabilization card exists to catch. Per H1/Step 12, this restarts the count at run 1 (it does, since it's the very first run of the very first cycle — no prior green run is lost). |
| v1 (retried) | 1 | **ALL GREEN** | 2026-07-26T01:52:45Z → 01:59:58Z. Full counts/coverage in git history of this doc's first draft. |
| v1 | 2 | **ALL GREEN** | 2026-07-26T02:00:30Z → 02:07:25Z. |
| v1 | 3 | **RED — self-inflicted** | While run 3 executed, I ran an MU3 mutation-proof experiment (`apps/api/package.json` `coverageThreshold.global.statements` → 50) concurrently, and its `test:cov` step picked up the mutated file mid-run. This was my own process error (running an experiment against the live repo while a gate cycle was executing), **not an independent finding** — restored immediately, sha1/git-diff verified clean. Per H1, restarts the count. Lesson applied for the remainder of the task: zero concurrent repo work during any gate cycle from this point on. |
| v2 | 1 | **ALL GREEN** | 2026-07-29T12:28:40Z → 12:34:09Z (session resumed after a ~10h idle gap; orchestrator restarted postgres/redis/minio, verified healthy). |
| v2 | 2 | **ALL GREEN** | 2026-07-29T12:34:30Z → 12:39:52Z. |
| v2 | 3 | **RED — genuine, pre-existing, out-of-scope flake** | `test/account-deletion.e2e-spec.ts` › "grace period is enforced… survives while deletionScheduledAt is in the future, then is erased once it's in the past" failed at `test:cov`: `Invalid this.prisma.accountExport.findMany() invocation … Engine is not yet connected` inside a BullMQ `QueueEvents.onFailed` callback (`apps/api/src/workers/account-deletion.service.ts:120`). `git status`/`diff` confirmed zero T098 diff; `apps/api/src/**` is frozen and `account-deletion.e2e-spec.ts` is not on this card's file list — not fixed, documented (§5). |
| v3 | 1 | **ALL GREEN** | 2026-07-29T12:44:35Z → 12:49:55Z. |
| v3 | 2 | **RED — genuine, pre-existing, out-of-scope flake** | `test/devices.e2e-spec.ts` › "parallel register of the same token → all 200, exactly 1 row" failed at `test` with a raw `read ECONNRESET` (socket-level reset under a concurrent-request stress assertion). Not on the file list; zero T098 diff confirmed. |
| v4 | 1 | **ALL GREEN** | 2026-07-29T12:54:34Z → 12:59:45Z. |
| v4 | 2 | **ALL GREEN** | 2026-07-29T12:59:55Z → 13:05:07Z. |
| v4 | 3 | **RED — same class as v2's run 3** | `account-deletion.e2e-spec.ts`, a *different* test case this time ("F1 regression (checker review): a user who left a shared household still gets fully erased"), identical `Engine is not yet connected` symptom, same `purgeExpiredExports`/`QueueEvents.onFailed` path. Confirms this is a real, reproducible-under-`test:cov` timing race in that spec file's test-cleanup ordering (see diagnosis in §5), not a one-off fluke — and not something T098 touches. |
| v5 | 1 | **ALL GREEN** | 2026-07-29T13:10:37Z → 13:15:49Z. |
| v5 | 2 | **ALL GREEN** | 2026-07-29T13:16:13Z → 13:21:28Z. |
| v5 | 3 | **RED — different failure class** | `@pawcareright/analytics` `lint` step: `ENOENT: no such file or directory, open '.../packages/analytics/tsup.config.bundled_<hash>.mjs'` — a genuine race between ESLint's (jiti-based) config loading and tsup's own jiti-based config bundling for the *same* package under turbo's parallel task scheduling. `packages/analytics` has zero T098 diff (verified via `git diff --stat`). |
| v6 | 1 | **RED — same lint-race class, different package** | Identical `ENOENT .../tsup.config.bundled_<hash>.mjs` pattern, this time in `@pawcareright/api-client` (also zero T098 diff). Confirms this is a systemic, probabilistic race in the eslint/tsup/jiti interaction under this container's parallel scheduling, not a one-off. |
| v7 | 1 | **RED — devices.e2e-spec.ts again** | Same ECONNRESET symptom as v3's run 2, this time surfacing at the `test:cov` step instead of `test`. Second independent occurrence of this specific test's concurrency race. |

**Stopped here** per explicit orchestrator direction ("don't let another stall eat the deliverable") —
continuing to retry an unbounded number of times against a recurring, well-diagnosed, out-of-scope
environment race would not be a productive use of time and risks never converging (the observed
per-attempt failure rate on unrelated pre-existing specs is roughly 1-in-2 to 1-in-3 across the last
several cycles, concentrated in exactly three recurring locations: `account-deletion.e2e-spec.ts`'s
Prisma-engine-connect timing, `devices.e2e-spec.ts`'s concurrent-request-stress `ECONNRESET`, and the
eslint/tsup/jiti temp-config-file race — none of which are on this card's file list or touchable given
`apps/api/src/**`'s frozen status).

**Best available immediately-adjacent evidence:** v4's run 1 + run 2 and v5's run 1 + run 2 are each two
back-to-back cold full-gate cycles, fully green, with identical per-workspace counts and coverage
numbers in every case (config 27/2 · types 566/25 · data 198/8 · api-client 80/8 · analytics 45/6 · ai
631+3skip/42-44 · mobile 1417/173/19snap · api 1103/108 · web 203/16; api coverage 96.7–96.81 /
82.02–82.14 / 97.57 / 96.77–96.83; ai coverage 93.58/77.08/97.58/93.92 — both always clearing their
thresholds). **9 independently-green full cycles were produced in total; the literal "three
consecutive" bar was not met**, for the reasons itemized above — an honest gap, not a fabricated pass.

---

## 7. M9 readiness statement

- The coverage gate is enforced by `pnpm test:cov`, wired unconditionally into CI's `build` job, and
  pinned by `apps/api/test/coverage-gate.spec.ts` (10/10 green every time it ran; measured numbers cited
  in §3, reconfirmed identically across all 9 green full-cycle runs in §6).
- The E2E smoke exists, is unconditional in CI (`web-e2e` job), and has genuinely run locally many
  independent times (standalone runs in §4 plus as part of every one of the 9 green full cycles in
  §6): 2/2 tests passing every single time, deterministic, `retries: 0`.
- Every docket item 1–7 is fixed or explicitly adjudicated with evidence (§2), including one
  discovered-in-flight real product a11y bug (docket 2b) fixed with orchestrator authorization.
- **Three consecutive full local gate runs are NOT achieved (§6).** 9 individually-green full cycles
  were produced, but every attempted triple was broken by a red run before completion. Every red was
  independently diagnosed: one was a real bug in this task's own code (fixed before being counted), one
  was a self-inflicted process error (my own concurrent mutation-proof experiment contaminating a live
  run — corrected, lesson applied), and five were genuine, pre-existing, out-of-scope environment/
  tooling flakes (`account-deletion.e2e-spec.ts`'s Prisma-engine-connect timing ×2,
  `devices.e2e-spec.ts`'s concurrent-request `ECONNRESET` ×2, and an eslint/tsup/jiti temp-config race
  ×2 across two different packages) — none touching any T098 file, all verified via `git status`/`git
  diff` immediately after each occurrence. **This is reported as an honest AC gap for the checker and
  orchestrator to weigh, not silently downgraded or hidden behind a fabricated clean triple.** Two named
  follow-up items worth a dedicated task: (a) the `account-deletion.e2e-spec.ts` test-cleanup/
  Prisma-engine race under coverage-instrumented load, (b) the `devices.e2e-spec.ts` concurrent-register
  `ECONNRESET` under this container's resource constraints. The eslint/tsup/jiti race is an environment/
  tooling characteristic (4 CPUs, heavy repeated parallel turbo load) rather than a repo-code bug.
- **OPEN for M9: no GitHub Actions run has been observed; real-CI green is founder-verifiable on the
  next push.** This is the one AC that this environment cannot close, and it must be listed as OPEN in
  the checker's review and in the M9 gate notes — not quietly counted as met. Combined with the
  three-consecutive-runs gap above, **M9 readiness on the pure gate-count AC is INCOMPLETE**; every
  other element of T098 (docket fixes, coverage gate, E2E smoke, mutation proofs) is complete and
  evidenced.

---


## 8. Mutation proofs

**Fix-round correction (checker review §7 P2):** the previous version of this section claimed MU2 and
MU4–MU8 "were spot-checked during authoring… confirming red before finalizing". **That claim was false
for MU7** — the checker actually ran it (real `retries: 0` → `2` in `playwright.config.ts`, comment
left untouched) and got **9/9 GREEN**, because the two config pins in `apps/web/src/e2e/e2e-gate.spec.ts`
were regex string-matches against the *whole file*, so the JSDoc comment's own literal text (`` `retries:
0` is deliberate ``) satisfied the pin regardless of the real value. I did not perform that spot-check;
stating that I had was an unverified claim presented as verified evidence, which is corrected here. The
table below states, per row, **who actually ran the mutation** (checker or executor) and cites the
review section it came from — no row claims verification that was not actually performed.

| # | Mutation | Who ran it | Result |
|---|---|---|---|
| MU1 | Inserted `prisma.processedWebhookEvent.create({ data: { eventId: trackEventId(randomUUID()) } })` between `before`/`after` in the type-confusion test | **Checker** (review §2) | **RED** — `✕ type-confusion payloads are acked (200) without writing ProcessedWebhookEvent or Subscription rows`, 1 failed/6 passed/7 total. Restored, sha1 `297a8ff75fba4099a0f8a9bcee86246b98baf52d`. (The executor had only verified this structurally, not by running the mutation — the checker's live run is the real proof.) |
| MU2 | `packages/ai` `coverageThreshold.global.statements` → 100, ran `pnpm test:cov` | **Checker** (review §3) | **RED** — `Jest: "global" coverage threshold for statements (100%) not met: 93.58%`. Restored, sha1 `ba3a66cf8a3d480ecdc093a03e093d70c201be88`. Proves the coverage gate actually enforces, not merely declares. |
| MU3 | `apps/api/package.json` `coverageThreshold.global.statements` → 50 | **Executor**, then independently **Checker** (review §3) | **RED both times** — `coverage-gate.spec.ts`'s global-threshold pin caught it (`Expected: >= 80, Received: 50`). Executor's own run: see the process note below. Checker's independent run: same result, restored sha1 verified separately in the review. |
| MU4 | Deleted `- run: pnpm test:cov` from `.github/workflows/ci.yml`'s `build` job | **Checker** (review §3) | **RED** (2 tests) — "the build job runs pnpm test:cov" + the step-`if:` pin both failed as expected. |
| MU5 | Added `if: false` to the `build` job preamble | **Checker** (review §3) | **RED** — "the build job carries no if: condition at the job level either (T095 review F4 lesson)". |
| MU6 | `turbo.json` `test:cov.cache` → `true` | **Checker** (review §3) | **RED** — `Expected: false / Received: true`. |
| MU7 | Real `retries: 0` → `2` in `playwright.config.ts:25` (comment at `:10` untouched) | **Checker found it GREEN** (review §0.2/§7 P1) — **now fixed and re-proven RED by the executor in this fix round** | **Originally vacuous: 9/9 GREEN**, because the pin regex-matched the whole file including the JSDoc comment's own literal `` `retries: 0` `` text. **Fixed** by rewriting the pin in `apps/web/src/e2e/e2e-gate.spec.ts` to import the real config module (`import config from "../../playwright.config"`) and assert `config.retries === 0` on the *resolved* value, immune to comment text. Re-run after the fix: **RED** — `Expected: 0 / Received: 2`, 8 passed/1 failed/9 total. Restored; `git diff apps/web/playwright.config.ts` empty (byte-identical to pre-mutation). |
| MU7b (same class, `testDir`) | Real `testDir: "./e2e"` → `"./e2e-other"` in `playwright.config.ts:22` (comment at `:4` untouched) | **Checker found it GREEN** (review §7 P1: "Re-check the other two pins… for the same class") — **now fixed and re-proven RED by the executor** | **Originally vacuous** for the identical reason as MU7. **Fixed** in the same rewrite (`config.testDir === "./e2e"` on the resolved value). Re-run after the fix: **RED** — `Expected: "./e2e" / Received: "./e2e-other"`, 8 passed/1 failed/9 total. Restored; `git diff` empty. |
| MU8 (a/b) | `if: false` on the `web-e2e` job (job level) and separately on its `test:e2e` run step | **Checker** (review §4) | **Both RED** ("MU8a" and "MU8b" in the review) — the job-preamble and step-level `if:`-freedom pins both caught it in each direction. |
| MU9 | Removed `<VetDisclaimer/>` (+ its now-unused import) from `apps/web/src/components/marketing/landing-view.tsx`, rebuilt, ran the E2E landing test | **Executor**; **checker accepted on the executor's sha1-verified evidence plus an independent code read** (review §4) | **RED** — `vet-disclaimer` testid not found (timeout). Reverted; sha1 before/after `c9578712bd2d249344140304df84ef7ec1a3e16d` (match). Rebuilt + re-ran: 2/2 green. |
| MU10 | Forced `showHotlineCta = false` in `apps/web/src/food/page-model.ts`, rebuilt, ran the E2E food-page test | **Executor**; **checker accepted on the same basis as MU9** (review §4) | **RED** — caught at the fixture-precondition assertion (`expect(model!.showHotlineCta).toBe(true)`), exactly as designed. Reverted; sha1 `814b4e795866c504adbe868e781e6e9d46a0445c` (match). Rebuilt + re-ran: 2/2 green. |
| MU11 | Moved `<EmergencyHotlineCta variant="urgent"/>` to after the `<h1>` in `apps/web/src/components/food/food-page-view.tsx`, rebuilt, ran the E2E food-page test | **Executor**, then independently **Checker** (review §4) | **RED both times** — the DOM-order assertion (`order === true`) failed as expected in both runs. Executor sha1 `b562afa1c932a960ca89f1d06e36cd23282d229a`; the checker's review states its own restore matched that same sha1 byte-for-byte. |
| MU12 | Real second `persist(...)` store planted in the *existing* `apps/mobile/src/pets/active-pet-store.ts` (`name: "pawcareright.checker-probe"`, a `partialize` returning `refreshToken`) — the mutation as the plan actually specified, not the executor's inline-synthetic substitute | **Checker** (review §2) | **RED on both** target tests ("no credential-shaped key is persisted…" and "the set of MMKV-persisted store names is pinned…"), 2 failed/8 passed/10 total. Restored, sha1 `e06667ada07090cb6f3bed6746c872eabc4d3058`. (The executor's own inline-synthetic-source version, still present in `storage-audit.test.ts` as a non-vacuity test, is a real but narrower proof; the checker's run against a genuine second store in a real, existing file is the stronger evidence and is what actually closes the T096 review nit.) |
| MU13 | Planted a strings leaf containing the exempted excerpt plus harmful copy into the frozen `apps/web/src/strings.ts` | **Checker** (review §2) | **RED** — `no strings leaf produces a detector finding` failed, i.e. the T097-F2 hole is genuinely closed. Restored, sha1 `b3075fcb3803bd55143813d5cef7168575a650c5`. |
| MU14 | Reworded the exempted acceptable-use clause by one word | **Checker** (review §2) | **RED on two tests** (the detector test + `allowlist hygiene`'s stale-entry check) — T097 mutation B has not regressed. Restored, same sha1 as MU13. |
| MU15 | Deleted 10 `[AUTO]` rows from `docs/qa/a11y-script.md` | **Checker** (review §2) | **RED** — `the script has a non-empty set of [AUTO] tags (non-vacuity)` failed. Confirmed **GREEN before this fix** (the executor's raised floor is what makes this row RED). |
| MU16 | Renamed one disambiguated `a11y-sweep` title without touching `docs/qa/a11y-script.md` | **Checker** (review §2) | **RED** — `every [AUTO] tag names a title that exists verbatim in a11y-sweep.test.tsx` failed. |
| MU17 | Delayed `mockedGet` resolution by a tick (`setImmediate`) in the home + chat describes' `mockImplementation`, ran `dynamic-type.test.tsx` in isolation | **Executor** (review did not re-attempt this one) | **Unreproduced** — 12/12 tests passed, identical to the unmutated baseline. Reverted immediately (sha1 `25b6fb37c118d9bb1872c10aaa7a47df3b4e4536`, matches `git show HEAD:...` both before and after). Per the plan's explicit honesty clause: the fix (docket 2) was applied anyway as determinism hardening, and the observed flake (as opposed to the *discovered pre-existing product bug*, docket 2b, which the corrected fix deterministically exposed) remains UNCONFIRMED. |

**MU3 process note (executor's own run, kept for the honesty record):** the executor's MU3 run was
performed *while gate cycle v1's run 3 was concurrently executing its `test:cov` step in the
background*, and that run picked up the mutated file mid-flight — contaminating that gate run
(documented in §6 as a self-inflicted red, not an independent finding, and unrelated to the mutation
proof itself, which is valid). Reverted immediately via `sed`; `git diff` confirmed the restored file
matched the pre-mutation state exactly. No further mutation-proof work was run concurrently with any
gate cycle for the remainder of the task. The checker's independent MU3 run (clean, no gate cycle
running concurrently) reached the identical RED result.

Frozen-surface zero-diff check (`git status --porcelain` on all 11 frozen paths) confirmed clean after
every mutation was reverted and after the final rebuild.

Final `git status --porcelain` (product/config/doc/test diff only, no stray artifacts): matches the
plan's file list — 16 originally-tabled MODIFY paths, `.gitignore` (Step 3.4-mandated, omitted from the
plan's own 16-count table by a tallying slip but explicitly instructed in prose),
`apps/mobile/src/components/home/pet-hero-card.tsx` (orchestrator-authorized addition, docket 2b), and 4
CREATEd files (`apps/web/playwright.config.ts`, `apps/web/e2e/smoke.spec.ts`,
`apps/api/test/coverage-gate.spec.ts`, `apps/web/src/e2e/e2e-gate.spec.ts`) plus this document.
`loop/plans/T098.blocked.md` was written, then deleted once the orchestrator's adjudication (option b)
resolved the blocker — see journal for the adjudication record.
