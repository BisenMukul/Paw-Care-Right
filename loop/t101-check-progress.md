# T101 checker progress log

1. Read `CLAUDE.md`, `loop/plans/T101.plan.md` (§0–§11, D1–D6), task card.
2. `git status --porcelain` + `git diff --stat HEAD` — 2 modified, 4 untracked; matches plan §1 inventory exactly.
3. Confirmed untouched: `apps/mobile/eas.json`, `.gitignore`, `pnpm-lock.yaml`, root `package.json`, `apps/mobile/app.config.js` (empty `git diff --stat HEAD --` for all).
4. Confirmed zero hook-protected paths in the diff (`CLAUDE.md`, `LOOP_PROTOCOL.md`, `docs/{PHASES,MODEL_STRATEGY,AI_PROVIDERS,OTA_UPDATES}.md`, `.claude/**`).
5. Read `loop/checkpoint-C3-notes.md` (211 lines), `apps/mobile/scripts/internal-distribution.sh` (139 lines), `apps/mobile/__tests__/checkpoint-c3-notes-doc.test.ts` (215 lines) in full.
6. Read `git diff` of `apps/mobile/package.json` (+1 line) and `docs/release-runbook.md` (+22 lines: §9 items 10–12, new §11).
7. Export-artifact hygiene: `apps/mobile/.perf/` is empty; `git check-ignore -v` → `.gitignore:15:apps/mobile/.perf/`; `git status --ignored` shows no export dirs. No artifacts committed.
8. Gate: `pnpm typecheck` → EXIT=0, 16/16 tasks.
9. Gate: `pnpm lint` → EXIT=0, 15/15 tasks, 0 errors (2 pre-existing warnings in `packages/ai`, untouched workspace).
10. Script audit: `sh -n scripts/internal-distribution.sh` → exit=0; bashism grep (`[[`, `]]`, `==`, `local`, `source`, `<<<`, `declare`, `echo -e`, arrays) → no matches.
11. Script `--dry-run` reproduced: exit=0, output byte-matches notes §7 block; fully offline (dry-run returns before any preflight).
12. `pnpm --filter mobile dist:internal --dry-run` (the runbook §11 documented form) reproduced: exit=0, arg passes through pnpm correctly.
13. Refusal paths reproduced: `--platform windows` → exit=1 with reason; `--bogus` → exit=1 with usage; both single-line, both name the notes section or usage.
14. Preflight-ordering non-vacuity reproduced myself: `EXPO_TOKEN=fake-token-not-real sh scripts/internal-distribution.sh` → advanced past credentials to `git tree is dirty` refusal, exit=1, no network. Ordering 1→2→3 is real.
15. Evidence re-run: `npx --yes eas-cli@latest submit --profile preview --platform android --non-interactive` → exit=1, output byte-identical to notes §7 verbatim block.
16. Evidence re-run: `npx --yes eas-cli@latest whoami` → `Not logged in`, exit=1 — matches the notes' claim.
17. Tag counts by my own grep: 38 `- [ ] ` lines, 34 `**[FOUNDER]**`, 4 `**[AUTOMATED-READY]**`, 0 untagged, 0 double-tagged. Matches claim exactly.
18. Safety scan (§7) across notes + runbook diff + script for `diagnos|dosage|dose|mg|prescri|cure|treat your|vet-approved|clinically|guaranteed` → no matches.
19. Disclaimer provenance: `packages/types/src/vet-disclaimer-copy.ts` → `apps/mobile/src/strings.ts:476` → notes:95 byte-identical; test asserts via the live function, not a hardcoded copy.
20. `eas.json` read and cross-checked against notes §3 claims — all seven claims accurate; D3 confirmed (no `ascAppId`/`appleTeamId`/`serviceAccountKeyPath`); `submit.production.android.track` is still `internal`, matching notes §9.
21. Gate: full `pnpm --filter @bombaypetcompany/mobile test` → EXIT=0, 182 suites / 1485 tests / 19 snapshots.
22. Baseline single-file run of the new spec → 9/9 pass.
23. Mutation M1 (delete one `**[AUTOMATED-READY]**` tag) → 2 failed / 7 passed. RED. Restored.
24. Mutation M2 (append untagged `- [ ] ` line) → 1 failed. RED. Restored.
25. Mutation M3 (plant "diagnosis" in beta-notes block) → 1 failed. RED. Restored.
26. Mutation M4 (plant "5 mg dosage" in beta-notes block) → 1 failed. RED. Restored.
27. Mutation M5 (break disclaimer byte-equality: "veterinarian."→"vet.") → 1 failed. RED. Restored.
28. Mutation M6 (add `[[` bashism to script) → 1 failed. RED. Restored.
29. Mutation M7 (plant `serviceAccountKeyPath: abc123def456` in script) → 1 failed. RED. Restored.
30. Restore integrity: `sha1sum -c` OK for both notes and script; script exec bit `-rwxr-xr-x` preserved.
31. Gate: full `pnpm test` → EXIT=0, 16/16 tasks (mobile 182, api 108, web 16, ai 42/44 w/ 2 skipped, types 25, data 8, analytics 6, api-client 8).
32. Gate: `pnpm build` → EXIT=0, 9/9 tasks. `pnpm test:ai-evals` not required (`packages/ai` untouched).
33. `git status --porcelain` re-checked after all gates and all mutations — unchanged, identical to step 2.
34. Process-violation weighing: executor's contemporaneous scratchpad logs (`t101-export-{android,ios}.log`, `t101-artifact-inventory.log`, `t101-submit-{android,ios}.log`, `t101-whoami.log`, `t101-script-{dryrun,realrun,dirty-check}.log`) SURVIVE with 17:31–17:36 timestamps.
35. Corroborated notes §7 byte sizes against `t101-artifact-inventory.log`: android `.hbc` 9,278,557 ✓, `metadata.json` 4,370 ✓, 16M ✓; ios `.hbc` 9,093,009 ✓, `metadata.json` 4,110 ✓, 15M ✓. Both exports exit=0.
36. Discrepancy found: notes §7 says android `assets/` has "65 hashed files"; the inventory log shows 67 unique files. iOS "63" is correct. LOW finding.
37. `.gitignore` attribution in notes §7 names `apps/mobile/.gitignore` `.perf/`; the real ignore is root `.gitignore:15` `apps/mobile/.perf/`. LOW finding.
38. Forbidden-pattern scan of the three new files: no `console.log`, no `any`, no unjustified `@ts-ignore`, no untracked TODO. The two `require` uses carry `// JUSTIFIED:` eslint-disable comments per house idiom.
39. Checklist completeness review of §§4/5/8 against the Apple + Play internal-track step universe — substantially complete; one asymmetry noted (Apple-side IAP/Paid-Apps prerequisites absent while the Play-side license-tester equivalent is present). LOW.
40. Loop bookkeeping check: `loop/loop-state.json` still `T101: pending / attempts 0`; `loop/journal.md` has no T101 completion entry. Advisory (post-review step).
41. Wrote `loop/reviews/T101.review.md`.
