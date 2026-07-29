# T099 checker progress

1. Read CLAUDE.md, loop/plans/T099.plan.md, loop/t099-exec-progress.md.
2. `git status` + `git diff --stat` — 4 modified, 3 new (+1 loop progress file); no manifest/lockfile/hook-path change.
3. Read full diff of eas.json, app.config.js, .env.example, .gitignore + both new specs + docs/release-runbook.md.
4. Gates: `pnpm typecheck` EXIT=0 (16/16), `pnpm lint` EXIT=0 (15/15).
5. `pnpm --filter @bombaypetcompany/mobile test` EXIT=0 — 175 suites / 1436 tests.
6. Mutation A (delete eas.json preview.channel) → 3 RED, restored, sha1 verified.
7. Mutation B (version→0.0.0, add ios.buildNumber, drop EAS_BUILD_GIT_COMMIT_HASH) → 3 RED, restored, sha1 verified.
8. Mutation C (delete ios submit cmd, remove OTA_UPDATES.md ref) → 2 RED, restored, sha1 verified.
9. Mutation D (delete runbook §8) → 1 RED; E (plant AKIA-shaped value in eas.json env) → 1 RED; F (drop EXPO_PUBLIC_TERMS_URL from .env.example) → 1 RED. All restored, sha1 verified.
10. Mutation G (delete all §3 profile table rows) → GREEN (weak guard, LOW-4).
11. `pnpm test` EXIT=0 (16/16); api forced uncached via turbo → 108 suites / 1103 tests green.
12. `pnpm build` EXIT=0 (9/9).
13. `node scripts/scan-secrets.js --tracked` EXIT=0; no signing artifacts tracked; .gitignore patterns verified via `git check-ignore`; `.env` present on disk, ignored, absent from status.
14. Reproduced the runbook §8 eas-cli attempt — output matches verbatim, direct exit=1, tree unmutated.
15. Independently validated eas.json against the real `@expo/eas-json` schema (all 3 profiles x 2 platforms + submit + cli) — clean.
16. Wrote loop/reviews/T099.review.md.
