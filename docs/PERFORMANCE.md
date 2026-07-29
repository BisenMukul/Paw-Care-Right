# Performance budgets (T095)

This document is the single place that states Paw Care Right +'s performance
budgets, where each one is enforced in code/CI, how to reproduce a
measurement locally, and an honest log of what has and has not actually been
measured. Every number below is either a real measurement taken while
building this task, or explicitly marked as not measured, per CLAUDE.md's
"never fabricate a number" rule.

## 1. Web budgets

Enforced in `apps/web/lighthouserc.json` via lighthouse-ci's `assertMatrix`
(one flat `assertions` block cannot express "perf is scoped to the landing,
SEO is scoped to the whole sample"):

| Budget | Scope | Threshold | Severity |
|---|---|---|---|
| `categories:performance` | landing URL only (`matchingUrlPattern: "^https?://[^/]+/$"`) | ≥ 0.90 | `error` |
| `categories:seo` | every collected URL (`matchingUrlPattern: ".*"`) | ≥ 0.95 | `error` |

Both are backed by `numberOfRuns: 3` and enforced in three places, all of
which must stay in sync:

1. `apps/web/lighthouserc.json` — the actual lhci config lhci reads.
2. The CI job `web-perf-budget` in `.github/workflows/ci.yml` — runs
   `lhci collect` then `lhci assert` against the config above. This job is a
   **required** gate (unlike T089's optional Sentry upload) — it carries no
   `if:` condition and needs no secret, since Chrome ships preinstalled on
   `ubuntu-latest`. Reports are kept as a GitHub Actions artifact
   (`lighthouse-<run-id>`, path `apps/web/.lighthouseci/` — `lhci`'s working
   directory is the `apps/web` package when invoked via
   `pnpm --filter @pawcareright/web exec`, confirmed by direct inspection
   while building this task) instead of using lhci's `temporary-public-storage`
   cloud upload, so the job never depends on third-party network access.
3. Two jest pins: `apps/web/src/perf/lighthouse-budget.spec.ts` (the new T095
   pin: perf scope/threshold, SEO scope/threshold, run count, URL coverage,
   no-`--no-sandbox`-in-config, and that the CI assert step is unconditional)
   and `apps/web/src/food/build-output.spec.ts` (the original T085 pin,
   rewritten against the `assertMatrix` shape — read directly, no
   flat-`assertions` fallback, so the SEO budget cannot silently disappear if
   the matrix key is ever removed).

**Aggregation semantics (T098 docket 5, correcting a T095 review advisory,
F5 — this sentence previously said "median-of-3 variance protection", which
was imprecise about how the assertion is actually enforced):**
`apps/web/lighthouserc.json` does not set `aggregationMethod`, so lhci's
default applies — `optimistic` (`@lhci/utils`'s `assertions.js:139`:
`const {..., aggregationMethod = 'optimistic'} = options;`). For a `minScore`
assertion, `optimistic` selects the **best** (`Math.max`) of the
`numberOfRuns: 3` samples (`assertions.js`'s `getValueForAggregationMethod`:
`useMin` is only true for `optimistic`+`max*` or `pessimistic`+`min*`
assertion types — neither applies here — so the `else` branch's
`Math.max(...values)` runs). The shipped gate is therefore honestly
"**best-of-3** `categories:performance` ≥ 0.90 on the landing page", not a
median. `numberOfRuns: 3` is still real variance protection, just in the
anti-false-red direction (a single unlucky run cannot fail the gate on its
own) rather than a median smoothing. The T095 checker's own fresh
measurement put the landing's `computeRepresentativeRuns` value at exactly
**0.90** — on the line — so switching to `aggregationMethod: "median"` here
would put a required gate on a coin-flip; the only honest responses to that
would be a real perf fix (out of scope for T098, a stabilization card) or a
lowered threshold (forbidden by CLAUDE's "never fabricate/soften a number"
rule). Reconciling the doc to the actual, already-shipped, more
lenient-by-design `optimistic` behavior is the non-weakening fix (see
`loop/reviews/T095.review.md` F5). §1.2's "median" column below is a
different, purely informational number — lhci's own *representative-run*
selection for reporting — and is unaffected by this correction.

### 1.1 How to run it locally

```
pnpm --filter @pawcareright/web build
CHROME_PATH=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome | head -1) \
  pnpm --filter @pawcareright/web exec lhci collect --config=./lighthouserc.json \
  --settings.chromeFlags="--no-sandbox --headless=new"
pnpm --filter @pawcareright/web exec lhci assert --config=./lighthouserc.json
```

`CHROME_PATH` and `--settings.chromeFlags="--no-sandbox ..."` are **only**
needed because this container runs Chrome as `uid 0`
("Running as root without --no-sandbox is not supported"). Neither the
`CHROME_PATH` env var nor `--no-sandbox` is ever written into
`lighthouserc.json` (T085 precedent, re-verified for T095 — the committed
config and CI job both rely on the ambient Chrome that ships on
`ubuntu-latest`/a real developer machine, where no such flag is needed).

Note: lhci's CLI flag for Chrome flags is `--settings.chromeFlags=...`
(nested under `--settings`), **not** a top-level `--chrome-flags` flag —
verified by trial while building this task; the top-level flag silently does
nothing and Chrome then refuses to launch as root.

### 1.2 Real measurements taken while building this task

**Methodology note (added after a T095 review finding — read before the
tables below):** the "median" column is `lhci`'s own *representative run*
(`@lhci/utils`'s `computeRepresentativeRuns`: the run whose First Contentful
Paint / Time-to-Interactive are closest to the 3-run median of those two raw
metrics), **not an arithmetic average of the three `categories:performance`
scores**. This value is, by construction, always identical to one of the
three listed runs — never a number in between them. An earlier version of
the "After" table below stated a median (`0.93`) that was not any of its own
three listed runs (`0.94, 0.94, 0.90`) — an untraceable, effectively
fabricated cell that a T095 checker review caught (see `loop/reviews/`).
That table has been replaced below with a fresh, freshly-verified
measurement, computed by running lhci's own `computeRepresentativeRuns`
function directly against the raw collected `.lighthouseci/*.json` files
(not eyeballed) before deleting them.

**Before** (ad hoc 2-URL run, `--settings.chromeFlags="--no-sandbox --headless=new"`, 3 runs each, `http://localhost:3111/` + `/can-dogs-eat/grapes`):

| URL | performance (3 runs) | median | seo (3 runs) |
|---|---|---|---|
| `/` (landing) | 0.87, 0.94, 0.92 | **0.92** | 1.0, 1.0, 1.0 |
| `/can-dogs-eat/grapes` | 0.91, 0.94, 0.90 | 0.91 | 1.0, 1.0, 1.0 |

This confirmed the landing already clears the 0.90 bar (median 0.92), so
step 4's "proceed, assert 0.90" branch fired — no perf-fix work and no
`loop/plans/T095.blocked.md` were needed.

**After** (real run against the exact committed `lighthouserc.json` — all 4
URLs, `numberOfRuns: 3`, via `lhci collect`/`assert --config=./lighthouserc.json`
from `apps/web`. Median column = `computeRepresentativeRuns`'s actual
selection, computed by requiring `@lhci/utils/src/representative-runs.js`
directly against the raw `.lighthouseci/*.json` files from this run, not
eyeballed):

| URL | performance (3 runs) | representative (lhci median) | seo (3 runs) |
|---|---|---|---|
| `http://localhost:3000/` (landing) | 0.94, 0.91, 0.94 | **0.94** | 1, 1, 1 |
| `http://localhost:3000/can-dogs-eat/grapes` | 0.91, 0.91, 0.90 | 0.91 | 1, 1, 1 |
| `http://localhost:3000/can-cats-eat/onion` | 0.93, 0.94, 0.91 | 0.91 | 1, 1, 1 |
| `http://localhost:3000/can-dogs-eat/apple` | 0.93, 0.91, 0.87 | 0.91 | 1, 1, 1 |

`lhci assert --config=./lighthouserc.json` against this run: **exit code 0**
(all assertions pass). This table replaces an earlier version of itself that
a T095 checker review flagged (F1) for an untraceable `apple`-row median —
see the methodology note above.

**Closing gate check:** the "After" table immediately above **is** this
task's closing gate re-run — it was taken fresh while addressing the T095
checker review's F1 finding, using the real `computeRepresentativeRuns`
algorithm rather than an eyeballed value, and `lhci assert` exited 0 against
it. (An earlier, separately-run "Final gate re-run" table with
manually-eyeballed medians previously appeared here; it has been removed
rather than kept alongside the verified table above, since carrying two
differently-derived tables is exactly the kind of drift this fix is meant to
close.) Two independent real runs (before, after/closing-gate) both place
the landing performance comfortably above the 0.90 budget — 0.92 and 0.94
respectively — consistent with the single-run 0.89 dip documented in §1.3 as
the reason `numberOfRuns: 3` is pinned rather than relied on as a default.

### 1.3 Why `numberOfRuns: 3` (median) matters — a real observation

While building this task, a **single-run** (`numberOfRuns: 1`) collection
against the same build produced a landing `categories:performance` of
**0.89** — just under the 0.90 threshold — even though the 3-run
representative value for the same page (same build, same machine, run
moments apart) was 0.92 (before) and 0.94 (after/closing-gate, per §1.2).
This is a real, reproduced example of Lighthouse's known run-to-run
performance-score variance on a shared/virtualized runner, and it is exactly
why the plan pins `numberOfRuns: 3` as a contract rather than relying on
lhci's default: a single flaky run could otherwise redden CI for a reason
unrelated to an actual regression (see plan decision D3).

### 1.4 Vacuous-match risk (verified, not just theorized)

`assertMatrix` entries are matched by regex against each collected URL; an
entry whose `matchingUrlPattern` matches **zero** URLs still causes lhci to
print "All results processed!" and exit 0 — i.e. **a mistyped or dead
pattern passes silently**. This was reproduced directly while building this
task (a copy of the config with the landing pattern rewritten to match
nothing still exited 0). This is exactly the failure mode
`lighthouse-budget.spec.ts`'s "matches the landing URL" /
"does not match a programmatic URL" assertions exist to catch — `lhci`
itself provides no such protection.

## 2. Mobile bundle analysis

`pnpm --filter @pawcareright/mobile perf:bundle` (script: `scripts/analyze-bundle.ts`,
run via `tsx`) reads an exported Metro bundle + its `.map` and prints a
per-package byte table, using a hand-rolled base64-VLQ decoder
(`src/perf/source-map-attribution.ts` — no new dependency; see plan decision
D5). It is **not** wired into turbo or CI — `expo export` takes minutes and
this task's CI gate is the web perf budget, not this.

### 2.1 Export it yourself

```
cd apps/mobile
npx expo export --platform android --dump-sourcemap --output-dir .perf/export
pnpm perf:bundle
```

### 2.2 A real finding: Hermes bytecode vs. a plain JS bundle

Running the command above (Hermes bytecode is Metro's default output for
this RN 0.86 project) produced a real, working export:

- `entry-<hash>.hbc` — **7,680,124 bytes** (compiled Hermes bytecode; magic
  bytes `c6 1f bc 03` confirmed by direct inspection).
- `entry-<hash>.hbc.map` — 16,270,514 bytes, 2,748 sources.

Inspecting that map's `mappings` field showed it collapses to a **single**
generated "line" for the entire multi-megabyte bundle (Hermes composes a
bytecode-function-offset scheme into the map, not a text line/column
scheme — confirmed by counting `;`-separated groups: exactly 1). A
line/column-based VLQ attribution tool (the kind this task's plan
specifies, and the kind every standard JS source-map tool assumes) is not
meaningful against that shape.

Re-running with `--no-bytecode` produced a plain JS bundle instead:

- `entry-<hash>.js` — **6,933,262 bytes**.
- `entry-<hash>.js.map` — ~20MB, 2,799 sources, **2,876** generated lines
  (matches the bundle's own newline count) — a normal, line/column-based
  source map.

**The byte-table baseline `analyze-bundle.ts` is designed for, and was
validated against, is the `--no-bytecode` plain-JS export** — that is the
shape its line/column attribution logic is actually correct for. Both
numbers above are real measurements from this environment (network access
was available here, unlike the plan's worst-case "no network" contingency);
neither is estimated. `analyze-bundle.ts` itself makes no assumption about
bytecode vs. plain JS — it just needs a `.map` whose `mappings` are
genuinely line/column-shaped, which is what `--no-bytecode` produces.

Per-package attribution was not committed to this document as a table
because the exported bundle (`.perf/export/`) is a local, gitignored,
regenerable artifact (see `.gitignore`) — regenerate it with the commands
above to get a live table; `pnpm perf:bundle` prints it to stdout.

## 3. Heavy-dependency audit

Static grep audit (`apps/mobile/{app,src}`) of every dependency on the
dev-client-rebuild "heavy" list, with real import-site counts and one
representative `file:line` each:

| Dependency | Import sites | Representative site | Verdict |
|---|---|---|---|
| `react-native-svg` | 2 | `src/components/weight-chart.tsx:2` | Live — keep |
| `react-native-purchases` | 1 | `src/billing/purchases.ts:70` (`require`) | Live — keep |
| `react-native-reanimated` | 16 | `app/services/adopt.tsx:5` | Live — keep |
| `expo-haptics` | 1 | `src/haptics.ts:1` | Live — keep |
| `@expo/vector-icons` | 32 | `app/services/preview-end.tsx:1` | Live — keep |
| `expo-linear-gradient` | 1 | `src/components/home/animated-gradient-background.tsx:1` | Live — keep |
| `expo-font` | 1 | `src/fonts/use-app-fonts.ts:10` | Live — keep |
| `react-native-mmkv` | 9 | `src/config/app-config-cache.ts:12` (`require`) | Live — keep |
| `react-native-worklets` | 0 direct | — | **Transitive** peer of `react-native-reanimated` (no direct product import expected) — keep |
| `react-native-nitro-modules` | 0 direct | — | **Transitive native peer** of `react-native-mmkv@4` — keep |
| `expo-dev-client` | 0 | — | **Dev-client build dependency by design** — no product import expected; removing it would break the founder's dev client — keep |

**Verdict: no dead heavy dependency; nothing to remove.** This audit's
deliverable is this table, not a removal (plan decision D7) — manufacturing
a removal to produce an "after" delta would be the dishonest outcome here,
not the honest one.

## 4. Image cache policy

Before this task, `cachePolicy` appeared **zero** times anywhere in
`apps/mobile` (verified by grep). `src/perf/image-cache-policy.ts` now
exports the single source of truth for two policies, applied at all 6
`expo-image` call sites:

| Policy | Value | Used by | Why |
|---|---|---|---|
| `REMOTE_IMAGE_CACHE_POLICY` | `"memory-disk"` | `timeline-photo-strip.tsx`, `timeline-photo-viewer.tsx` | These render network-fetched photo URLs (presigned S3 view URLs via `usePhotoViewUrls`); the disk tier survives an app restart, so scrolling back into the timeline never re-downloads a photo the user already viewed. |
| `LOCAL_IMAGE_CACHE_POLICY` | `"memory"` | `add-pet/photo.tsx`, `intake/photo-prompt-question.tsx`, `health-log-photo-picker.tsx`, `pet-header-card.tsx` | These render a just-picked/compressed local `file://` preview; the bytes are already on local disk, so a disk-tier cache copy is pure duplication with no benefit. `pet-header-card.tsx`'s `localPhoto` prop is a local file URI handed through router params from the add-pet wizard's one-time handoff — **not** a network URL: this app has no `Pet.photoKey` -> URL resolver wired anywhere today (a T095 review finding, F2; `Pet` does have a persisted `photoKey` server-side, and `usePhotoViewUrls` already exists for other photo consumers, but nothing resolves it for pets yet). An earlier version of this table incorrectly classified this site as remote/network — corrected here, and the component was moved to `LOCAL_IMAGE_CACHE_POLICY` to match. |

Pinned by `apps/mobile/__tests__/image-cache-policy-scan.test.ts`: every
`expo-image` call site must set `cachePolicy` from the shared constant (a
bare string literal is rejected), and no file may import `Image` from
`react-native` directly. `pet-home-snapshot.test.tsx`'s snapshot was
regenerated and diffed twice: once when `cachePolicy` was first added
(delta: `+cachePolicy="memory-disk"`, since `pet-header-card.tsx` was
initially — incorrectly — classified as remote), and again after the F2 fix
above reclassified it to local (delta: `cachePolicy="memory-disk"` ->
`cachePolicy="memory"`). Both diffs touched exactly that one line; no copy
or layout changed either time.

These are the user's own images, already stored on-device/in S3, and
`expo-image`'s cache is app-sandboxed — this introduces no new
data-retention surface.

## 5. Cold start

**Budget: < 2.5s (2500ms) cold start on a mid-tier Android device.** This is
a **documented target**, enforced in code (`src/perf/cold-start.ts`'s
`COLD_START_BUDGET_MS` + `evaluateColdStart`, fully unit-tested) but **not
measured in this environment** — there is no physical device or emulator
available here.

### 5.1 Protocol (for the founder to run on a real device)

1. Install the **release variant** on a physical mid-tier Android device.
2. Run `apps/mobile/scripts/measure-cold-start.sh [runs]` (default 10 runs).
   It requires `adb` on `PATH` and a connected device; it force-stops the app
   between runs and captures `adb shell am start -W`'s `TotalTime` for each
   launch.
3. The script prints every raw sample and an *informational* median — it
   deliberately does **not** print PASS/FAIL and does **not** hardcode 2500:
   the single documented budget lives in `src/perf/cold-start.ts`, so a
   shell-side copy of that number could drift. Feed the samples into
   `evaluateColdStart(samples)` (or compare the printed median by hand
   against `COLD_START_BUDGET_MS`) to get a pass/fail judgement.
4. This script **cannot run in CI or in the loop's container** — no device
   or emulator is available there. It is a physical-device-only measurement.

Note on OTA: an OTA update downloaded at boot can lengthen the very first
post-update launch; see `docs/OTA_UPDATES.md` for the fallback-to-embedded
behavior that bounds that case. This document does not restate or change
that policy.

### 5.2 Measurement log

| Date | Device | Samples (n) | Median TotalTime | Pass (< 2500ms)? | Notes |
|---|---|---|---|---|---|
| — | — | — | — | not measured | no device/emulator available in the build environment (T095) |

## 6. Summary of what was and was not measured (T095 honesty ledger)

| Item | Measured here? | Real number |
|---|---|---|
| Web landing `categories:performance` (before) | Yes | representative 0.92 (2-URL ad hoc run) |
| Web landing `categories:performance` (after, full config) | Yes | representative 0.94 (4-URL run against the committed config, `computeRepresentativeRuns`-verified) |
| Web `categories:seo` (before + after) | Yes | 1.0 on every sampled URL, both runs |
| `lhci assert` against the real committed config | Yes | exit code 0 |
| Mobile bundle byte size (Hermes bytecode) | Yes | 7,680,124 bytes (`.hbc`) |
| Mobile bundle byte size (plain JS, `--no-bytecode`) | Yes | 6,933,262 bytes (`.js`) |
| Heavy-dependency import audit | Yes | see §3 table |
| Cold start (< 2.5s budget) | **No** | not measured — no device/emulator available in the build environment; budget is a documented target, logic is real and unit-tested |
