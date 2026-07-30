# T105 Checker progress

- [x] 1. git status / inventory integrity — exact 8 paths + ledger; dataset diff EMPTY; no deps/lockfile/journal/loop-state/hook-protected paths
- [x] 2a. Honesty grep — only the "UNVERIFIED" literal reaches verifiedByHuman-shaped fields; 0 bare VERIFIED in doc; §5 = 5/5 UNVERIFIED; §4.3 = 100/100 UNVERIFIED
- [x] 2b. Independent queue recomputation (own script, no qa import) — 5 / 11 / 222, 45 drafts, all counts MATCH
- [x] 3. Doc regeneration byte-stability — sha1 7f32856f... identical before/after my own CLI run; no timestamp/env value in doc
- [x] 4. Top-100 ordering — my own comparator reproduces all 100 ids in the same order (rank1 alcohol, rank100 cigarette-butts); ranks contiguous 1..100; no popularity signal
- [x] 5. Sources fidelity — I read all 6 category headers myself: identical 3-source list, "Merck Veterinary / Manual" wrapped; registry verbatim; normalizer test-side only
- [x] 6a. Mutation M1 (renderer emits VERIFIED for US, doc NOT regenerated) -> doc-spec RED (T9), restore sha1 OK
- [x] 6b. Mutation M1b (renderer emits VERIFIED AND doc regenerated) -> doc-spec RED anyway (T11 honesty guard), restore sha1 OK on both files
- [x] 6c. Mutation M2 (deleted §4.3 row 50 `onion` from the committed doc) -> 2 failed (T9 + T12 row-count), restore sha1 OK
- [x] 6d. Mutation M3 (engine `reviewed: allBreedGuides.length`) -> T9 RED by name, restore sha1 OK
- [x] 6e. Mutation M3b (same engine over-claim + doc regenerated) -> 231/231 GREEN = residual guard gap, logged as F1 (MEDIUM, non-blocking), restore sha1 OK on both files
- [x] 7. Safety copy (CLAUDE.md §7) — no dosage/quantity token anywhere; "diagnosis" only as a meta-reference to the existing dosing/diagnosis language scan; no urgency downgrade; honesty phrases present; [VET] queues framed as review needs
- [x] 8. Gate reproduction — typecheck 16/16, lint 15/15 (+ fresh uncached data typecheck/lint EXIT=0), data 231/231 fresh, ai 631/634 fresh (breed-guides-safety PASS, packages/ai diff empty), full `pnpm test` EXIT=0 across 9 workspaces, build 9/9. `test:ai-evals` not required (no packages/ai change)
- [x] 9. tsup entry does not leak (package `exports` = "." only; `index.ts` has zero qa refs; dist git-ignored); findRepoRoot verified to resolve from packages/data and to throw outside the repo; T1 normalizer is whitespace-only and one-directional (registry ⊆ header) — logged as F2 (LOW)

VERDICT WRITTEN: pass (see loop/reviews/T105.review.md)
