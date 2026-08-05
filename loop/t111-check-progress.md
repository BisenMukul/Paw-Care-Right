# T111 — CHECKER progress ledger

Baseline HEAD: 8491e81 (chore(loop): T111 plan). Working tree = uncommitted T111 diff.
Checker: Fable-tier, read-only on code. Write access limited to loop/reviews/ + this ledger.

## Check queue
- [ ] C0 skeletons written
- [ ] C1 inventory vs plan (+1 authorized repair), no hook-protected/journal/loop-state/lockfile, mobile empty
- [ ] C2 INCIDENT #14: admin-auth.ts allowlist restoration + non-vacuity mutation probe
- [ ] C3 auth topology: matcher, fail-closed, no client-side creds, WWW-Authenticate
- [ ] C4 read-only (the AC): static + runtime + grep
- [ ] C5 privacy: audit columns, user lookup shape, KPI aggregates
- [ ] C6 date-rot repair (futureIso) minimality + audit claim
- [ ] C7 pagination: cursor semantics, limit caps
- [ ] C8 gate reproduction (types, api, web, e2e, root typecheck/lint/build) + >=2 own mutation proofs
- [ ] C9 landmine resolutions (disclaimer carve-out, locale pin, e2e-gate pin)
- [ ] C10 R1 honesty wording, strings externalized, detector lints

## Log
(appended after every check)

### C0/C1 inventory — PASS
34 created + 10 modified + 1 authorized repair (apps/api/test/reminders.e2e-spec.ts). Counts verified per workspace:
types 2c/1m, api 13c+1 migration/2m, web 18c/6m, root .env.example 1m. No lockfile, no loop/journal.md,
no loop/loop-state.json, no CLAUDE.md/LOOP_PROTOCOL.md/docs/PHASES.md. `git status --porcelain apps/mobile` = 0 lines.

### C2 INCIDENT #14 — PASS
admin-auth.ts:86-89 restored check present: `emailAllowed && passwordMatches`, allowlist via
`config.allowedEmails.includes(credentials.email.trim().toLowerCase())`. Password compare is
constant-time (SHA-256 both sides, fixed 32-byte loop) and is AWAITED UNCONDITIONALLY (line 87)
before the && — so a bad email does not short-circuit the password compare (no timing oracle on the password).
Coverage non-vacuous: CHECKER MUTATION PROOF 1 — replaced line 89 with `return passwordMatches ? ...`
=> admin-auth.spec.ts RED, exactly 1 failure ("non-allowlisted email + correct password -> unauthorized").
Restored; sha1 6a1799bbd445cad01f35fd0e5bc55ebb21dc1934 identical pre/post.
Timing verdict on includes(): NOT a finding. Allowlist emails are not secrets, the array is tiny,
and the string-compare delta is orders of magnitude below the two SHA-256 digests + network jitter.

### C3 auth topology — PASS
matcher ["/admin","/admin/:path*"] covers all 3 routes on disk. Fail-closed: parseAdminAuthConfig
returns null on missing/empty/whitespace password, missing allowlist var, or zero parsed entries;
authorizeAdminRequest returns "unauthorized" on null config. 401 carries WWW-Authenticate
Basic realm="admin", charset="UTF-8" (middleware.ts:28-31). No "use client"/NEXT_PUBLIC_/console.
in any admin production file (spec files only). Token never in page props: AdminFetchResult carries
only ok/not-found/unconfigured/error+status-code.
CHECKER MUTATION PROOF 2 — narrowed matcher to ["/admin"] => middleware-wiring.spec.ts RED.
CHECKER MUTATION PROOF 3 — prepended "use client" to app/admin/audit/page.tsx => readonly.spec.ts RED.
Both restored, sha1 -c OK.

### C4 read-only (the AC) — PASS
Controller: exactly 3 `@Get(` (grep -c = 3), zero @Post/@Put/@Patch/@Delete/@All in apps/api/src/admin
(only spec-file assertion strings + planted fixtures match). Zero prisma write verbs / $executeRaw /
$transaction in the module's non-spec sources. Every prisma call enumerated: count/findUnique/findMany/$queryRaw only.
Web: only `<form method="get">`; no "use server", no action={, no revalidate*, no non-GET fetch init.
Reproduced: src/admin/admin-readonly.spec.ts PASS + test/admin-dashboard.e2e-spec.ts PASS in the full api run.

### C5 privacy — PASS
AUDIT_SELECT (admin-audit.service.ts:7-19) = exactly the 11 AiAuditLog columns in schema.prisma:502-524;
no content column exists in that model to leak. adminAuditRowSchema is .strict() so a future content column
fails parsing loudly. User lookup select (admin-users.service.ts:36-45) = ids/codes/flags + membership
householdIds; all 11 counters are count() calls. No pet name, no intake/result text, no photo key, no token.
KPI queries are GROUP BY aggregates + count() only, all with bound `${cutoff}` params (no interpolation).

### C6 date-rot repair — PASS
futureIso(offsetMs) = new Date(Date.now()+offsetMs).toISOString(); 2 call sites (6h, 1d). Self-healing.
Audit claim spot-verified: reminders.service.ts:353-355 is the ONLY future constraint
(`snoozeUntil.getTime() <= Date.now()` -> BadRequest); `dueAt` goes through assertOccurrence (schedule match,
not a clock check), so leaving the dueAt literals untouched is correct and minimal.

### C7 pagination — PASS
limit @Min(1) @Max(100) default 50; days @Min(1) @Max(90) default 30; cursor @IsUUID.
take: limit+1 sentinel, orderBy [createdAt desc, id desc], cursor {id} + skip 1 — stable on the append-only
table. nextCursor = last id of the trimmed page (correct keyset hand-off). Unknown cursor: indexed findUnique
pre-check -> BadRequest, with the PrismaClientKnownRequestError catch retained as a second layer. The deviation
is sound: it converts a silent empty page into a 400, which is strictly safer than the planned behaviour.

### C9 landmines — PASS
disclaimer-placement: ADMIN_ROUTES is an explicit 3-path Set (never a glob), pinned by
`ADMIN_ROUTES.size === 3`; non-admin rule intact and asserted at >= 5 files; the exact route->view map
still cannot silently grow (now 8 entries); NEW compensating assertion that no admin page/view references
TriageResult|resultJson|intakeJson|urgency|symptom|VetDisclaimer, with positive controls.
locale-registry: "admin." added to SAFETY_PINNED_PREFIXES. e2e-gate: pin bumped 2 -> 3 with a T111 comment.
robots.ts: disallow "/admin" added, allow "/" kept. Migration = 5 CREATE INDEX statements, nothing else.

### C10 R1 honesty + strings — PASS
packages/types/src/admin.ts:8-16 and admin-kpis.service.ts:31-34 both state RC persists no amount/currency/type.
User-facing wording (strings.ts admin.kpis.mrrEventsNote): "RevenueCat webhook event counts, not revenue --
no amount or currency is stored." Installs-proxy caveat also present. No health/AI/dosing/diagnosis vocabulary
in the admin section; counter labels are "Checks (total)"/"Checks (fallback)".
.env.example: empty values only, no high-entropy placeholder.

### C8 gates (in progress)
- pnpm --filter @bombaypetcompany/types test: 29 suites / 681 tests PASS
- pnpm --filter api test (FULL suite, once): 125 suites / 1274 tests PASS, exit 0 (matches claim)
- pnpm typecheck: 16/16 tasks successful
- pnpm lint: 15/15 tasks successful, 0 errors (1 pre-existing warning on the generated
  apps/api/coverage/lcov-report artifact, not from this diff)
- pnpm --filter @bombaypetcompany/web build: PASS (admin routes all `f` Dynamic; `f Middleware` emitted)
- client-bundle leak scan of apps/web/.next/static for ADMIN_* / x-admin-token: NO MATCH
- pnpm --filter @bombaypetcompany/web test: 26 suites / 338 tests PASS
- pnpm --filter @bombaypetcompany/web test:e2e: 3/3 PASS (incl. the new /admin -> 401 + WWW-Authenticate)
- pnpm build: 9/9 tasks successful
C8 — PASS. Every executor gate claim reproduced exactly.

### Forbidden-pattern / secret sweep — PASS
Across all T111 files: zero `any` types, zero @ts-ignore, zero console.log, zero TODO, zero secrets.
(Only "any" hits are the English word in two prose comments.) .env.example adds empty values only.

### VERDICT
loop/reviews/T111.review.md written. FINAL VERDICT: pass. No HIGH or MEDIUM findings;
3 LOW/informational items with adequate compensating coverage.
Working tree left byte-identical to the state received (all 3 mutation probes restored + sha1-verified).
