# T113 CHECKER progress ledger

Baseline HEAD: 70d13f9 ("chore(loop): T113 plan"). Working tree = uncommitted T113 diff.

## Checks (skeleton — appended as completed)

- [ ] C1. Diff inventory vs claims (git status, eas.json/eas-config.test.ts untouched, lockfile delta, package.json delta, hook-protected paths, journal/loop-state)
- [ ] C2. app.config.js: runtimeVersion policy, updates.url single-source, founder comment, D4 ruling vs OTA_UPDATES §1/§3
- [ ] C3. Hook safety: ota-info.ts + use-ota-info.ts read; no import-time crash; run hook spec
- [ ] C4. AC2 evidence integrity: scratchpad JSONs/diff outputs vs ledger hashes; re-run script dry-run + refusal paths; rule on "fixture branch" equivalence
- [ ] C5. CI job: trigger, base-tree checkout, STEP_SUMMARY, pinned npx, secrets, yaml parse, doesn't break existing jobs; ota-config pin
- [ ] C6. Own mutation proofs (>=2, atomic, sha1-verified revert)
- [ ] C7. FLAKE-2 stash-methodology soundness + tree integrity now
- [ ] C8. Gate reproduction: typecheck, lint, mobile suite, build
- [ ] C9. Runbook edits accuracy (§7 status line, §9 items 17-19)
- [ ] C10. Forbidden-pattern / safety-content / secrets scan

## Log

(appended below as each check completes)

### C1 — Diff inventory vs claims: PASS
- `git status --porcelain`: exactly 5 M (`.github/workflows/ci.yml`, `apps/mobile/app.config.js`, `apps/mobile/package.json`, `docs/release-runbook.md`, `pnpm-lock.yaml`) + 5 ?? (`ota-config.test.ts`, `use-ota-info.test.tsx`, `fingerprint-diff.sh`, `use-ota-info.ts`, `ota-info.ts`) + ledger. Matches claims.
- `git diff --stat -- apps/mobile/eas.json apps/mobile/__tests__/eas-config.test.ts` → EMPTY. Both genuinely untouched.
- `git diff -- package.json` (root) → EMPTY. No root manifest mutation.
- `apps/mobile/package.json` diff = exactly 2 added lines: `"ota:fingerprint": "sh scripts/fingerprint-diff.sh",` (after `dist:internal`) and `"expo-updates": "~57.0.11",` (between expo-status-bar and expo-web-browser). No reorder residue.
- Lockfile: new `resolution:` blocks = arg@4.1.3, expo-eas-client@57.0.1, expo-json-utils@57.0.1, expo-manifests@57.0.1, expo-structured-headers@57.0.0, expo-updates-interface@57.0.1, expo-updates@57.0.11. ZERO removed resolution blocks. Only `specifier:` change is `+ specifier: ~57.0.11`. Remaining +/- lines are peer-hash re-keying (`jest@29.7.0` → `jest@29.7.0(@types/node@22.20.1)`, expo-router peer hash) with no version movement — benign re-resolution.
- Hook-protected/out-of-inventory paths (CLAUDE.md, LOOP_PROTOCOL.md, docs/PHASES|OTA_UPDATES|MODEL_STRATEGY|AI_PROVIDERS.md, .claude/**, loop/journal.md, loop/loop-state.json, .env.example, packages/**, apps/api, apps/web, turbo.json, jest.setup.ts, sentry.ts, strings.ts) → `git status --porcelain` EMPTY for all. No commit made.
- `git stash list` → empty (no stash residue from the FLAKE-2 investigation).

### C2 — app.config.js: PASS (D4 ruled SAFE)
- `apps/mobile/app.config.js:32` `const EAS_PROJECT_ID = "a7a52d2d-c7f4-44b0-9234-017d07bd1ced";` — same literal as the pre-diff `extra.eas.projectId`; no new UUID invented.
- `:52` `runtimeVersion: { policy: "fingerprint" },` top-level (D2 ✓).
- `:61-65` `updates: { url: \`https://u.expo.dev/${EAS_PROJECT_ID}\`, fallbackToCacheTimeout: 0, checkAutomatically: "ON_ERROR_RECOVERY" }` — url template-derived from the same const, so drift is structurally impossible (D1 ✓).
- `:118` `projectId: EAS_PROJECT_ID` — reuse, not retyped.
- Founder-pending comment: intact and correctly relocated onto the const, extended with the T113 note; no information lost vs the removed T099 block.
- No `plugins` entry for expo-updates (correct — autolinked config plugin).
- D4 ruling: **safe groundwork, not prejudicial to T114.** OTA_UPDATES §3 mandates a JS-driven `checkForUpdateAsync` cold-start flow that is "non-blocking, 3s budget". `checkAutomatically: "ON_ERROR_RECOVERY"` disables the native check-on-launch, which is a *precondition* for T114's JS flow being the actual mechanism; `fallbackToCacheTimeout: 0` is what makes launch not wait on the network. T114 still owns 100% of the JS flow (fetch, critical flag, deferral guard, 6h AppState throttle, reloadAsync) — none of it is constrained by these two native keys. The fingerprint-input rationale is directionally right (both keys land in Expo.plist / AndroidManifest.xml). Setting them now is strictly better than a second fingerprint break at T114.

### C8 (part) — Gate reproduction: typecheck / lint / build GREEN
- Cached run: `pnpm typecheck` 16/16, `pnpm lint` 15/15, `pnpm build` 9/9 (all FULL TURBO).
- **Forced, uncached** re-run: `pnpm typecheck --force` → 16/16 successful, `Cached: 0 cached, 16 total`; `pnpm lint --force` → 15/15 successful, `Cached: 0 cached, 15 total`, 0 errors (3 pre-existing "Unused eslint-disable directive" warnings in packages/ai + apps/api, unrelated to this diff). Log: `scratchpad/checker-gates2.log`.

### C5 — CI job: **FAIL (2 findings, 1 HIGH)**
- Structure otherwise correct: `mobile-fingerprint:` placed after `build`, before `ai-evals`; `if: github.event_name == 'pull_request'` (PR-only per card); head checkout → pnpm 10.34.3 → node 22 + pnpm cache → `pnpm i --frozen-lockfile`; second `actions/checkout@v4` with `ref: ${{ github.event.pull_request.base.sha }}` `path: base-tree` + its own real install (honest autolinking); `tee -a "$GITHUB_STEP_SUMMARY"`; `upload-artifact@v4` `if: always()` `retention-days: 30` `if-no-files-found: warn`; no secrets referenced; no existing job/step/env/service touched.
- `pnpm-workspace.yaml` globs are `apps/*` + `packages/*`, so `base-tree/**` cannot be absorbed into the head workspace — that risk is clear.
- **FINDING 1 (HIGH):** the `--` separator breaks the invocation. Reproduced with the *exact* CI-pinned pnpm (10.34.3, `packageManager` + `action-setup` both 10.34.3):
  `cd apps/mobile && pnpm ota:fingerprint -- --dry-run --platform ios`
  → `> sh scripts/fingerprint-diff.sh -- --dry-run --platform ios`
  → `fingerprint-diff: unknown argument '--' -- usage: …` , exit **1**.
  Same form without `--` exits 0 and prints the plan. pnpm 10 forwards the literal `--` to the script; the script's `*)` arm rejects it. Both CI steps use the `--` form, so the job produces **no fingerprint diff at all**.
- **FINDING 2 (MEDIUM):** `{ … } | tee -a "$GITHUB_STEP_SUMMARY"` masks the failure. GitHub's default `run` shell is `bash -e {0}` (no `pipefail`), so the pipeline's status is `tee`'s. Reproduced locally with `bash -e`: a failing command inside the group → `STEP_EXIT=0`, and because `-e` aborts the group the closing fence never prints, leaving a truncated summary with the refusal on stderr and no diff. This directly falsifies the job's own comment ("fails only if the tooling itself fails … NEVER because the fingerprint changed") and is the functional equivalent of the `|| true` masking that `ota-config.test.ts` forbids in the script.
- Net effect of 1+2: on every PR the job goes **green while silently emitting nothing**. AC2's "fingerprint-diff CI step outputs" is not met in CI.

### C3 — Hook safety: PASS
- `ota-info.ts:53-61` `defaultLoader`: `require("expo-updates")` is inside the function body AND inside `try/catch`; returns `null` on failure. Nothing is required at module load → no import-time crash path. `use-ota-info.ts:1-4` imports only `react` + the pure local module (type-only import for `OtaInfo`/`UpdatesLoader`).
- `readOtaInfo:78-97`: `loader()` wrapped in try/catch → `ABSENT_OTA_INFO`; `native === null` → `ABSENT_OTA_INFO`; `isEnabled: native.isEnabled === true` (non-boolean → false); `isEmbeddedLaunch: native.isEmbeddedLaunch !== false` (fails *safe* toward "embedded"); `normalizeNullableString` maps non-string AND `""` → `null`. Matches plan step 7 exactly.
- `useOtaInfo:17-18` = `useMemo(() => readOtaInfo(loader), [loader])` — no state/effect/polling, boot-time semantics correct.
- Boot-time tag *wiring* (Sentry/PostHog): plan F6 explicitly assigns this to T117 and forbids touching `sentry.ts`. Verified `src/observability/sentry.ts` is untouched (`git status` clean). Scope honestly excluded, not silently dropped — both doc comments name T114/T117 as the consumers.
- Spec run (real tree): `apps/mobile/__tests__/use-ota-info.test.tsx` 6/6 pass (part of the 15/15 below).
- No user-facing string, no `console.*`, no `any`, strict TS.

### C4 — AC2 evidence integrity: PASS (evidence is genuine and byte-reproducible)
Scratchpad `t113/` artifacts cross-checked against the ledger:
| Ledger claim | Artifact | Match |
|---|---|---|
| pre-android hash `53bcafdfe3affb4fd10123befaac3863863e421d` | `pre-android.json` | ✓ exact |
| pre-ios hash `33191a73ee66df16d1401f95259a750bd3fd7dee` | `pre-ios.json` | ✓ exact |
| android diff 135 lines, 4 `expo-updates` hits, verdict CHANGED | `diff-android-output.txt` | ✓ 135 / 4 / CHANGED |
| ios diff 124 lines, 3 `expo-updates` hits, verdict CHANGED | `diff-ios-output.txt` | ✓ 124 / 3 / CHANGED |
- The diff outputs contain the committed script's own echo lines ("resolved…/falling back to pinned npx @expo/fingerprint@0.20.5", "generating current-tree fingerprint ->", "diffing … vs …"), proving the output came from `apps/mobile/scripts/fingerprint-diff.sh`, not hand-authored.
- **Independent re-run by me** (`sh scripts/fingerprint-diff.sh --base <pre-android.json> --platform android --out-dir <my own dir>`) → exit 0, verdict `CHANGED — store binary release required (OTA_UPDATES §1)`, and my `current-android.json` hash `5725d529beabb2c41259b01848a2c108c9afb9b0` is **byte-identical** to the executor's. Fully reproducible.
- Refusal/arg paths re-run by me: `--dry-run` exit 0 (plan text only, no verdict); missing `--base` exit 1; unreadable `--base` exit 1; `--platform windows` exit 1; `--bogus` exit 1. No `|| true`, no masking inside the script.
- **UNCHANGED branch (untested by the executor) verified by me**: diffing a fingerprint against a regeneration of itself → `[]` → `fingerprint-diff: UNCHANGED — OTA-eligible`, exit 0. Both verdict branches are live.
- **D4's "fingerprint input" rationale empirically CONFIRMED** (I checked the actual fingerprint sources, not the narrative): `current-android.json` contains a source `type=contents id=expoConfig` whose contents include `ON_ERROR_RECOVERY`, `fallbackToCacheTimeout`, `runtimeVersion`, `u.expo.dev`; the pre-install baseline's `expoConfig` source contains **neither** `ON_ERROR_RECOVERY` nor `runtimeVersion`, and its hash differs (`4addfe55…` → `075f78b1…`). So deferring those two keys to T114 would indeed have broken the fingerprint a second time. D4 is correct and is the right call.
- **Ruling on the "fixture branch" substitution (D9):** ACCEPTED as a faithful equivalent. The card asks for evidence that the step "outputs on a native-dep-change fixture branch". Installing `expo-updates` is a genuine native-dep change (it added `android/expo-updates` + `android/expo-updates-gradle-plugin` dirs and changed `expoAutolinkingConfig:android` in the diff), and the diff was taken across that change with the real tool and the committed script. The only thing the ordering trick does *not* exercise is the CI job's own base-tree checkout plumbing — and that is precisely where FINDING 1 lives (see C5), which this substitution allowed to go undetected. So: evidence honest, but not a substitute for validating the CI invocation.

### C9 — Runbook edits: PASS (one nit)
- §7: the single sentence "This command is available only after T113 installs `expo-updates`." is replaced with an accurate T113 status naming the `mobile-fingerprint` job and the script path. The following OTA_UPDATES pre-REBRAND-1 note is preserved byte-identical. Honest — it does not claim any founder-side verification that hasn't happened (item 19 still asks for it).
- §9 item 1: parenthetical extended only; not renumbered/reworded. Items 2–16 byte-identical.
- Items 17–19 match the plan's founder-to-do delta verbatim.
- Item 17's technical claim ("builds produced before T113 can never receive an OTA update") is **correct** per OTA_UPDATES §1 (fingerprint mismatch ⇒ not OTA-eligible) and is doubly true here because pre-T113 binaries contain no `expo-updates` runtime at all. Empirically supported by the hash change `53bcafd…` → `5725d52…`.
- NIT (cosmetic, LOW): §7 says "`updates.url` is derived from `extra.eas.projectId`" — actually both derive from the shared `EAS_PROJECT_ID` const; `updates.url` is not derived *from* `extra.eas.projectId`. Harmless, directionally right.
- `release-runbook-doc.test.ts` passes (in the 189-suite run); no line contains both `10%` and `50%`; no secret-shaped value added.

### C10 — Forbidden patterns / safety content / secrets: PASS
- `console.log` / `any` / `@ts-ignore` / `@ts-expect-error` / `TODO` / `FIXME`: the only grep hits are (a) the English word "any" inside comments (`ota-info.ts:72`, `app.config.js:50`), and (b) `console.log` inside a shell `node -e "…"` string in `fingerprint-diff.sh:112`, which is how the script captures the resolved CLI path — not app-code logging. No violations.
- Every `eslint-disable` in the new files carries a `-- JUSTIFIED:` rationale (4 in `ota-config.test.ts`, 1 in `ota-info.ts`).
- Safety content (CLAUDE §7): grep for `diagnos|dosage|dose |mg/kg|administer|sedat` across all touched files → NONE. The card adds zero user-facing strings; `strings.ts` untouched; `<VetDisclaimer/>` placement scan and a11y scans still green in the 189-suite run. Correctly NOT a safety-escalation card.
- Secrets: no secret-shaped literal in the diff; the only long literal is the pre-existing EAS project UUID (unchanged value). CI job requires no secrets.

### C6 — Checker mutation proofs (4, atomic, in-place per loop protocol, sha1-verified)
Worktree approach abandoned on coordinator instruction; `git worktree remove --force` + `git worktree prune` run, `git worktree list` shows only the main tree. All proofs below are transient in-place mutations on the REAL tree, one atomic Bash invocation each, `trap 'cp $BAK …' EXIT` + explicit restore + sha1 re-verify.

| # | Mutation | Target spec | Result |
|---|---|---|---|
| 1 | `app.config.js` `updates.url` → hardcoded `https://u.expo.dev/deadbeef-0000-4000-8000-000000000000` (diverging from `EAS_PROJECT_ID`) | `ota-config.test.ts` | **RED** — ✕ "points updates.url at the EAS project referenced by extra.eas.projectId", 1 failed / 8 passed. D1 drift guard is real. |
| 2 | `ci.yml` job `mobile-fingerprint:` → `mobile-fp-renamed:` | `ota-config.test.ts` | **RED** — ✕ "wires a pull-request fingerprint job in ci.yml", 1 failed / 8 passed. Pin is real. |
| 3 | `ota-info.ts` `defaultLoader` → eager module-top `require("expo-updates")` | `use-ota-info.test.tsx` + `ota-config.test.ts` | **GREEN, 15/15** — ⚠️ coverage gap, see FINDING 3. |
| 4 | `app.config.js` `checkAutomatically` → `"ON_LOAD"`, `fallbackToCacheTimeout` → `30000` | `ota-config.test.ts` | **RED** — ✕ "keeps the cold-start check non-blocking (OTA_UPDATES §3)", 1 failed / 8 passed. D4 pin is real. |

Restore verification — sha1 identical before and after every proof, and identical to the values first observed at the start of this review:
`app.config.js 99576ab9…`, `ota-info.ts 7d205fe0…`, `ci.yml d1fd0d28…`, `use-ota-info.ts 4b5f9584…`, `fingerprint-diff.sh 987da56c…`, `package.json e80723b1…`. `git status --porcelain` unchanged (5 M + 5 ?? + loop files). `git stash list` empty. `ci.yml` re-parses with `yaml.safe_load`, job order `build, mobile-fingerprint, ai-evals, web-perf-budget, web-e2e, security`.

### C7 — FLAKE-2 stash methodology: conclusion sound, methodology flawed (NOTE, not blocking)
- Flaw: `git stash` **without `-u`** does not stash untracked files, so during the executor's "baseline" run the 5 new T113 files (`ota-info.ts`, `use-ota-info.ts`, `fingerprint-diff.sh`, both specs) were **still present** in the tree. It was therefore not a true baseline, and the stash/pop round-trip on a tree with untracked files is a real (if unrealised) risk of losing work.
- The conclusion is nevertheless correct on stronger, independent grounds that need no stash at all: `git status --porcelain -- apps/api` is EMPTY (T113 touches zero api files), and my own **forced, uncached** `pnpm test --force` run is 16/16 tasks successful, `Cached: 0 cached, 16 total`, EXIT=0, **zero `FAIL` lines** — including apps/api. The account-deletion "Engine is not yet connected" teardown race did not reproduce for me at all.
- Tree integrity NOW: verified clean (sha1s above, no stash entries, `.git/refs/stash` absent, no `*.orig`/`*.rej`). No residue.

### C8 — Gate reproduction (all independently re-run by me): GREEN
| Gate | Result |
|---|---|
| `pnpm typecheck --force` | 16/16 successful, **0 cached** |
| `pnpm lint --force` | 15/15 successful, **0 cached**, 0 errors (3 pre-existing unused-eslint-disable warnings in packages/ai + apps/api) |
| `pnpm test --force` | 16/16 successful, **0 cached**, EXIT=0, zero FAIL lines, 1m49s |
| `pnpm --filter @bombaypetcompany/mobile test` | **189 suites / 1562 tests / 19 snapshots passed**, EXIT=0 — exactly the claimed numbers |
| `pnpm build` | 9/9 successful |
| `pnpm test:ai-evals` | not required — `packages/**` untouched (verified via `git status`) |
Note: the mobile run prints "A worker process has failed to exit gracefully" — pre-existing teardown noise, exit code still 0.

### C11 — Review authored
`loop/reviews/T113.review.md` written. 6 findings (1 HIGH, 1 MEDIUM, 4 LOW) + 1 NOTE. FINAL VERDICT: fail (FINDING 1 HIGH unresolved).

### Final tree state after all checker activity
Worktree removed and pruned; 4 in-place mutations all restored with matching sha1; no code file edited persistently. `git status --porcelain` = 5 M + 5 ?? (T113) + 3 loop files (exec ledger, my check ledger, my review). `git stash list` empty.

### Checker self-correction (disclosed)
My mutation-proof 4 invocation `cd`'d back to the repo root before its `trap … EXIT` fired, so the restore
`cp` created a stray **untracked** copy of `app.config.js` at the repo root. Caught in the final
`git status`, verified identical (sha1 `99576ab9…`) to `apps/mobile/app.config.js` and untracked
(`git ls-files --error-unmatch` → "Did you forget to 'git add'?"), then removed with `rm -f`.
`apps/mobile/app.config.js` unaffected (same sha1 before and after). Final `git status --porcelain` is now
exactly the executor's 5 M + 5 ?? plus the 3 loop files. Lesson for future proofs: put the restore path in
the trap as an absolute path.

## RE-REVIEW ROUND (fix round) — complete
F1 RESOLVED (verified end-to-end: exact CI form w/ real --base → exit 0 + CHANGED verdict; `--` form also tolerated; all refusals still exit 1).
F2 RESOLVED (actual run-block text extracted via yaml.safe_load and executed under `bash -e`: tool failure → STEP_EXIT=1; CHANGED → STEP_EXIT=0 + well-formed summary).
F5 RESOLVED (3 new pins incl. spawnSync through the real pnpm indirection, + the `if: pull_request` pin). F6 RESOLVED. F4 WITHDRAWN (base tree may predate T113 → duplicate pin necessary). F3 accepted as deferred LOW.
NEW: FINDING 7 (LOW) pipefail pin counts its own explanatory comment → deleting one step's pipefail stays GREEN (proved, mutation 7). FINDING 8 (LOW) the `--)` hardening is unpinned.
Mutation proofs 5/6/7 atomic in-place, absolute-path traps, all restored to sha1 dc38114a (matches executor's claim). No stray files.
Gates: typecheck 16/16 forced, lint 15/15 forced, pnpm test --force 16/16, mobile 189/1565/19, api 113/1147, build 9/9. Two infra anomalies (my own lint/tsup concurrency race; one unreproducible api failure) both unattributable to T113 (packages/** and apps/api untouched).
FINAL VERDICT: pass. Header of the first-round verdict relabelled "FIRST-ROUND VERDICT (superseded…)" so the file ends with exactly one FINAL VERDICT line.
