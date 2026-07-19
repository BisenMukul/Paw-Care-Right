# Plan — SEEDER-1: Realistic demo seed for end-to-end on-device flow testing

## Objective (from card)
Replace the trivial dev seed with a deterministic, idempotent, §7-clean DEMO seed that exercises every product surface (2 users, 3 pets with divergent data density, 60-day health timelines, care plans + reminders with due-today/upcoming/completed occurrences, a medication reminder, vaccine history, checks across every urgency tier + FALLBACK + red-flag EMERGENCY, and a premium family Subscription) so every screen renders real content and full flows are testable on device. Zero schema/migration changes, zero API service changes.

---

## Ground truth discovered (executor: rely on these, do not re-derive)

- **Seed wiring:** `apps/api/package.json` → `"prisma": { "seed": "tsx prisma/seed.ts" }`; run via `pnpm --filter api prisma:seed` (= `prisma db seed`). Existing `apps/api/prisma/seed.ts` upserts one dev user `dev@pawcareright.local` + `Dev Household` (fixed UUIDs). **Preserve that block verbatim** (non-demo fixture) and add the demo on top.
- **Auth / household invariant (CRITICAL — drives the user model below):**
  - OTP dev sign-in: `POST /auth/otp/request` → `DevLogOtpTransport` logs `OTP for <email>: <code>` when `NODE_ENV !== production` (`apps/api/src/auth/otp-transport.ts`). `POST /auth/otp/verify` → `AuthService.provisionOrGetUser` matches by **email**; for an existing user it looks up a household they **OWN** (`household.findFirst({ ownerId })`) and **throws 500 if they own none**.
  - Every data screen (`/pets`, reminders, checks, health-logs, `/households/me`) is scoped by `@HouseholdFromMembership()` (`apps/api/src/common/household-scope.decorators.ts` + `pets.controller.ts`), which resolves the caller's **single** `Membership` and **404s unless the membership count is exactly 1**. The login-token `householdId` is NOT used for data scoping (mobile re-scopes via membership).
  - ⇒ For sign-in to work AND both users to see the same demo household, each user needs **exactly one Membership** in the demo household, and each user must **own at least one household** (else verifyOtp 500s). See user model + Risk R1.
- **Health-log value shapes** (`packages/types/src/health-log.ts`, validated by `parseHealthLogValue`): `WEIGHT {weightGrams:int>0}`, `MEAL {note, portionGrams?}`, `NOTE {text}`, `VET_VISIT {reason, clinicName?, notes?, costMicroUsd?}` (**no med/dose field**), `ACTIVITY {activityType, quantity?, unit?, note?}` with `unit` constrained by `ACTIVITY_UNITS_BY_TYPE`. `MED_GIVEN` and `CHECK_REF` are **read-time projections** (T061/T064) — **do NOT seed HealthLog rows of those kinds** (would double-count; med history comes from reminder events, check history from `SymptomCheck`).
- **Triage shape** (`packages/types/src/triage.ts`, `triageResultSchema`/`parseTriage`): mechanically rejects `/diagnos/i` in every user-facing string; `homeCare` MUST be `[]` for `EMERGENCY_NOW`/`VET_24H`; a `low`-confidence result must be at least `VET_SOON`. `SAFE_FALLBACK` (VET_SOON/low) is the FALLBACK payload.
- **Check persistence** (`checks.service.ts` / `check-runner.processor.ts`): `SymptomCheck{petId, createdById, status, category, intakeJson(valid CompletedIntake), photoKeys[], redFlagHit, redFlagRuleId, redFlagPayloadKey, costMicroUsd, failureReason, createdAt/startedAt/completedAt}` + `TriageResult{checkId, urgency, confidence, resultJson, modelId, promptVersion}` (urgency/confidence columns mirror `resultJson`). Red-flag `ruleId`==`emergencyPayloadKey` for the 22 rows (`packages/ai/src/rules/rules-table.ts` + `packages/data/src/emergency/data.ts`), e.g. `"gdv-suspected"`.
- **Intake shape** (`packages/types/src/intake.ts`, `parseIntake`/`INTAKE_CATEGORIES`): each seeded check needs a valid `CompletedIntake` (required questions answered, option values/units from `INTAKE_CATEGORIES`).
- **Care plan** (`packages/data` → `resolveCareTemplateForPet({species, ageMonths, countryCode})`): returns items `{id, category, title, note (contains VET_CONFIRM_SENTENCE), rrule, reminderType, anchor, startOffsetDays}`. Notes are pre-audited §7-clean by `noteWithVetConfirmSchema`.
- **RRULE** (`packages/types/src/rrule.ts`): validate with `isValidRRule`; supported: `FREQ/INTERVAL/BYDAY/BYMONTHDAY/COUNT/UNTIL`.
- **Reminder/event shapes:** `Reminder{petId, type(ReminderType string), title, rrule, timezone(IANA), startAt, nextFireAt, medNameAsEntered?, medDoseAsEntered?, courseId?, active, templateKey?}`; `ReminderEvent{reminderId, dueAt, status(PENDING|SENT|DONE|SNOOZED|MISSED), sentAt?, completedAt?, snoozedUntil?}`; unique `(reminderId, dueAt)`.
- **Subscription** (mirror, `Subscription{rcAppUserId(=User.id), householdId, entitlement(FREE|PREMIUM), plan?, status, expiresAt?, lastEventAt?, rawEventJson(required Json)}`). Family plan id = `FAMILY_PLAN_PRODUCT_ID` (`packages/types/src/entitlement.ts` = `"pawcareright_family_annual"`). Executor: read `apps/api/src/billing/*.service.ts` to confirm which `status`/`expiresAt` values make `getEntitlement` return `entitled:true` (expected `status:"active"`, future `expiresAt`, `plan:FAMILY_PLAN_PRODUCT_ID`).
- **Prisma delete rules:** `Household.ownerId onDelete: Restrict` (delete the Household before its owner User); `SymptomCheck.createdBy onDelete: Restrict` (checks must be gone before deleting the user — they cascade when the Household→Pet is deleted). Overriding `@default(now())`/`createdAt` on `create` IS allowed → set explicit historical timestamps.
- **tsconfig:** `apps/api/tsconfig.json` include is `["src","test"]` — `prisma/**` is NOT in `pnpm typecheck`. New builder modules under `prisma/seed/**` are type-checked transitively by ts-jest when the `test/**` specs import them. **Do not modify tsconfig** (matches existing `prisma/seed.ts`).
- **`console.log` is forbidden** (§8 / gate_exec grep). The seed prints nothing; demo credentials + sign-in steps live in the committed README.

---

## User / household model for the demo (satisfies both invariants above)

- **Owner `O`** — email `owner@pawcareright.local`. Owns demo household **`D`** (`ownerId=O`). Exactly one membership: `OWNER` in `D`. (Fully consistent, real state.)
- **Family `F`** — email `family@pawcareright.local`. Exactly one membership: `MEMBER` in `D` (so all scoped screens show `D`). Also owns a throwaway empty household **`H_f`** (`ownerId=F`, **zero memberships**) — solely so `provisionOrGetUser` finds an owned household and login does not 500. `H_f` surfaces on no screen. (See Risk R1.)
- Fixed UUIDs for `O`, `F`, `D`, `H_f`, all pets, and the demo membership rows (namespace `00000000-0000-4000-8000-0000000001xx`) so wipe-by-id is exact.
- One `Device` per demo user (unique `expoPushToken` e.g. `ExponentPushToken[demo-owner]`) for the devices/notifications surface.

## Pets (in `D`) — divergent data personalities

| Pet | Species | breedSlug (must exist in `packages/data` breeds JSON) | Age anchor | Personality |
|---|---|---|---|---|
| **Buddy** | DOG | a real medium/large dog slug (executor picks from `dogs.json`) | ~4y (ADULT) | **Rich** — full 60-day timeline, full care plan w/ completed history, med + vaccine history, all check tiers |
| **Cleo** | CAT | a real slug from `cats.json` | ~6y (ADULT/SENIOR) | **Moderate** — partial timeline, care plan instantiated, a couple checks |
| **Luna** | CAT | a real slug from `cats.json` | ~4mo (PUPPY_KITTEN) | **Sparse/new** — 1 weight, minimal activity, care plan with NO completed occurrences, no checks |

Rich-vs-sparse density is what makes any future FIDELITY-1 Care Score vary (see Risk R4). breedSlug validity is enforced by a builder test, not hardcoded here.

---

## Files to create/modify (exhaustive — executor may touch NOTHING else)

1. `apps/api/prisma/seed.ts` — **MODIFY**. Keep the existing dev-fixture upsert block verbatim. Add: `export async function runSeed(prisma: PrismaClient): Promise<void>` that calls `wipeDemo(prisma)` then `persistDemo(prisma, buildDemo(new Date()))`; have `main()` call `runSeed`. No `console.log`.
2. `apps/api/prisma/seed/constants.ts` — **CREATE**. Fixed UUIDs, demo emails, household/pet/membership ids, `DEMO_TIMEZONE`, `DEMO_COUNTRY`, push-token strings, subscription ids.
3. `apps/api/prisma/seed/clock.ts` — **CREATE**. Pure, `now`-injected date helpers: `startOfUtcDay(now)`, `daysAgo(now,n)`, `daysFromNow(now,n)`, `todayAtHourUtc(now,h)`. No `Math.random`, no `Intl`.
4. `apps/api/prisma/seed/content.ts` — **CREATE**. The single audited home for all §7-sensitive free text: triage `resultJson` objects per tier, NOTE texts, VET_VISIT reasons/notes, MEAL notes, ACTIVITY notes, and the medication reminder's `medNameAsEntered`/`medDoseAsEntered`. Exported so the content-scan test imports the exact strings.
5. `apps/api/prisma/seed/builders/pets.ts` — **CREATE**. `buildDemoPets(now)` → plain pet rows (fixed ids, birthDate anchors, weightGrams, breedSlug).
6. `apps/api/prisma/seed/builders/health-logs.ts` — **CREATE**. Pure builders returning `HealthLog` create-inputs: `buildWeightSeries` (~9 points over 60d, gentle deterministic trend), `buildActivities` (all 7 `ActivityType`s with valid units; ≥1 of each of FOOD/WATER/POTTY/WALK/PLAY dated **today**), `buildNotes`, `buildMeals`, `buildVetVisits`. No `MED_GIVEN`/`CHECK_REF` rows.
7. `apps/api/prisma/seed/builders/reminders.ts` — **CREATE**. `buildCarePlan(pet, now)` uses `resolveCareTemplateForPet` → `Reminder` + `ReminderEvent` inputs, producing per rich/moderate pet: events **due today** (PENDING), **upcoming** (PENDING), and **completed past** (DONE, `completedAt` set — vaccine history + streak); Luna gets reminders but only future PENDING events (no completions). Plus `buildMedicationReminder(pet, now)` (`type:"MEDICATION"`, `medNameAsEntered`/`medDoseAsEntered` from `content.ts`, one completed + one due-today event).
8. `apps/api/prisma/seed/builders/checks.ts` — **CREATE**. `buildChecks(now)`: valid `CompletedIntake` fixtures + `SymptomCheck` + `TriageResult` inputs for exactly: REASSURE, MONITOR, VET_SOON, VET_24H (`homeCare:[]`), one **FALLBACK** (`status:"FALLBACK"`, `resultJson=SAFE_FALLBACK`, `failureReason` set), one **red-flag EMERGENCY** (`redFlagHit:true`, `redFlagRuleId`/`redFlagPayloadKey="gdv-suspected"`, urgency `EMERGENCY_NOW`, `homeCare:[]`). `createdAt/completedAt` spread over ~5 weeks. Add one `CheckFollowUp` `"better"` and one `"worse"` (→ `escalatedTier`).
9. `apps/api/prisma/seed/persist.ts` — **CREATE**. `wipeDemo(prisma)` (delete order: demo `Subscription`s → `Household D` (cascades pets→checks/reminders/health-logs, memberships) → `Household H_f` → demo Users `O`,`F` → their `Device`s; all by fixed id / known email; NEVER touches `dev@pawcareright.local` or any non-demo row). `persistDemo(prisma, model)` writes users, households, memberships, devices, pets, health-logs, reminders+events, checks+results+followups, subscription — all with explicit fixed ids/timestamps. `buildDemo(now)` composes the builders into one plain object.
10. `apps/api/prisma/seed/README.md` — **CREATE**. Demo credentials, OTP sign-in walkthrough for `O` and `F` (request → read code from API logs → verify), the wipe-and-recreate idempotency contract, and a screen→data map.
11. `apps/api/test/seed/demo-builders.spec.ts` — **CREATE**. Pure unit + content tests (no DB).
12. `apps/api/test/seed/demo-seed.e2e-spec.ts` — **CREATE**. DB smoke + idempotency (needs local postgres).

---

## Ordered steps
1. `constants.ts` + `clock.ts` (pure foundation) + their coverage in the builders spec.
2. `content.ts` — write all §7-sensitive strings once; every triage `resultJson` must be authored to pass `parseTriage` (empty `homeCare` on EMERGENCY_NOW/VET_24H; no `/diagnos/i`; med dose text contains **no numeric dosage**).
3. `builders/pets.ts`, then `health-logs.ts`, `reminders.ts`, `checks.ts` — pure, `now`-injected, deterministic (no randomness).
4. `persist.ts` (`buildDemo`, `wipeDemo`, `persistDemo`) — wire builders to Prisma with the delete/create order above.
5. Modify `seed.ts` to export `runSeed` and call it from `main`.
6. `README.md`.
7. Write `demo-builders.spec.ts` (unit + content scan) and `demo-seed.e2e-spec.ts` (DB smoke + idempotency).
8. Self-verify: ensure migrations applied (Checkpoint A), run seed, run tests (Checkpoint B).

### Checkpoints
- **A (infra):** local postgres up (`service postgresql start`); `pnpm --filter api exec prisma migrate deploy`. If `P3005` ("schema not empty"), recover per loop journal: `prisma migrate resolve --applied <baseline_migration>` then re-run deploy. Do not edit migrations.
- **B (gates):** `pnpm --filter api prisma:seed` succeeds; twice in a row with identical resulting counts; `pnpm typecheck && pnpm lint && pnpm --filter api test && pnpm build` green.

---

## Tests to write (map to acceptance criteria)

- **AC1 (2 users + owner/member household model)** → `demo-seed.e2e-spec.ts` › "seeds owner+member in one household": after `runSeed`, `O` has 1 membership OWNER in `D`, `F` has 1 membership MEMBER in `D`, `F` owns `H_f`, `getHouseholdMe(D)` lists both members.
- **AC2 (3 pets, valid breeds, divergent density)** → `demo-builders.spec.ts` › "pets": exactly 3 pets (≥1 DOG, ≥1 CAT); every `breedSlug` resolves via the `packages/data` breeds lookup; Buddy's built log count ≫ Luna's.
- **AC3 (60-day weights + today activities + all 7 activity types + valid units)** → `demo-builders.spec.ts` › "health logs": weight series length ≥8 spanning ≈60d; every `ACTIVITY` passes `parseHealthLogValue`; all 7 `ACTIVITY_TYPES` present; ≥1 activity with `occurredAt` == today; no `MED_GIVEN`/`CHECK_REF` rows built.
- **AC4 (care plans/reminders: due-today, upcoming, completed, med, vaccine history)** → `demo-builders.spec.ts` › "reminders": every reminder `rrule` passes `isValidRRule`; built events include ≥1 `dueAt`==today PENDING, ≥1 future PENDING, ≥1 past DONE with `completedAt`; ≥1 `type:"MEDICATION"` reminder; ≥1 `VACCINE` reminder with a past DONE event; Luna has reminders but zero DONE events.
- **AC5 (checks across every tier + FALLBACK + red-flag EMERGENCY)** → `demo-builders.spec.ts` › "checks": every check `intakeJson` passes `parseIntake`; every `resultJson` passes `parseTriage`; the set of urgencies covers REASSURE/MONITOR/VET_SOON/VET_24H/EMERGENCY_NOW; exactly one `status:"FALLBACK"`; exactly one `redFlagHit:true` with matching `redFlagRuleId===redFlagPayloadKey` present in `EMERGENCY_PAYLOAD_ROWS`; `resultJson` urgency/confidence equal the row's columns.
- **AC6 (billing/entitlement premium path)** → `demo-seed.e2e-spec.ts` › "premium subscription": one `Subscription` on `D` with `entitlement:"PREMIUM"`, `plan:FAMILY_PLAN_PRODUCT_ID`, active status, future `expiresAt`.
- **AC7 (idempotent, demo-only)** → `demo-seed.e2e-spec.ts` › "idempotent": snapshot counts (users/pets/reminders/events/checks/health-logs/memberships) after run 1, run `runSeed` again, assert identical counts (no dupes); assert the untouched `dev@pawcareright.local` user still exists with its original household.
- **§7 CONTENT SCAN** → `demo-builders.spec.ts` › "safety copy": over ALL seeded free text imported from `content.ts` (triage strings, notes, vet reasons/notes, meal/activity notes, med name+dose) assert none matches `/diagnos/i`; assert `medDoseAsEntered` contains no digit (no invented dosage) and no drug-as-recommendation; assert every triage `resultJson` re-parses via `parseTriage` (mechanical §7 gate) and EMERGENCY/VET_24H results have empty `homeCare`.

---

## Commands to run to self-verify
- `pnpm --filter api exec prisma migrate deploy` (Checkpoint A; P3005 recovery if needed)
- `pnpm --filter api prisma:seed` (run it twice — counts must match)
- `pnpm --filter api test -- seed` (builders unit + content scan + DB smoke/idempotency)
- `pnpm typecheck && pnpm lint && pnpm build`

## Interfaces/contracts the executor must match
- `runSeed(prisma: PrismaClient): Promise<void>`; `buildDemo(now: Date): DemoModel`; `wipeDemo(prisma)`; `persistDemo(prisma, model)`.
- Health-log inputs validate via `parseHealthLogValue`; checks via `parseIntake` + `parseTriage`; rrules via `isValidRRule`; care items via `resolveCareTemplateForPet`.
- Triage `resultJson` ⇒ `TriageResult`; `SymptomCheck.category` ∈ `SYMPTOM_CATEGORIES`; `redFlagPayloadKey` ∈ `EMERGENCY_PAYLOAD_ROWS` keys; reminder `type` ∈ `REMINDER_TYPES`; `Subscription.plan === FAMILY_PLAN_PRODUCT_ID`.

## Out of scope / do NOT touch
- Any `packages/**` source (READ ONLY — import breeds, care-templates, emergency payloads, types).
- Any `apps/api/src/**` service/controller/DTO, any Prisma schema/migration, any `tsconfig`/config, `apps/mobile`, `apps/web`.
- Do NOT implement or assert a Care Score (FIDELITY-1 may not exist yet).
- Do NOT weaken/rephrase any safety copy, disclaimer, emergency payload, or triage schema.

## Risks & the design decisions the planner made (scrutinize)
- **R1 (user model deviation):** To make OTP re-login work for the MEMBER `F` under the current unmodifiable `provisionOrGetUser` (which 500s if a user owns no household) while keeping `F`'s single membership in `D`, `F` also owns an empty, memberless throwaway household `H_f`. This deviates from the strict post-invite real state (where a joiner owns nothing) but is the only way to satisfy both the ownership-lookup and the one-membership scope guard without touching services. `H_f` is invisible on all screens.
- **R2 (projections not rows):** MED_GIVEN and CHECK_REF timeline entries are deliberately NOT seeded as HealthLog rows — they are read-time projections of `ReminderEvent(MEDICATION,DONE)` (T061) and `SymptomCheck` (T064). Med/check history therefore comes from those tables. If the mobile timeline expects literal MED_GIVEN/CHECK_REF rows, that surface would look empty; chosen per the schema/type contract to avoid double-counting.
- **R3 (idempotency = wipe-and-recreate demo subgraph):** Chosen over per-row upsert because the demo graph has many child rows without natural business keys (health logs, events, checks). `wipeDemo` deletes strictly by the demo fixed ids / known demo emails in FK-safe order and never references non-demo rows; the existing `dev@pawcareright.local` fixture is preserved and asserted untouched.
- **R4 (Care Score not implemented):** No FIDELITY-1 scorer exists in `apps/` yet; the seed only guarantees divergent data density (rich Buddy vs sparse Luna). No test asserts an actual score value.
- **R5 (medication copy):** The med reminder uses record-only, non-suggestive strings (name references the clinic label, dose = "as directed by your veterinarian" with no numbers) to stay unambiguously §7-clean while still exercising the medication UI; enumerated in `content.ts` for the checker.
- **R6 (typecheck coverage):** `prisma/seed/**` is outside `pnpm typecheck`'s include (as is the current seed); type safety of the builders is covered only via ts-jest when the `test/**` specs import them. tsconfig is intentionally not modified.
