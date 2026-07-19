# CHECKER review — SEEDER-1 (realistic demo seed)

Scope reviewed: `apps/api/prisma/seed.ts` (modified) + `apps/api/prisma/seed/**` (new) + `apps/api/test/seed/**` (new), against `loop/plans/SEEDER-1.plan.md` and CLAUDE §6/§7/§8. Infra: local postgres/redis/minio all up and healthy.

## Verdict summary

**FAIL — the canonical seed runtime crashes.** The demo data model itself is well-built and §7-clean, but the one command the task exists to make work — `pnpm --filter api prisma:seed` (= `prisma db seed` = `tsx prisma/seed.ts`) — throws and writes **nothing**. The green test suite is a **false green**: jest resolves `@pawcareright/data` to source while the real tsx runtime resolves it to a `.d.ts` and gets an empty module.

---

## 1. BLOCKING DEFECT — canonical seed command fails (P0)

Independently reproduced (env `DATABASE_URL=postgresql://pawcareright:pawcareright@localhost:5432/pawcareright?schema=public`):

```
$ pnpm --filter api prisma:seed        → exit 1
$ (cd apps/api && npx tsx prisma/seed.ts)  → exit 1
TypeError: (0 , import_data.resolveCareTemplateForPet) is not a function
    at buildCarePlan (apps/api/prisma/seed/builders/reminders.ts:107:20)
    at buildDemo (apps/api/prisma/seed/persist.ts:89:8)
    at runSeed (apps/api/prisma/seed.ts:25:29)
```

The crash happens inside `buildDemo`, **before any DB write** — so the seed populates nothing (not even a partial graph).

### Root cause (fully isolated)
- The seed's runtime is `tsx prisma/seed.ts`, executed with cwd `apps/api`, so it honors `apps/api/tsconfig.json`. That committed, pre-existing `paths` block maps workspace packages to their **declaration files**:
  - `apps/api/tsconfig.json:14` → `"@pawcareright/data": ["../data/dist/index.d.ts"]`
  - `apps/api/tsconfig.json:13` → `"@pawcareright/types": ["../types/dist/index.d.ts"]`
- tsx respects tsconfig `paths`, so at runtime `import { resolveCareTemplateForPet } from "@pawcareright/data"` resolves to `packages/data/dist/index.d.ts`. Loading a `.d.ts` as a runtime module yields only re-exports that carry a real module specifier:
  - `packages/data/dist/index.d.ts:3` → `export { reminderTypeSchema, speciesSchema } from '@pawcareright/types';` (survives → the 2 stray runtime keys)
  - `packages/data/dist/index.d.ts:327` → `export { … resolveCareTemplateForPet … };` — a bare re-export of locally `declare`d bindings with **no runtime value** → `undefined`.
- Evidence of the split (same package, two loaders):
  - `import('@pawcareright/data')` via node ESM → **53 keys**, `resolveCareTemplateForPet` is `function`.
  - `tsx` (paths→`.d.ts`) → **2 keys** (`reminderTypeSchema`, `speciesSchema`), `resolveCareTemplateForPet` `undefined`.
- Rebuilding `@pawcareright/data`/`types` does **not** fix it (verified) — it is not a stale-dist problem; it is the paths→`.d.ts` remap. This is deterministic and reproducible, not environmental.

### Why the tests don't catch it (false green)
`apps/api/package.json` jest `moduleNameMapper` (line 99): `"^@pawcareright/data$": "<rootDir>/../../packages/data/src/index.ts"` — jest maps the data package to **source** (full 53 exports), so `demo-seed.e2e-spec.ts` (which runs `buildDemo`+`persistDemo`) passes while the actual `tsx` seed path is broken. The e2e "DB smoke + idempotency" therefore **certifies a runtime path that does not work**. The prior dev seed never hit this because it imported only `@prisma/client`.

### Consequences (each independently FAIL-grade)
- CLAUDE §5: `pnpm --filter api prisma:seed` is a listed command that must always work; "fixing it is an implicit P0 acceptance criterion." It is broken.
- Plan Checkpoint B: "`pnpm --filter api prisma:seed` succeeds; twice in a row with identical resulting counts." Cannot succeed even once.
- README (`apps/api/prisma/seed/README.md:15`) documents this exact command as the run instruction — non-functional.
- The task's whole purpose (a runnable on-device demo seed) is unmet via its wired entrypoint.

### Bounded fix for fix-forward
The seed must resolve workspace packages to runtime code, not `.d.ts`. Options (all touch a file outside the declared SEEDER-1 list, so flag to planner):
- Point `prisma.seed` at a dedicated tsconfig without the dist-`.d.ts` `paths` (e.g. `"seed": "tsx --tsconfig prisma/seed/tsconfig.json prisma/seed.ts"` + a small `prisma/seed/tsconfig.json` that omits/rewrites the two paths to `dist/index.js`), letting node/tsx use the packages' `exports` field; **or**
- Remap those two `paths` to `dist/index.js` (runtime) for the seed context only.
Do NOT globally rewrite `apps/api/tsconfig.json` paths (affects the whole api build; out of scope).

---

## 2. §7 CONTENT AUDIT — PASS

Read every seeded string in `content.ts` (triage summaries/causes/homeCare/doNot/redFlags/vetQuestions, NOTE/MEAL/ACTIVITY/VET_VISIT text, med name/dose, reminder titles):
- No `diagnos*` language anywhere; triage uses "possible causes" framing and re-parses via `parseTriage` (mechanical §7 gate) — verified against DB too.
- EMERGENCY_NOW and VET_24H triage results have `homeCare: []` (`content.ts:99`, `content.ts:111`).
- Medication copy is record-only, non-suggestive: `MEDICATION_NAME_AS_ENTERED = "Ear drops (prescribed at Riverside Vet Clinic)"`, `MEDICATION_DOSE_AS_ENTERED = "As directed by your veterinarian"` — no drug recommendation, **no digit** in the dose (verified in DB: `As directed by your veterinarian`). §7-legal record, not advice.
- No cruelty/unsafe/DIY-harm content.

### Mutation-proof (executed)
Planted `buddyPlayful: "diagnosis: parvovirus — give 5mg twice daily."` into `content.ts` → ran `demo-builders.spec.ts`:
```
✕ no seeded free text contains diagnosis/diagnose language (CLAUDE §7 rule 1)
Tests: 1 failed, 22 passed
```
The content scan is **non-vacuous** — it caught the violation via the note text flowing through `buildDemo().healthLogs`. Restored from backup; **sha1 verified identical** (`581e28c7c52ad315efed5ee25d9f4015d4f4a93e`); re-ran clean → **23/23 pass**.

---

## 3. IDEMPOTENCY + WIPE SAFETY — PASS (design), UNVERIFIABLE via canonical command

`wipeDemo` (`persist.ts:112`) deletes strictly by collision-proof keys in FK-safe order:
- `Subscription` by `rcAppUserId ∈ {OWNER,FAMILY}` fixed ids → `Household DEMO_HOUSEHOLD_ID` (fixed UUID; cascades pets→checks/triage/followups/reminders/events/health-logs + memberships) → `Household FAMILY_EMPTY_HOUSEHOLD_ID` (fixed UUID) → `User` by the two demo emails (cascades devices). Order respects `Household.owner onDelete:Restrict` and `SymptomCheck.createdBy onDelete:Restrict` (checks cascade via Pet before the user delete) — schema confirmed (`schema.prisma:81,211`).
- Adversarial scenario (real household with same name/email): households are keyed on **fixed UUIDs**, never on name, so a real "The Demo Household" is untouched. The only email-keyed deletion targets `*.local` demo emails; if a real user held that email and owned other households, the delete would be Restrict-blocked (throw), never silent corruption. Collision-proof.
- Idempotency uses wipe-and-recreate with fixed ids (plan R3) — correct given child rows have no natural keys.

Because the canonical seed crashes, I could not run the **canonical** double-run. The jest e2e (`demo-seed.e2e-spec.ts`, source-mapped path) asserts identical counts across two `runSeed`s and dev-fixture-untouched, and passes (3/3). It is non-vacuous (asserts `pets===3`, `checks>0`). This proves the wipe/persist *logic* is idempotent; it does **not** substitute for the broken runtime.

---

## 4. DETERMINISM — PASS

Builders are pure, `now`-injected. Grep for `Math.random` / `Date.now()` / bare `new Date()` inside `prisma/seed/**` builders: **none** (the single `new Date()` is the injection point in `seed.ts:25`'s `runSeed`; `clock.ts` is pure UTC math). `demo-builders.spec.ts` pins `NOW` and asserts concrete shapes — non-vacuous.

---

## 5. ACCEPTANCE (verified at DB level via the source-mapped seed path; data model is correct)

Count table (DB after `runSeed`, demo-scoped):

| entity | count |
|---|---|
| demo users (owner+family) | 2 |
| demo households (D + empty) | 2 |
| memberships in D | 2 |
| pets | 3 |
| health logs | 31 |
| reminders | 19 |
| reminder events | 33 |
| checks | 6 |
| triage results | 6 |
| check follow-ups | 2 |
| subscriptions | 1 |
| `dev@pawcareright.local` intact | 1 |

Detail queries:
- Urgency tiers present: `EMERGENCY_NOW, MONITOR, REASSURE, VET_24H, VET_SOON` (all 5) + exactly 1 `FALLBACK` status + exactly 1 red-flag (`redFlagPayloadKey='gdv-suspected'`, ∈ pinned emergency payloads, `ruleId===payloadKey`).
- Care Score readiness: 4 PENDING events due **today**, 10 DONE events completed in the trailing 7 days.
- Buddy (rich): 5 ACTIVITY logs **today**, 9 weight points spanning ~60d. Luna (sparse): 0 DONE events, 2 logs total. Divergent density confirmed.
- Vaccine history: 3 VACCINE reminders each with a past DONE event.
- R1 workaround: `family@pawcareright.local` owns `FAMILY_EMPTY_HOUSEHOLD_ID` with **0 memberships**; both demo users have exactly 1 membership in D (satisfies `provisionOrGetUser` ownership lookup + the single-membership scope guard) — asserted by AC1 e2e.
- Premium: 1 `Subscription` on D, `entitlement=PREMIUM`, `plan=FAMILY_PLAN_PRODUCT_ID`, `status=active`, future `expiresAt`.

The data model fully satisfies AC1–AC7. It simply cannot be loaded via the shipped command.

---

## 6. SCOPE FREEZE — PASS

`git status`: only `apps/api/prisma/seed.ts` modified; `apps/api/prisma/seed/` and `apps/api/test/seed/` untracked. **Zero** migrations, **zero** schema changes, **zero** `apps/api/src/**` service/controller/DTO diffs, no tsconfig/config diff. Confirmed no forbidden patterns (`any`/`@ts-ignore`/`console.log`/secrets/bare TODO) in the diff.

---

## 7. GATES (independently re-run)

- `pnpm typecheck` → 16/16 green (cached). Note: does not cover `prisma/seed/**` (R6).
- `pnpm lint` → 15/15 green (cached).
- `pnpm --filter @pawcareright/api test` → **83 suites / 892 tests PASS** (full parallel, real pg/redis/minio). This green **masks** the runtime defect (§1).
- Seed specs directly: `demo-builders.spec.ts` 23/23, `demo-seed.e2e-spec.ts` 3/3.
- `pnpm --filter api prisma:seed` → **FAIL (exit 1)** — the gate that matters.

---

## 8. Dev sign-in instructions the seed *would* enable (from README + auth code)

- Owner: `owner@pawcareright.local`; Family member: `family@pawcareright.local`. No password — OTP.
- Flow: mobile enters email → `POST /auth/otp/request` → read `OTP for <email>: <code>` from the API console (`DevLogOtpTransport`, non-prod) → enter code → `POST /auth/otp/verify`. Both land on "The Demo Household". `family@…` also silently owns an empty household so verify doesn't 500.
- **Caveat:** these instructions presuppose the seed ran. It does not (via the documented command), so no demo user exists to sign in as until §1 is fixed.

---

## FAIL reasons (recap)
1. `pnpm --filter api prisma:seed` (canonical seed runtime) crashes with `resolveCareTemplateForPet is not a function` and writes nothing — CLAUDE §5 implicit-P0 + plan Checkpoint B failure. Root cause: tsconfig `paths` remap `@pawcareright/data`/`types` to `.d.ts`, which tsx honors, yielding an empty runtime module.
2. The DB e2e-spec is a false green: jest `moduleNameMapper` resolves the data package to source, so the tests certify a runtime path that is actually broken.

(Everything else — §7 content, wipe safety, determinism, data-model acceptance, scope freeze, standard gates — passes. Fix is bounded to the seed's package-resolution/invocation.)

VERDICT: FAIL
- Canonical `pnpm --filter api prisma:seed` throws and seeds nothing (tsconfig paths→`.d.ts` under tsx); implicit-P0 broken command + plan Checkpoint B unmet.
- Test suite green is a false green (jest source-maps `@pawcareright/data`, hiding the runtime break); idempotency/DB smoke cannot be trusted as proof of the shipped command.
