# T115 CHECKER progress log

Baseline HEAD: ff8a931 (chore(loop): T115 plan). Working tree = uncommitted T115 diff.
Checker: read-only on code. Mutations are temporary, sha1-verified, trap-guarded, always restored.

## Ledger
- [x] 0. Skeletons written
- [x] 1. Inventory vs plan §2 / git status / no lockfile / no hook-protected paths / snapshots
- [x] 2. F1 blast radius (client tolerant schema everywhere; server strict; tolerance != garbage)
- [x] 3. Semver util + decision table (numeric build compare, boundaries, fail-open)
- [x] 4. Safety/UX topology (no-dismiss, Android back, pre-auth precedence, fail-open, mid-session refresh)
- [x] 5. Banner (dismiss, persistence, band, root mount + mount assertion)
- [x] 6. Own mutation proofs (>=2, atomic, sha1)
- [x] 7. Gates reproduced (types, mobile full, api full once, typecheck, lint, build)
- [x] 8. Executor scrutiny list, MinIO flake plausibility, §7 detector lint

## Log

### C1 — Inventory (DONE)
- `git status --porcelain`: 22 ` M` + 11 `??`. The 11 untracked = 8 planned new code files + `loop/t115-exec-progress.md` + my own 2 skeletons. Matches plan §2 (8 create / 22 modify) EXACTLY, file-for-file.
- No `package.json`, no `pnpm-lock.yaml` in the diff. No new deps.
- No hook-protected path touched (CLAUDE.md, LOOP_PROTOCOL.md, docs/PHASES.md, docs/OTA_UPDATES.md, docs/MODEL_STRATEGY.md, docs/AI_PROVIDERS.md, .claude/**) — all absent from the diff.
- `loop/journal.md` and `loop/loop-state.json` untouched (not in git status). No commit made (HEAD still ff8a931).
- No `.snap` file in the diff => 19 snapshots structurally unchanged (to be confirmed by the mobile run).
- diff --stat: 983 insertions / 89 deletions across 22 files.
VERDICT C1: PASS.

### C0b — Infra
Docker daemon was DOWN at checker start; first api run failed with P1001 (localhost:5432 unreachable) — NOT a code failure. Started `sudo dockerd`, `docker start bombaypetcompany-pg-host bombaypetcompany-redis-host`, `docker compose up -d minio createbuckets`. PG_OK + REDIS_OK + minio healthy. Re-running api suite.

### C2 — F1 blast radius (DONE)
- Grep `appConfigResponseSchema` across apps+packages (excl. node_modules/dist): ONLY `apps/api/test/remote-config.e2e-spec.ts` (6 parse sites, server contract) + `packages/types/src/config.{ts,spec.ts}`. ZERO client production sites.
- Grep `appConfigClientSchema`: single production consumer `apps/mobile/src/config/app-config-queries.ts:72`.
- `/v1/config` fetch sites: exactly one (`app-config-queries.ts:71`). `paywall-queries.ts` + `use-upgrade-state.ts` + `update-gate.tsx` are all selectors over `fetchAppConfig()`/`useAppConfig()` — no second parse path.
- Ran my own node probe against the built `packages/types/dist/index.js` (see scratchpad f1probe.mjs). Results:
  TOLERANCE (accepted, unknown keys stripped): unknown top-level field; unknown nested key inside `features`; pre-T115 body with both gate fields absent -> defaults to 0.0.0/0.0.0; unknown nested key inside `minAppVersion`.
  TOLERANCE != GARBAGE (all REJECTED): `features:"yes"`; `features.checks:"yes"`; `features.checks` missing; `paywall` missing; `minSupportedVersion:5`; `hotlinePackVersion:-1`; `criticalOtaVersion:5`; `minAppVersion:{ios:1}`; `minAppVersion:"x"`; `minAppVersion:null`; `paywall.variant:"Z"`.
  SERVER STRICT preserved (all REJECTED by appConfigResponseSchema): unknown top-level; unknown nested feature; unknown key in minAppVersion; pre-T115 body.
- OTA_UPDATES §5 rule 4 ("/config responses are backward-compatible by construction (Zod schema with defaults on the client)") is met LITERALLY: client Zod schema, strip-mode at every level, `.default()` on every T115-introduced field.
VERDICT C2: PASS. F1 correctly scoped; blast radius is one call site; no client path still uses the strict schema.

### C3 — Semver + decision table (partial: code read + own probes)
Own probes via dist: compare("1.0.0+2","1.0.0+10")=-1 (NUMERIC, not lexicographic); ("1.0.0+10","1.0.0+2")=1; ("1.0.0+007","1.0.0+7")=0; ("1.10.0","1.9.0")=1; ("1.0.0+7","1.0.0")=0 and reverse=0 (build invisible on one side => ignored, fail-open); ("1.0.0+abc","1.0.0+10")=0; ("1.0.0+1e3","1.0.0+10")=0; ("1.0.0-beta","1.0.0")=null; ("1.0.0+","1.0.0")=null; ("1.0.0.0","1.0.0")=null; (" 1.0.0 ","1.0.0")=0 (trim). `isVersionBelow` false on every null.
`resolveUpgradeState` (version-gate.ts:72-87): min branch ORs legacy scalar with per-platform min and returns BEFORE the recommended branch => min beats a misconfigured lower recommended. Boundary is `isVersionBelow` (strict `<`) => equal-to-min is NOT blocked (correct `>=`-style semantics).

### C4a — Gate reproduction (api + mobile)
- `timeout 900 pnpm --filter api test` EXIT=0 — 113 suites / 1151 tests (matches executor claim; baseline 113/1149 +2). Single clean run, NO account-deletion flake => corroborates the MinIO-pollution attribution.
- `timeout 900 pnpm --filter mobile test` EXIT=0 — 198 suites / 1684 tests / **19 snapshots** (baseline 195/1642/19). Snapshot count UNCHANGED as required.
### C3b — Decision table (DONE)
15 `it.each` rows in `version-gate.test.ts` `describe("resolveUpgradeState — decision table (T115 AC2)")` — one per plan §5 AC2 row, incl. "min beats a misconfigured lower recommended", "build-number gate", "no visible build -> fail-open", "malformed installed version -> fail-open", "everything malformed -> fail-open", per-platform slot selection x3, and both equality boundaries. Plus `describe("resolvePlatformVersion")` x4. semver spec 38/38.
VERDICT C3: PASS.

### C4 — Safety/UX topology (DONE)
- No-dismiss: `update-gate.test.tsx` "the blocking screen offers no dismiss affordance" ENUMERATES every `update-gate-*` testID in the serialized tree and asserts the set is exactly {screen, cta}; pressing the CTA leaves the gate rendered and `protected-child` null. Strong test.
- Android hardware back: no `BackHandler` registration anywhere in the gate path (only `check/emergency/[checkId].tsx` registers one). Structurally, `UpdateGate` returns EARLY instead of `children`, so `<Stack>` never mounts — there is no navigator and no route to go "back" to. Hardware back therefore exits/backgrounds the app; on relaunch the gate re-evaluates and blocks again. It can never reveal authenticated content. Pinned indirectly by the precedence test's `queryByTestId("router-stack") === null`.
- Pre-auth precedence: `upgrade-gate-precedence.test.tsx` imports the REAL `RootLayout` from `../app/_layout` and does NOT mock `../src/components/update-gate` (comment at :91). `status: "signedIn"` + blocking config => `update-gate-screen` present, `router-stack`/`upgrade-recommended-banner`/`update-ready-prompt-stub` all null. Case 3 (permissive config => router-stack renders) proves non-vacuity.
- Fail-open: `useAppConfig()` seeds `initialData` = cache-or-default; `useUpgradeState` additionally uses PER-FIELD `?? DEFAULT_APP_CONFIG.X`. `DEFAULT_APP_CONFIG` gate fields are 0.0.0/0.0.0. Missing config/version => "none".
- MID-SESSION RULING: `auth-store.ts` sets `"restoring"` ONLY as the initial state (line 44); no transition ever returns to it. `<UpdateGate>` therefore mounts exactly once per cold launch and never remounts, and `useUpgradeState` snapshots in a lazy `useState` initializer. A mid-session `/config` refresh CANNOT turn the blocking screen on during an in-progress symptom check. This is the correct, §7-protective direction and preserves T080 decision 1. No interaction with T114's deferral guard is needed — precedence is structural (gate > OTA prompt), proven by the precedence test.
VERDICT C4: PASS.

### C5 — Banner (DONE)
Dismissible (`upgrade-banner-dismiss` -> zustand `dismiss()`), session-only/non-persisted (mirrors `billing-banner-store.ts`, D7). Renders only on `"recommended"` (=> strictly between min and recommended by `resolveUpgradeState`'s ordering); `null` on `"blocked"` and `"none"`. Normal document flow, no `absolute`/`z-*`, no `insets.top` (T114 Finding 6 respected). Spec = 5 tests incl. copy read FROM the strings module. Root mount + `testID`-bearing stub + dedicated mount assertion in `root-layout.test.tsx:157-166`.
VERDICT C5: PASS.

### C6 — Checker mutation proofs (DONE, 3/3, all restored sha1-verified)
- CHK-M1 remove `<UpgradeRecommendedBanner />` from `_layout.tsx` => root-layout RED (1 failed / 6 passed), specifically "mounts <UpgradeRecommendedBanner/> at the root (T115)". sha1 7048be2b... restored.
- CHK-M2 `isVersionBelow` boundary `=== -1` -> `-1 || 0` (equal-to-min now blocks) => types semver spec RED 2/38 AND mobile version-gate RED 4/34 ("current === min (equal)", "equal to min is NOT below -> recommended", "equal to recommended is NOT below -> none", "no visible build -> fail-open"). sha1 0fac920c... restored + dist rebuilt & verified.
- CHK-M3 `useUpgradeState` lazy `useState` -> live IIFE (re-evaluates on every render) => use-upgrade-state RED 2/4 AND update-gate RED 2/9 (both launch-decision pinning tests). sha1 6d653c72... restored.
Tree verified afterwards: 33 entries = 22 M + 8 new code + 3 loop files; NO `.bak` anywhere in the repo; `dist/index.js` `isVersionBelow` back to `=== -1`.
VERDICT C6: PASS — the three guarantees I cared about most (root mount, `>=` boundary, launch snapshot) are all genuinely pinned.

### C7 — Gates (DONE)
typecheck 16/16 EXIT=0; lint 15/15 EXIT=0 (0 errors); mobile 198/1684/19 EXIT=0; api 113/1151 EXIT=0; build 9/9 EXIT=0; types 27 suites/642 EXIT=0. `pnpm test:ai-evals` not required (no packages/ai change).
Lint warnings: 3 total, all "Unused eslint-disable directive" — `packages/ai/coverage/lcov-report/block-navigation.js`, `packages/ai/src/chat/sanitize.ts`, `apps/api/coverage/lcov-report/block-navigation.js`. The third is a GENERATED coverage artifact from my own api run, not a code change. Zero in T115 files.

### C8 — Scrutiny list / detector lint (DONE)
- Forbidden patterns across all 30 changed source files: no `any` type, no `@ts-ignore`, no `console.log`, no bare `TODO`, no secrets. (Only `: any` hit is the prose word "any" in `_layout.tsx:1`'s comment.)
- §7 copy: `strings.upgradeBanner` = "A newer version is available." / "Update" / "Dismiss". No diagnos*, no medication/drug/dose token, no emergency competition, no false "app will stop working" implication. Blocking-screen copy unchanged from T079.
- No `<VetDisclaimer/>` needed (not an AI/triage surface) — correct.
- MinIO-flake attribution: PLAUSIBLE and corroborated. My single clean api run (fresh minio container, `docker compose up -d minio createbuckets`) passed 113/1151 with no account-deletion failure.
- `.env.example` every-key invariant honoured (4 new keys + comment). Swagger `@ApiOkResponse` updated. Server contract stays `.strict()` and the e2e still parses with it.

### DONE — review written to loop/reviews/T115.review.md. FINAL VERDICT: pass (3 LOW/INFO items, 0 HIGH, 0 MEDIUM).
