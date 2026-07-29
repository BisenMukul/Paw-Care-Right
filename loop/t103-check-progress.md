# T103 Checker Progress Ledger

Baseline HEAD: ecfe4f8
Branch: claude/pull-main-next-task-oaad26

| # | Step | Status |
|---|------|--------|
| 0 | Skeletons written | DONE |
| 1 | Read contract docs (CLAUDE.md, plan, exec ledger) | DONE |
| 2 | git status vs plan §3 — exact match, 11 create + 5 modify | DONE |
| 3 | Event-name integrity + cast-escape hunt | DONE |
| 4 | R1 build layout (forced uncached api build) | DONE |
| 5 | CLI evidence reproduction (4 commands) | DONE |
| 6 | Checker mutation proofs MP-A..MP-D | DONE |
| 7 | Payload sanity (R2) | DONE |
| 8 | Doc review (§7 safety, founder steps, env parity) | DONE |
| 9 | Gate reproduction (typecheck/lint/test/build + api suite) | DONE |
| 10 | Final verdict written | DONE |

## Incident log

**live-mutation #13 (remediated by orchestrator).** I stalled mid-MP-B with the
mutation LIVE: `apps/api/tsconfig.build.json` had lost the `"scripts"` exclude
entry, which made the file byte-identical to HEAD and therefore invisible in
`git status`. The orchestrator restored it. I verified the restoration against
my own pre-mutation backup: `sha1sum -c /tmp/mpB.sha1` → OK, `diff /tmp/mpB.bak
apps/api/tsconfig.build.json` → empty. The restored file is byte-for-byte the
executor's version. `observability-scripts.spec.ts` 7/7 green afterwards, and
`apps/api/dist/main.js` rebuilds to the correct location.

**Standing rule restated:** a mutation proof is ONE atomic Bash invocation that
includes apply + observe + restore + sha1-verify. Never split across tool calls.
MP-C and MP-D below were run under a shell `trap restore EXIT` so the restore
fires even on timeout or non-zero exit.

## Mutation proof outcomes

| ID | File | Mutation | Result |
|---|---|---|---|
| MP-A | posthog-insights.ts | `"app_open" as AnalyticsEventName` in funnel step | tsc GREEN, lint GREEN, **tests RED (3 failures)** — guard holds |
| MP-B | tsconfig.build.json | drop `"scripts"` from exclude | **spec RED**; forced build emits `dist/src/main.js` — guard non-vacuous |
| MP-C | provision-sentry-alerts.ts | drop `SENTRY_ENVIRONMENT` required check | **all GREEN — nothing catches it** (finding F4) |
| MP-D | provision-posthog-dashboards.ts | read undocumented `POSTHOG_HOST` as key fallback | **all GREEN — nothing catches it** (finding F3) |

All four restores sha1-verified OK.
