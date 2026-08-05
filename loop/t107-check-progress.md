# T107 CHECKER progress log

Baseline HEAD: 6c05b94 (chore(loop): T107 plan)
Working tree: uncommitted T107 diff.

Legend: [ ] pending, [~] in progress, [x] done, [!] finding raised

## Check queue
- [ ] C0 Read CLAUDE.md §6/§7, plan, exec progress
- [ ] C1 Inventory vs plan; hook-protected/journal/lockfile untouched; snapshot diff strings-only; non-goal guards
- [ ] C2 §7 copy audit (both arms), price/trial sourcing
- [ ] C3 Event semantics (assignment/exposure/dedupe/signed-out/PII/variant-flip)
- [ ] C4 Attribution soundness D2 (identity chain)
- [ ] C5 Min-sample constant + formula + no-peek + kill-switch vs env schema
- [ ] C6 Targeted + full gate reproduction
- [ ] C7 Own mutation proofs (>=2)
- [ ] C8 Deviation review
- [ ] C9 Doc quality

## Log
- C0 done: read CLAUDE.md (in context), plan, exec progress.
- C1 (partial): git status = 12 modified + 10 untracked (7 planned creates + 3 loop files incl. my own 2). Matches plan inventory + the 4 deviation test files. No lockfile / journal / loop-state / LOOP_PROTOCOL / CLAUDE.md / PHASES.md change. No apps/api change. No packages/ai change (test:ai-evals not required).
- C1 snapshot: diff is exactly 2 string lines inside the `variant B` snapshot block (`7-day free trial`->`Free for 7 days`, `Start your 7-day free trial — then …`->`Try it free for 7 days — then …`). ZERO structural delta, variant-A block untouched. PASS.
- C1 non-goal guards: `packages/analytics/src/dashboards/**` and `docs/observability-dashboards.md` absent from the diff. PASS.
- C3 FINDING (HIGH, F1): `captureAssignmentOnce` sets `assignedThisSession = variant` BEFORE calling `captureEvent`, and `captureEvent` (analytics.ts:26-32) silently no-ops when `useAuthStore.getState().user?.id === undefined`. `AppRoot`'s auth `status` starts as `"restoring"` with `user: null` (auth-store.ts:44-48; `restore()` is async). The assignment effect runs on AppRoot's FIRST commit, i.e. while signed out -> dedupe latch set, NO event emitted, effect never re-runs (deps `[variant]`). Details + reachability matrix in the review.
- C3 FINDING (MEDIUM, F2): `usePaywallConfig()` seeds `initialData: readCachedConfig() ?? DEFAULT_APP_CONFIG` whose `variant` is `"A"` -> on a fresh install the hook returns a FALLBACK "A", not a resolved variant. Doc §3's "the first time the resolved variant is observed" is inaccurate; contamination path documented only for the env-flip case.
- C3: test-suite blind spot confirmed — paywall-experiment-events.test.tsx `beforeEach` always sets a signed-in user before render, and mocks `usePaywallConfig` to return a resolved variant, so neither F1 nor F2 can be caught.
- C6 GATES (independently reproduced):
  - `pnpm typecheck --force` EXIT=0, 16/16, 0 cached (49.9s).
  - `pnpm lint --force` EXIT=0, 15/15, 0 cached; only pre-existing "unused eslint-disable" warnings in packages/ai (2) + apps/api (1). No new warning from the diff.
  - analytics suite: 12 suites / 85 tests PASS (incl. paywall-ab.spec, paywall-ab-doc.spec, store-privacy-doc.spec).
  - targeted mobile 7 files: 36 tests PASS (paywall-experiment-events 8, paywall-snapshot, strings-detector-lint, root-layout, upgrade-gate-precedence, fonts-nonblocking, paywall-analytics).
  - `pnpm --filter @bombaypetcompany/mobile test`: 203 suites / 1784 tests PASS — matches the executor's claim exactly.
  - `pnpm test --force`: EXIT=1 on FIRST run — `@bombaypetcompany/api` test/account-deletion.e2e-spec.ts "D1a" failed with `Engine is not yet connected` raised from a BullMQ `QueueEvents.onFailed` handler AFTER teardown. apps/api has ZERO diff (`git diff --stat apps/api packages/ai` = 0 lines). Re-ran `pnpm --filter @bombaypetcompany/api test` -> EXIT=0, 116 suites / 1177 tests PASS. Classified as a pre-existing teardown flake, NOT attributable to T107. Recorded, not a finding against this task.
  - `pnpm test:ai-evals` correctly skipped: packages/ai has no diff.
- C4 D2 identity chain VERIFIED SOUND: `use-purchases-init.ts:24-27` -> `identifyPurchaser(state.user.id)` -> `purchases.ts:147` `native.logIn(userId)`; `rc-webhook.service.ts:96` `distinctId: event.app_user_id` -> `captureForUser(...)` at :104; mobile `analytics.ts:27` distinctId = `useAuthStore.getState().user?.id`. All three are the same backend `User.id`. Doc §4's claim is accurate.
- C5 kill switch VERIFIED: `apps/api/src/config/env.schema.ts:27` `PAYWALL_VARIANT: z.enum(["A","B","AUTO"]).default("AUTO")` — byte-matches the doc §3 quote; `assignPaywallVariant` returns the override verbatim when set to A/B. Min sample: constant 900, spec recomputes `Math.round((16*0.1*0.9)/0.04**2)` = 900; doc §5 carries the same formula + the no-peek rule.
- C2 COPY AUDIT: both arms scanned; zero hits for diagnos*/cure/treat/heal/dose/dosage/mg/medicat/vet-approved/guarantee/emergency/urgency tokens. Real T038 `scanUnsafeText` + claims tier (strings-detector-lint.test.ts) green over the whole tree. §7 rules 1-2: PASS.
- C7 MY OWN MUTATION PROOFS (all atomic, sha1-verified restores; final `sha1sum -c baseline.sha1` = 4/4 OK, `git status --porcelain` byte-identical to pre-check):
  - MP1 (PII prop pin): added `email: string;` to `paywall_experiment_assigned` in `packages/analytics/src/events.ts` -> `store-privacy-doc.spec.ts` RED (1 failed / 4 passed; `missingFromDoc` non-empty at spec:213). PROVES the property shape is pinned both directions — a PII-ish prop cannot be added silently. Restored -> 12 suites / 85 tests GREEN. (Restore note: my first restore used `git checkout --`, which reverted the file past the T107 edit to HEAD; detected via sha1 mismatch and re-applied the exact T107 hunk -> sha1 6c3feb3a... restored byte-exact. Subsequent MPs used scratchpad `cp` backups.)
  - MP2 (arm-copy swap): replaced variant B's `trialCta`/`trialCtaWithPrice` with variant A's text -> 2 RED (`paywall-snapshot.test.tsx` snapshot mismatch + `paywall-experiment-events.test.tsx` "emits paywall_experiment_exposed with variant B and renders the B trial framing"). Restored -> 11/11 GREEN, sha1 8d3037a1... exact.
  - MP3 (exposure on config load): added `captureExposure(variant)` to `use-paywall-experiment-assignment.ts`'s effect so exposure fires at ROOT config load instead of only on paywall render -> `paywall-experiment-events.test.tsx` RED ("emits paywall_experiment_assigned once per session..."). PROVES the exposure emission point is pinned to the paywall screen. Restored -> sha1 2766e4f8... exact.
  - MP4 (F1 blind-spot probe): reordered `captureAssignmentOnce` so the latch is set AFTER `captureEvent` -> FULL mobile suite 203/1784 GREEN (no test distinguishes the ordering).
  - MP4b (F1 candidate fix): added a signed-in guard BEFORE consuming the latch (`useAuthStore.getState().user?.id === undefined -> return`) -> FULL mobile suite 203/1784 STILL GREEN. PROVES (a) F1 is entirely invisible to the 1784-test suite, and (b) the fix is non-breaking. Restored -> sha1 4adbd291... exact.
- C8 DEVIATIONS: both reverse-verified by me. `git diff --stat` = +10/+10, ZERO deletions, no assertion touched. Removing the added mocks reproduces the executor's stated failures (root-layout.test.tsx -> "No QueryClient set, use QueryClientProvider to set one"; paywall-analytics.test.tsx -> FAIL). Restored -> 2 suites / 12 tests GREEN. Both justified and correctly scoped.
- C8 SYSTEMIC (F7, INFO): bare-passthrough-provider mock pattern, 3rd occurrence (T114, T115-adjacent, now T107). Recommend an M11 refactor to a shared `renderRootLayout()` helper wrapping a real QueryClientProvider.
- C9 DOC QUALITY: all 8 sections in order; stop conditions concrete (no-peek, 28-day max, decision rule, immediate safety stop overriding 1-3, run-voiding on mid-run flips); kill switch documented and accurate vs env schema; §8 honesty block present with the required sentence and a fair does/does-not-prove split; founder recipe complete (env, console, staging verification, decision authority, store/legal). Caveats raised as F3 (PostHog experiment-vs-flag wiring), F5 (§6.3 self-contradiction), and the §3 accuracy gap folded into F2.
- FORBIDDEN-PATTERN SCAN over the whole diff + created files: no `any`, no `@ts-ignore`, no `console.log`, no TODO/FIXME, no secret-shaped literal, no phc_ key, no inline style objects. (Two regex hits were English prose in docs/store-privacy.md.) Doc anchor `events.ts:24-61` verified exact (AnalyticsEventMap spans 24-61).
- REVIEW WRITTEN: loop/reviews/T107.review.md — 7 numbered findings (2 HIGH, 2 MEDIUM, 2 LOW, 1 INFO), gate table, mutation-proof table, AC map. FINAL VERDICT: fail (F1 + F2 HIGH).
- TREE INTEGRITY: `sha1sum -c baseline.sha1` 4/4 OK; `git status --porcelain` identical to pre-check state; packages/analytics dist rebuilt and suite re-verified 85/85.
- RE-REVIEW (fix round): F1 RESOLVED (signed-in check before latch + `resolved` gate; `resolved` in the deps array is load-bearing for arm A — probe C dropping it = 2 RED). F2 RESOLVED (exposure gated on resolved; probe D un-gating = RED with the exact `variant:"A"` symptom). F3/F4/F5 RESOLVED (doc §7.2 Insight-first + candid flag-mismatch note; CTA binds monthly.priceString, probe E = snapshot RED; §6.3 now PAYWALL_VARIANT=A). Refetch-failure path = fail-open resolve on stale data (fetchAppConfig never throws), disclosed in hook header + doc §3 + §8. Never-signed-in = no events by design, disclosed in §3/§8 + pinned by auth-resolution test 1. Snapshot delta exactly 3 text lines (numstat 3/3). Gates: typecheck 16/16, lint 15/15, mobile 204/1787, analytics 85, build 9/9; `pnpm test --force` hit the SAME pre-existing account-deletion.e2e teardown flake (different case this time, api untouched, rerun 1177/1177). Tree restored byte-exact (sha1 4/4). FINAL VERDICT: pass.
