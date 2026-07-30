# T116 CHECKER progress ledger

Append-only. Every check appended as it completes.

## C0 — skeletons written

- `loop/reviews/T116.review.md` + this ledger created before any check ran.
- Baseline confirmed: `git log --oneline -1` = `f520b4d chore(loop): T116 plan`.
- `git status --porcelain`: 8 modified, 5 untracked (4 planned creates + `loop/t116-exec-progress.md` ledger).

## C1 — inventory (PASS)

- `git diff --stat`: 8 files, +359/-10. Plan's 7 modify + 4 create present; the ONLY extra is `apps/api/test/guards.e2e-spec.ts` (executor-flagged mechanical deviation).
- `git status --porcelain` for `*package.json`, `pnpm-lock.yaml`, `.claude`, `CLAUDE.md`, `LOOP_PROTOCOL.md`, `docs/PHASES.md`, `docs/OTA_UPDATES.md`, `loop/journal.md`, `loop/loop-state.json`, `.env*` → EMPTY. No hook-protected / loop-owned / dependency file touched.
- `git status --porcelain -- '*.snap'` → EMPTY (snapshots untouched; mobile run later confirms 19/19 snapshots pass).
- Untracked: 4 planned creates + `loop/t116-exec-progress.md` (executor ledger, allowed).

## C2 — workflow correctness (PASS with 1 MEDIUM gap)

- REAL parser: `python3 yaml.safe_load('.github/workflows/ci.yml')` succeeds. Top keys `['name', on, 'concurrency', 'jobs']`. AC1 satisfied by an independent parser, not just the hand-rolled validator.
- Jobs: build, mobile-fingerprint, ai-evals, web-perf-budget, web-e2e, security, ota-publish-preview, ota-publish-production. `if:` present on EXACTLY ONE gate job: `mobile-fingerprint` → `github.event_name == 'pull_request'`. Exemption is genuinely event-scoped.
- needs(preview) == needs(production) == `[build, ai-evals, web-perf-budget, web-e2e, security]` == all gate jobs minus mobile-fingerprint. Set-equality assert at ota-publish-ci.test.ts:311-321 / 336-346 is derived from parsed jobKeys → a new gate job not added to `needs` goes RED.
- Trigger scoping: `on.push.branches == ['main']` (tag pushes cannot fire; `refs/tags/*` is not a branch), plus job `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`. A `pull_request` event cannot satisfy it. Production job `if: github.event_name == 'workflow_dispatch' && inputs.confirm_production_publish != ''` — unreachable on push/PR; `on:` has no `schedule:`.
- EXPO_TOKEN skip is VISIBLE: step `Preview OTA publish skipped — no EXPO_TOKEN` (`if: env.EXPO_TOKEN == ''`) appends a named line to `$GITHUB_STEP_SUMMARY`. Production hard-fails (`Require EXPO_TOKEN` → `exit 1`).
- Step ORDER inside ota-publish-production (parsed indices): [0] Confirm → [5] Require EXPO_TOKEN → [6] Lint → [7] Pre-flight → [8] Publish → [9] Constrain rollout 10% → [10] Rollout playbook → [11] Critical follow-up → [12] Halt (`if: failure()`). Health check BEFORE publish, publish BEFORE rollout: confirmed.
- Rollout command: `--percent 10 --non-interactive`. **MEDIUM gap:** no test pins `--percent 10`; the only `10%` appears in the step NAME. See Finding 1.
- pipefail per ACTUAL parsed body (not file text): Confirm/Lint(prev)/Publish(prev)/Lint(prod)/Pre-flight/Constrain = `set -euo pipefail`; Publish(prod) (the only `| tee` step) = `set -o pipefail`; Rollout playbook = `set -uo pipefail` (deliberately no `-e`). All piping steps covered.
- Injection safety: `HAS_EXPR` false for EVERY run body in both jobs — zero `${{ }}` inside any `run:`. All dynamic values arrive via `env:`.

## C3 — executed evidence, reproduced by the CHECKER (PASS)

Guard body extracted from the parsed YAML (`yaml.safe_load` → step `Confirm production publish`), written to a temp file, executed with `bash`:

| CONFIRMATION | exit |
|---|---|
| `""` | 1 |
| `publish` | 1 |
| `publish-prod` | 1 |
| `"PUBLISH-PROD "` (trailing space) | 1 |
| `" PUBLISH-PROD"` (leading space) | 1 |
| `" PUBLISH-PROD "` (both) | 1 |
| `PUBLISH-PRODX` | 1 |
| `XPUBLISH-PROD` | 1 |
| `publish-PROD` | 1 |
| `PUBLISH_PROD` (underscore) | 1 |
| `"PUBLISH-PROD\n"` | 1 |
| **unset entirely** | 1 |
| `PUBLISH-PROD` | **0** |

All 12 refusals print `refusing production publish: ...` on stderr; the accept writes `confirmed: PUBLISH-PROD` to `$GITHUB_STEP_SUMMARY`. AC3 independently reproduced (broader than the executor's 6-bad set).

`scripts/lint-update-message.js` — 17 direct CLI probes: 4 accepts (incl. `T116: pawcareright legacy brand token still passes` — the convention is deliberately brand-agnostic, correct), 13 rejects (missing id, lowercase `t116:`, `T16:`, no colon, empty summary, leading/trailing space, `[CRITICAL]`, mid-string `[critical]`, embedded newline, >120 chars, `M100:`, `T1160:`). Derivation: 4 ok, 3 loud failures. Usage errors exit 1 on no-args / unknown arg / extra arg.

`scripts/check-api-build.js` — 15 probes, full fail-closed matrix: match→0; mismatch, `status:"degraded"`, missing buildId, `not json`, prefix-only both directions, empty `--expect`, empty body, `null`, `[]`, whitespace-padded buildId, numeric buildId, usage → all 1. Unreachable endpoint: the REAL extracted pre-flight body with `PROD_API_URL=http://127.0.0.1:1/nope` → **exit 7** (curl fails, `set -e` aborts before the script runs). Fail-closed.

Injection probe on the extracted `Lint update message` bodies (prod + preview), 10 payloads (`"; rm -rf <sandbox>`, `$(touch ...)`, backticks, `T116: ok"; touch ...; #`, embedded-newline `message=evil`): canary file intact, `/tmp/pwned` never created, `$GITHUB_OUTPUT` NEVER received a second line (the newline rule + `set -e` blocks GITHUB_OUTPUT injection before the write). Payload text passes through as inert data only.

## C4 — D3 descope integrity (PASS)

- `git diff apps/mobile/src/ota/update-controller.ts` filtered to non-comment lines → EMPTY. Truly comment-only; `hasCriticalMarker`'s body is byte-identical.
- Both D3 pins present and green (ota-publish-ci.test.ts:455 `[critical]` follow-up step; :466 `ciYmlSource` contains neither `EXPO_UPDATE_MESSAGE` nor `updateMessage`).
- The config-mirror critical path T114 built is still covered: `remote-config.service.spec.ts:110`, `remote-config.e2e-spec.ts:57/68`, `app-config-queries.test.ts:44/59-108`, `app-config-cache.test.ts`, `update-controller.test.ts`, `use-upgrade-state.test.tsx`, `packages/types/src/config.spec.ts`. All green in the full runs.
- OTA_UPDATES §5 not contradicted: §5.3's pre-flight is now actually IMPLEMENTED (it did not exist before). The descope only removes a manifest-marker path the doc never required; §3's `/config.criticalOtaVersion` remains the authoritative signal, and both the workflow summary step and the runbook state that in plain words.
- Inert probe documented in the doc-comment (28 lines) + runbook.

## C5 — /health buildId (PASS)

- Source: `HealthService.check()` → `this.appConfig.gitSha` → `env.GIT_SHA` (`env.schema.ts:51`, `z.string().min(1).default("dev")`). Same field `sentry.ts:32` uses for the pinned release, and ci.yml:80 already set `GIT_SHA: ${{ github.sha }}` for the build job (ci.yml:69 comment) — so the build id is the same commit sha semantics Sentry releases use. Consistent, no new env key, no `.env.example` change needed.
- ADDITIVE ONLY: `HealthStatus` keeps `status`/`db`/`redis` unchanged; only `buildId: string` is added. No consumer of `/health` exists in web/mobile/api-client (grep) → no old monitor breaks. try/catch + `ServiceUnavailableException` untouched (a build id can never make a healthy service unhealthy).
- Both e2e assertions use `expect.any(String)` + a non-empty check, NOT a hardcoded `"dev"` (app.e2e-spec.ts:39, guards.e2e-spec.ts:182), each with the ci.yml `GIT_SHA` rationale comment. Verified no THIRD health-shape assertion exists: `security.e2e-spec.ts` and `devices.e2e-spec.ts` hit `/v1/health` but assert only headers/CORS.
- Non-tautological service test: `health.service.spec.ts:38` drives `gitSha: "deadbee"` against a default of `"test-sha"`.
- `pnpm --filter api test` run ONCE: EXIT=0, **113 suites / 1152 tests passed**.

## C7 — gates reproduced (ALL GREEN)

| gate | result |
|---|---|
| `pnpm typecheck` | EXIT=0 — 16/16 |
| `pnpm lint` | EXIT=0 — 15/15, 0 errors (1 pre-existing api warning) |
| `pnpm --filter api test` | EXIT=0 — 113 suites / 1152 tests |
| `pnpm --filter mobile test` | EXIT=0 — 200 suites / 1712 tests / **19 snapshots passed** |
| `pnpm --filter @bombaypetcompany/web test` | EXIT=0 — 16 suites / 203 tests |
| `pnpm build` | EXIT=0 — 9/9 |
| `pnpm test:ai-evals` | NOT RUN — `packages/ai` is untouched by this diff (`git diff --stat` shows no `packages/**`). Stated, not silently skipped. |

## C8 — deviation, anomaly, detector lint (PASS, 1 LOW)

- guards.e2e deviation LEGITIMATE and mandatory: baseline `guards.e2e-spec.ts:179` asserted `toEqual({status,db,redis})`; with `buildId` added the api suite CANNOT pass without it. Fixed identically to app.e2e-spec (`expect.any(String)`, not `"dev"`), with the same rationale comment. Plan R4 anticipated "a shared e2e assertion" (singular) — the count was wrong, the shape of the fix was right. Correctly self-flagged.
- Tree-anomaly sanity: `git status --porcelain` shows exactly 8 M + 5 ?? — no stray `.bak`/`.orig`/backup files, no unexplained edits. Every modified file is accounted for by the plan or the flagged deviation. The mid-run system-reminders left nothing behind.
- `node scripts/scan-secrets.js --tracked` → EXIT=0. No secrets; `EXPO_TOKEN`/`PROD_API_URL` are `secrets.`/`vars.` references only.
- §7 safety-content detector on all added prose (ci.yml comments, runbook §7, doc-comment, scripts): zero matches for `diagnos*`, `dosage`, `dose `, `mg/kg`, `administer`. No user-facing string, no AI surface, no `<VetDisclaimer/>` surface touched → §7 not engaged. Correct.
- CLAUDE §1a: no `Bombay Pet Company` hardcode (the only occurrence is a comment saying the script needs none); zero new `pawcareright` identifiers; `bombaypetcompany.app` used for the PROD_API_URL fallback.
- **LOW:** two `console.log` calls introduced (ci.yml:445/447) — see Finding 3.

## C6 — CHECKER's own mutation proofs (5, atomic, sha1 + trap-guarded)

Backup `/tmp/ci.yml.checker.bak`, `SHA_BEFORE=f199ee515cee0b47517383a5a27a62bcbb88ea1a`, `trap restore EXIT`, restore verified by sha1 after EVERY mutation (all 6 restores reported `RESTORED ok f199ee51…`; final `git diff --stat` unchanged at 227 insertions / 2 deletions).

Probe = `pnpm --filter mobile test -- --testPathPattern ota-publish` (28 tests).

| # | mutation | result | verdict |
|---|---|---|---|
| M0 | none (baseline) | 28/28 pass, exit 0 | control GREEN |
| M1 | production job `if:` also fires on `push` | **exit 1**, 1 failed | RED — "the production publish job is manual-dispatch only" catches it |
| M2 | swap `Pre-flight API build check` ⇄ `Publish OTA update (production)` (parser-confirmed new order) | **exit 1**, 1 failed | RED — "pre-flights /v1/health before publishing" index comparison catches it |
| M3 | `--percent 10` → `--percent 100` in the EXECUTED rollout command (step name left as "Constrain rollout to 10%") | **exit 0, 28/28 PASS** | **GREEN = GAP → Finding 1** |
| M4 | add gate job `brand-new-gate`, do NOT add it to either `needs:` | **exit 1**, 2 failed | RED — both needs-set equality tests catch it (set-derived, not hardcoded) |
| M5 | weaken guard to case-insensitive + whitespace-stripping | **exit 1**, 1 failed | RED — the executed-guard table catches it |

4 of 5 mutations go RED. M3 is the one silent mutant: nothing pins the rollout percentage on the command that actually runs.

## C9 — review written, verdict issued

`loop/reviews/T116.review.md` written: 10 sections, 5 numbered findings (1 MEDIUM + 4 LOW), 0 HIGH, AC-by-AC table, `FINAL VERDICT: pass`.

Final tree sanity after all mutation work: `git status --porcelain` = 8 M + 5 ?? (plus the two loop/ files this checker owns), `.github/workflows/ci.yml` sha1 `f199ee515cee0b47517383a5a27a62bcbb88ea1a` == SHA_BEFORE. No code file was written or edited by the checker.
