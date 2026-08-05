# T108 checker progress ledger

- [x] C0 skeletons written
- [x] C1 inventory vs plan
- [x] C2 grant math
- [x] C3 RC-unaffected
- [x] C4 transaction integrity
- [x] C5 abuse/recursion
- [x] C6 erasure
- [x] C7 entitlement read path
- [x] C8 share copy §7
- [x] C9 gates
- [x] C10 mutation proofs (3/3, all RED, all restored sha1-verified)

## Log
- C0 DONE: skeletons written (review + this ledger).
- C1 DONE: `git status --porcelain` = exactly 10 created (9 files + migration dir) + 19 modified,
  matching plan §5 one-for-one. Only loop file touched = `loop/t108-exec-progress.md` (executor ledger,
  permitted). No lockfile, no journal.md, no loop-state.json, no CLAUDE.md/LOOP_PROTOCOL.md/PHASES.md,
  no `.claude/**`, no snapshot files, no `packages/ai/**` (so `test:ai-evals` not required).
- C1b DONE: migration SQL contains both plan-required indexes + the unique constraint; live psql
  `pg_indexes`/`pg_constraint` for `ReferralGrant` match the migration exactly (SET NULL on
  counterpartyUserId/inviteId, CASCADE on userId) => executor's FK mutation-proof restore left no drift.
- C2 DONE: chain-tip = `max(now, max(existing.expiresAt))`; fold uses `startsAt <= cursor`; cap `>= 3`
  (3rd lands, 4th skipped). +42d EMERGENT (3 x REFERRAL_GRANT_MS), no `42` literal in source. All epoch-ms
  arithmetic => UTC-safe, DST-immune. Same-instant grants are order-independent (Math.max fold).
- C3 DONE: no `subscription.(create|update|upsert|delete)`, no RC client, no `rc-webhook` reference in any
  added line. Joiner-row deletion verified as PRE-EXISTING (households.service.ts:151-153 household delete
  + schema.prisma:376 Subscription->Household Cascade), so the inviter-row-only probe is correctly attributed.
- C4 DONE: cap-hit returns silently; P2002 swallowed (unreachable, and ineffective at the PG layer - F1);
  other errors rethrown and roll the join back. Gating verified in households.service.spec.ts.
- C5 DONE: quota/entitlement.ts:21-23 maps entitled->PREMIUM ignoring `source` => grant-tier users CAN mint
  invites (R3 confirmed). Bounded per identity at +42d; system cost linear in identities. Doc §4/§5 tension (F4).
- C6 DONE: DMMF guard + comment-only erasure changes + counterparty-survival e2e; live FKs verified.
- C7 DONE: precedence structurally enforced by return order; a grant cannot shadow own/family.
- C8 DONE: copy is §7-clean; APP_DISPLAY_NAME used (CLAUDE §1a); over-promise nit = F3.
- C9 DONE: typecheck EXIT=0 (16/16); lint EXIT=0 (15/15); api FULL EXIT=0 FIRST RUN 120 suites/1219 tests
  (flake occurrences: 0 across 2 full runs); mobile EXIT=0 205 suites/1790 tests, 19 snapshots passed;
  types EXIT=0 655 tests; build EXIT=0 9/9. test:ai-evals not required.
- C10 DONE:
  - MutA RC-write injection into referral-grant.service.ts (97a5c4d3 -> 8091b423): RED, 5 failed/1214 passed,
    incl. the AC6 byte-identical e2e + the static doc guard. Restored -> sha1 97a5c4d3 OK.
  - MutB precedence flip (grant above own) in entitlement.util.ts (5a24435d -> d1dbb46f): RED, 3 failed/1216,
    incl. both precedence tests. Restored -> sha1 5a24435d OK.
  - MutC cap off-by-one `>=`->`>` in referral-grant.util.ts (dde84984 -> 0fde8db5): RED, 4 failed/1215,
    incl. `existingCount=3 -> true` and the AC1b e2e. Restored -> sha1 dde84984 OK.
  - Post-restore full api re-run EXIT=0 120/1219; `git status --porcelain` identical to pre-review inventory.
- VERDICT WRITTEN: pass (F1/F2 MEDIUM non-blocking, F3/F4 LOW, F5-F7 INFO; no HIGH).

## Re-review (fix round for F1-F4)
- R1 F1 RESOLVED: issuance post-commit in its own tx; call-site try/catch logs ids-only and swallows
  (households.service.ts:175-195). Fake P2002 swallow removed; new pin "a P2002 on insert PROPAGATES".
- R2 F2 RESOLVED: pg_advisory_xact_lock for BOTH recipients in sorted order before either cap check
  (referral-grant.service.ts:70-96); tagged-template bind param, no injection.
  (b) idempotency intact: @@unique unchanged + single-use claim => at most one invocation; NOTHING retries.
  (c) hashtext int4 collisions merely over-serialize - correctness preserved.
  (d) cap-skip on one recipient does NOT block the other (loop continues); but an ERROR on the 2nd rolls
      back the 1st (single tx, both-or-neither) - F10.
- R3 F3 RESOLVED: "up to 14 days" in both strings, pinned at family-screen.test.tsx:148.
- R4 F4 RESOLVED: doc §4 guard 5 "FIRST hop only"; §2 retracts the "never lost to concurrency" claim.
- R5 gates: typecheck 0, lint 0, api EXIT=0 120 suites/1223 tests (first run, no flake), mobile EXIT=0
  1790 + 19 snapshots, build EXIT=0 9/9. Matches executor's claimed numbers exactly.
- MutD (mine): removed the 2-line lock loop (sha256 44b7628f -> 7bac4073). Full api suite x2 =>
  RED 2/2 deterministic, 2 failed/1221 each: the F2 concurrency e2e (delta 1209599996 ms ~= 13.999 d,
  i.e. both windows started at now) + the unit lock-order pin. Restored, sha256 44b7628f verified.
- MutE (mine): issueForAcceptedInvite throws unconditionally. RED 14 failed/1209 passed, but ZERO
  "Received: 500" in the whole log - every accept still 200, failures are all "0 grant rows".
  => F1's fix proven end-to-end through the real Nest+Postgres stack. Restored, sha256 verified,
  full api re-run EXIT=0 1223/1223.
- NEW F8 (HIGH, BLOCKING): the fix round's own residual is UNDISCLOSED. Issuance is now best-effort /
  at-most-once: crash between commit and issuance, any swallowed error, Prisma's default 5s tx timeout
  under lock contention, a deadlock, or a 2nd-recipient error => committed join with ZERO grants,
  silently, forever (invite already claimed => no re-trigger; no queue/outbox/reconciliation/retry).
  docs/referral-grants.md presents the post-commit design only as an upside (§1, §4 guard 2).
  AC8 is "— documented" => fails. Remediation = ONE doc paragraph + a §7 [FOUNDER] line; no code change.
- F9 LOW (no e2e pin for "grant failure does not fail the join"); F10/F11/F12 INFO.
- VERDICT: fail (F8 HIGH unresolved). Everything else PASS.

## F8 remediation confirmation (round 3, doc-only)
- Scope verified doc-only: git diff --stat identical to round 2 (19 files, 472+/49-);
  referral-grant.service.ts sha256 still 44b7628f... => no code moved, all prior proofs carry over.
- §1: new best-effort/at-most-once block covers ALL five failure modes (crash window, swallowed errors,
  default 5s tx timeout under lock queueing, deadlock, second-recipient rollback) + no-retry/no-outbox/
  no-reconciliation + usedAt-404 dead-end + no user-visible signal + "deliberate price" framing + §7 xref.
- §7: "Decision needed (issuance durability, F8)" line with accept-for-launch vs fund-an-outbox framing.
- Gate re-run after the edit: pnpm --filter api test EXIT=0, 120 suites/1223 tests,
  PASS src/billing/referral-doc.spec.ts (drift guard holds with the new prose).
- F8 RESOLVED. Nothing missing. AC8 now PASSES; all 11 AC rows PASS.
- FINAL VERDICT: pass.
