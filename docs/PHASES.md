# Paw Care Right + — Build Phases & Task Cards

**118 tasks · 12 phases (P0–P11) · milestones M0–M11 · human checkpoints after M3, M7, M10.**

Task card format: `Txxx · Title — effort(S/M/L)` · **Deps** (must be `done` first) · **Do** (implementation directive) · **Accept** (testable criteria — CHECKER verifies these literally). Global Definition of Done from `CLAUDE.md §8` applies to every task on top of its own criteria. Phase order is strict; within a phase, any task whose deps are met may be picked.

---

## Phase 0 — Foundation & Tooling → Milestone M0

**Goal:** monorepo boots, all quality commands run green in CI, local infra one command away.

#### T001 · Init Turborepo + pnpm workspaces — S
**Deps:** — · **Do:** Repo root: `pnpm-workspace.yaml` (apps/*, packages/*), `turbo.json` with pipelines `dev,build,lint,typecheck,test`, root `package.json` scripts per CLAUDE.md §5, `.gitignore`, `.nvmrc` (Node 22 LTS).
**Accept:** `pnpm i` clean; `pnpm turbo run build --dry` lists workspaces; git initialized on branch `main`, first commit made.

#### T002 · Shared TS/ESLint/Prettier config package — S
**Deps:** T001 · **Do:** `packages/config`: strict `tsconfig.base.json` (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes), shared eslint flat config (TS + import order + no-console rule with Nest Logger exception), prettier config, and brand constants (`APP_DISPLAY_NAME = "Paw Care Right +"`, `APP_SLUG = "pawcareright"`, `BUNDLE_ID = "com.pawcareright.app"`, `DEEPLINK_SCHEME = "pawcareright"` per CLAUDE.md §1a). All future workspaces extend these.
**Accept:** `pnpm lint` and `pnpm typecheck` pass at root; a deliberate `any` in a scratch file fails lint (then remove file); brand constants exported and imported cleanly by a scratch consumer.

#### T003 · Zod env validation module — S
**Deps:** T002 · **Do:** `packages/config/env`: `defineEnv(schema)` helper that parses `process.env`, throws with readable missing-key report. Create root `.env.example` with every key used across the repo (fake values), updated by every task that adds config.
**Accept:** Unit tests: valid env parses; missing key throws listing the key; `.env.example` exists.

#### T004 · Docker Compose local infra — S
**Deps:** T001 · **Do:** `docker-compose.yml`: postgres:16 (volume, healthcheck), redis:7, minio + bucket bootstrap (`pawcareright-media`). Document ports in README section.
**Accept:** `docker compose up -d` healthy; `psql`/`redis-cli` connect with example creds; MinIO console reachable, bucket exists.

#### T005 · packages/types scaffold — S
**Deps:** T002 · **Do:** Zod + inferred types package: error-code enum, pagination schemas, id branding helpers; build via tsup; consumed path aliases wired in tsconfig base.
**Accept:** Builds; a sample schema imports cleanly into a scratch consumer in api and mobile tsconfig contexts (typecheck only).

#### T006 · NestJS scaffold (apps/api) — M
**Deps:** T003,T004,T005 · **Do:** Nest app with config module (Zod env), global validation pipe, global exception filter emitting `{error:{code,message,requestId}}`, request-id middleware, Swagger at `/docs`, `GET /v1/health` (db+redis ping), Prisma service wired (empty schema ok), Jest+Supertest setup.
**Accept:** `pnpm --filter api dev` serves; `/v1/health` returns 200 with db+redis ok; Supertest covers health + validates error format via a test-only failing route; Swagger renders.

#### T007 · Next.js scaffold (apps/web) — S
**Deps:** T002 · **Do:** App Router, Tailwind preset from packages/config, placeholder landing page, `/privacy` and `/terms` stub routes, sitemap/robots stubs.
**Accept:** `pnpm --filter web build` green; lighthouse-ci config present (budget enforced later at T095).

#### T008 · Expo scaffold (apps/mobile) — M
**Deps:** T002,T005 · **Do:** Expo + expo-router + NativeWind + TypeScript strict; `app.config.ts` with bundle ids (`com.pawcareright.app` placeholder) and `name: APP_DISPLAY_NAME` ("Paw Care Right +", imported from packages/config per CLAUDE.md §1a), deep-link scheme `pawcareright`, splash/icon placeholders, tab shell (Home, Care, Timeline, Settings), Sentry stub off, MMKV installed, Jest + @testing-library/react-native configured.
**Accept:** `pnpm --filter mobile start` boots to tab shell in Expo Go; one component test passes; typecheck green; `APP_DISPLAY_NAME` renders in a title component (no hardcoded name string — lint/grep check).

#### T009 · GitHub Actions CI — M
**Deps:** T006,T007,T008 · **Do:** Workflow: pnpm cache → `typecheck` → `lint` → `test` (spins postgres+redis services for api integration) → `build`. Separate job stub `ai-evals` (activates at T040). Badge in README.
**Accept:** Workflow file valid (`act`-style dry or yaml lint); all steps runnable locally via the same root scripts; CI required-checks documented in README.

#### T010 · packages/api-client scaffold — S
**Deps:** T005,T006 · **Do:** Typed fetch wrapper (baseURL, auth header injection hook, error normalization to types enum), TanStack Query provider factories for web+mobile, retry policy (no retry on 4xx), MMKV persister export for mobile.
**Accept:** Unit tests for error normalization + no-retry-on-4xx; imports clean in mobile and web.

**🚩 Milestone M0 gate:** full suite green · `docker compose up` + `pnpm dev` + mobile boot verified · tag `milestone/M0` · push.

---

## Phase 1 — Auth, Users & Households → Milestone M1

**Goal:** passwordless + social auth on mobile; every user lands in a household; devices registered for push.

#### T011 · Prisma core schema + migration — M
**Deps:** T006 · **Do:** Models: User, Household, Membership, Device, plus enums (Role). Constraints per ARCHITECTURE §3; seed script creating a dev user+household.
**Accept:** `prisma migrate dev` clean; unique/index assertions in a schema test; seed runs idempotently.

#### T012 · Email OTP auth (request/verify) + JWT+refresh rotation — L
**Deps:** T011 · **Do:** `POST /auth/otp/request` (rate-limited 5/min/IP, always-200 to avoid enumeration; dev transport logs code, prod transport behind interface), `POST /auth/otp/verify` → access (15m) + refresh (30d, rotating, hashed at rest), `POST /auth/refresh`, `POST /auth/logout`. Auto-provision User+Household on first verify.
**Accept:** Integration tests: full happy path; wrong/expired code; refresh rotation invalidates old token; logout kills family of tokens; rate limit returns 429.

#### T013 · Sign in with Apple — M
**Deps:** T012 · **Do:** `POST /auth/social` verifying Apple identity token (JWKS cached), links by sub/email, same provisioning path.
**Accept:** Integration test with mocked JWKS: valid token → session; tampered → 401; existing-email links not duplicates.

#### T014 · Google Sign-In — S
**Deps:** T013 · **Do:** Extend `/auth/social` for Google id_token verification; shared provider-verifier abstraction.
**Accept:** Same test matrix as T013 for Google; provider abstraction unit-tested.

#### T015 · Guards, roles & household scoping — M
**Deps:** T012 · **Do:** JWT guard global + `@Public()`; `HouseholdScope` decorator/interceptor resolving membership and injecting `householdId`; role guard (OWNER for destructive ops).
**Accept:** Tests: cross-household access to a resource returns 404 (not 403 leak); member vs owner matrix enforced.

#### T016 · Device registration + push token endpoint — S
**Deps:** T011,T015 · **Do:** `POST /v1/devices` upsert by token; prune duplicates per user/platform; lastSeen touch middleware.
**Accept:** Upsert idempotent under parallel calls (test); invalid token shape 400.

#### T017 · Security baseline: helmet, CORS, rate-limit classes — S
**Deps:** T006 · **Do:** Helmet, strict CORS (mobile: none needed; web admin origin), global throttler with route-class overrides (auth/checks/food), body size limits.
**Accept:** Integration tests hit limits and assert 429 + Retry-After; security headers present on responses.

#### T018 · Mobile auth flow — L
**Deps:** T008,T010,T012,T013,T014 · **Do:** Screens: welcome → email entry → OTP entry (auto-advance cells) → done; Apple/Google buttons (expo-apple-authentication, Google via expo-auth-session); tokens in SecureStore; auth state machine (zustand) with silent refresh; signed-out/in router groups; device push-token registration after permission grant (JIT, rationale screen first).
**Accept:** Component tests: OTP input behavior, error states; manual script in journal: cold-start auto-login verified; tokens absent from AsyncStorage (assert in test).

#### T019 · api-client auth integration + offline base — M
**Deps:** T010,T018 · **Do:** Access-token injection + 401→refresh→retry-once flow in the shared client; Query persister (MMKV) enabled for GET caches; global online/offline listener exposing `useIsOffline`.
**Accept:** Unit tests: 401 triggers single refresh then original request; refresh failure logs out; persister round-trips a query cache entry.

#### T020 · Auth integration test sweep + fixtures — S
**Deps:** T012–T019 · **Do:** Consolidate: test factory helpers (createUser/household/authedAgent) in `apps/api/test/factories`; CI green including new suites.
**Accept:** Factories used by ≥3 suites; total api coverage report ≥80% services so far.

**🚩 Milestone M1 gate:** register/login on device via Expo Go verified (journal note) · suite green · tag `milestone/M1` · push.

---

## Phase 2 — Pets & Profiles → Milestone M2

**Goal:** add-a-pet wizard end-to-end with photos; household invites; multi-pet.

#### T021 · Pet model + CRUD API — M
**Deps:** T011,T015 · **Do:** Pet per ARCHITECTURE §3; CRUD under household scope; soft-delete (deletedAt) with filtered default queries.
**Accept:** Integration tests incl. cross-household 404, soft-delete hides from list, validation (age XOR birthDate allowed states).

#### T022 · Breed dataset + autocomplete — M
**Deps:** T005 · **Do:** `packages/data/breeds`: dogs (~340) + cats (~70) with slug, name, size class, typical adult weight range (for T065 band); build-time JSON validation via Zod; `GET /v1/breeds?species&q` public, in-memory + Redis cached, prefix+fuzzy match; include `mixed-unknown`.
**Accept:** Dataset passes schema test (counts asserted ≥300 dogs/≥60 cats); endpoint p95 <30ms in test; "gsd"→German Shepherd fuzzy case passes.

#### T023 · Photo upload pipeline — L
**Deps:** T004,T021 · **Do:** `POST /pets/:id/photo-upload-url` → presigned PUT (content-type/size constrained); upload-confirm endpoint enqueues `images` job (sharp: 1600px main, 320px thumb, EXIF strip) writing back photoKey; storage service abstraction (MinIO/S3).
**Accept:** Worker integration test with real MinIO (compose): uploads produce both renditions, EXIF gone (assert), oversized/wrong-type rejected at presign.

#### T024 · Mobile add-pet wizard — L
**Deps:** T018,T021,T022 · **Do:** Multi-step wizard (species→breed autocomplete→details→photo via expo-image-picker with client-side compress→done); resumable draft in zustand; lands on pet home.
**Accept:** Component tests per step validation; wizard completable with only species+name (skip paths); journal manual check <90s completion.

#### T025 · Pet home screen — M
**Deps:** T024 · **Do:** Header card (photo, name, age auto-derived), primary CTA "Something wrong?" (stub nav), quick actions (Log weight stub, Reminders stub), empty/loading/error/offline states.
**Accept:** Snapshot + state tests (4 states); CTA visible above the fold on small devices (test via layout assertion).

#### T026 · Household invites — M
**Deps:** T015,T018 · **Do:** `POST /households/invites` → short code + deep link (`pawcareright://join/:code`, 7-day expiry); accept endpoint joins as MEMBER; mobile: settings→family screen (list members, invite share sheet), join handler route.
**Accept:** Tests: expiry, reuse blocked after accept, owner-only invite creation; deep link route unit test parses code.

#### T027 · Multi-pet switcher — S
**Deps:** T025 · **Do:** Pet switcher (header dropdown + horizontal avatars when >1), active-pet persisted per device; all pet-scoped screens read active pet from one hook.
**Accept:** Component test: switching updates dependent query keys; persists across reload (MMKV assert).

#### T028 · Phase 2 test sweep + fixtures — S
**Deps:** T021–T027 · **Do:** Pet/household factories; coverage confirm; fix stragglers.
**Accept:** Suite green; coverage ≥80% services; journal summary.

**🚩 Milestone M2 gate:** add pet + invite accepted between two dev accounts verified · tag `milestone/M2` · push.

---

## Phase 3 — AI Core (packages/ai) → Milestone M3 · ⛔ HUMAN CHECKPOINT

**Goal:** the triage brain exists, is measured, and is provably safe before any user-facing wiring.

#### T029 · Provider abstraction — M
**Deps:** T003,T005 · **Do:** `packages/ai`: `LlmProvider` interface (`complete(structured request incl. images) → raw`), Anthropic implementation (env-keyed, timeout, cost calc from usage), fake provider for tests; model id + prompt version constants exported.
**Accept:** Unit tests with fake provider; Anthropic impl integration-tested behind env flag (skipped in CI without key); cost calc unit-tested.

#### T030 · TriageResult schema + safe fallback — S
**Deps:** T005 · **Do:** Zod schema per SPEC §6.3 in packages/types; `parseTriage(raw)` → `{ok,result}|{ok:false,reason}`; `SAFE_FALLBACK` constant object (vet-recommend copy, urgency VET_SOON floor).
**Accept:** Property-style tests: malformed/missing/extra-tier inputs all fail closed to fallback path.

#### T031 · Red-flag rules engine — L
**Deps:** T005 · **Do:** Deterministic matcher over structured intake + normalized free text: species-aware rules table (≥18 rules incl. all SPEC §6.2 examples), each rule: id, species, matcher (intake predicates + keyword/synonym sets), tier floor, emergency payload key. Pure functions, zero AI.
**Accept:** ≥60 table-driven unit tests (positives, near-miss negatives, multilingual-safe keyword normalization for v1 English); "male cat straining" and "retching+bloated large dog" cases explicitly covered; <5ms per evaluation (perf test).

#### T032 · Intake schema & question flows — M
**Deps:** T005 · **Do:** Symptom categories (~12: vomiting, diarrhea, not eating, limping, skin/itch, eyes, ears, urinary, breathing, behavior, injury, other) each with dynamic follow-up question defs (typed: single/multi/scale/duration/photoPrompt) in packages/types; validation of a completed intake.
**Accept:** Schema tests per category; a completed-intake fixture per category validates; unknown category rejected.

#### T033 · Triage prompt templates — L
**Deps:** T029,T030,T032 · **Do:** System prompt encoding Safety Policy (§5) + output JSON contract + tier definitions + species caution biases; user-turn builder from pet context + intake + photos; 6–8 few-shot exemplars spanning tiers; prompt version registry.
**Accept:** Snapshot tests of built prompts (no PII beyond pet context, versioned); fake-provider round-trip parses; forbidden-content lint (no "diagnose", no dosage patterns) over exemplar outputs.

#### T034 · Vision input pipeline — M
**Deps:** T023,T029 · **Do:** Photo prep for provider: fetch from storage, downscale ≤1024px, strip metadata, basic unsafe-image pre-check hook (stub interface, log-only v1), base64 packaging with size budget (≤3 images).
**Accept:** Unit tests on resize/limits; oversized set truncated deterministically with journal-visible warning.

#### T035 · Food & toxin dataset + lookup service — L
**Deps:** T005 · **Do:** `packages/data/toxins`: ≥220 items × species verdicts (safe/caution/toxic/emergency, notes, quantity nuance where established), curated from authoritative veterinary toxicology references — encode the knowledge, cite source names in dataset comments, no copied prose; normalizer (plurals, common misspellings, synonyms like "choco"); service: dataset hit → verdict; miss → AI fallback with caution-bias prompt → AnswerCache write.
**Accept:** Dataset Zod-validated with count assertions; grapes/xylitol/lilies/onions/chocolate cases correct per species; normalizer tests; fallback path caches (test with fake provider).

#### T036 · Eval harness runner — M
**Deps:** T029,T030,T031,T033 · **Do:** `pnpm test:ai-evals`: loads YAML cases (`packages/ai/evals/{golden,redteam}/*.yaml`), runs full pipeline (rules→prompt→provider→parse→post-rules) with pluggable provider (fake for CI unless key present), scores per SPEC §6.4, writes markdown report to `loop/eval-reports/<timestamp>.md` with per-case table + aggregates + threshold pass/fail.
**Accept:** Harness runs on 5 sample cases with fake provider; report file format matches template in code; nonzero exit on threshold failure.

#### T037 · Golden set v1 (~150 cases) — L
**Deps:** T032,T036 · **Do:** Author 150 YAML cases: ≥30 per urgency tier across dogs+cats, incl. age extremes (puppy/kitten/senior), ambiguity cases with acceptable-tier ranges, and every red-flag rule represented; each case has rationale comment.
**Accept:** Count/coverage assertions in a meta-test (tier × species matrix ≥ minimums); all red-flag cases resolve via rules layer (provider not consulted for tier floor).

#### T038 · Red-team set + unsafe-output detector — L
**Deps:** T033,T036 · **Do:** ≥40 adversarial cases: dosage extraction attempts, human-med suggestions, cruelty/DIY-procedure asks, "can I wait a week" on emergencies, prompt injection in free text and inside intake fields. Detector: rule-based scan of outputs (dosage regexes incl. mg/kg patterns, drug-name list, "diagnos*" in user-facing fields, harm-enabling phrasing) used by harness as auto-fail.
**Accept:** Detector unit-tested against seeded good/bad outputs; harness fails the run if any red-team case produces unsafe output (verified by injecting a deliberately-bad fake provider in tests).

#### T039 · Cost controls & quotas — M
**Deps:** T029,T035 · **Do:** Redis counters (per-user daily/monthly checks + food lookups) with entitlement-aware limits from SPEC §7 (interfaces now, billing wiring at P7); prompt-caching flags on static system prompt; per-check cost logging (costMicroUsd) + daily aggregate metric hook.
**Accept:** Quota service unit tests (boundaries, reset windows, premium bypass flag); cost persisted on fake runs.

#### T040 · CI ai-evals gate — S
**Deps:** T036,T037,T038 · **Do:** Activate CI job: fake-provider evals every push (structure+rules+detector), full provider evals on manual dispatch/nightly with key; thresholds enforced; report uploaded as artifact.
**Accept:** CI config updated; local `pnpm test:ai-evals` green on golden+redteam with fake provider; README section "AI quality gates" written.

**🚩 Milestone M3 gate:** suite + ai-evals green · tag `milestone/M3` · push.
**⛔ CHECKPOINT C1 (loop pauses):** founder reviews latest eval report (ideally with a veterinarian's read-through of golden set + a real-provider eval run) and edits `loop/loop-state.json → checkpoints.C1.approved=true` with a journal note before Phase 4 may start.

---

## Phase 4 — Symptom Check End-to-End → Milestone M4

**Goal:** the hero flow live: intake → rules → AI → result → history → follow-up.

#### T041 · Check models + migration — S
**Deps:** T011,T030 · **Do:** SymptomCheck + TriageResult per ARCHITECTURE §3; status enum; cost field; indexes.
**Accept:** Migration clean; schema tests for status transitions helper (QUEUED→RUNNING→DONE|FALLBACK only).

#### T042 · POST /checks + status polling API — M
**Deps:** T041,T031,T039,T015 · **Do:** Create endpoint: validates intake (T032), runs red-flag rules sync, persists, enqueues; idempotency-key support; quota check (free metering); `GET /checks/:id` returns status/result/redFlag payload; list endpoint with cursor.
**Accept:** Integration tests: red-flag intake returns emergency payload in 201 body; quota exceeded → 402-style error code; idempotent replays return same checkId.

#### T043 · check-runner worker — L
**Deps:** T042,T033,T034,T036 · **Do:** BullMQ processor: load context → build prompt (+photos via T034) → provider → parse (T030) → post-rules (confidence floor, cat bias, rules tier floor cannot be lowered) → persist result + cost; retry 2 w/ jitter; final-fail ⇒ FALLBACK status; structured logs with checkId.
**Accept:** Worker integration tests with fake provider: happy path, malformed output→FALLBACK, provider timeout→retries→FALLBACK, rules floor preserved even if AI says REASSURE.

#### T044 · Mobile: check entry + category picker — M
**Deps:** T025,T032 · **Do:** "Something wrong?" → category grid (12 categories, icons), recent-checks shortcut; route scaffolding for the flow.
**Accept:** Component tests: grid renders all categories from schema (no hardcoded list); navigation carries category id.

#### T045 · Mobile: dynamic intake form — L
**Deps:** T044 · **Do:** Renderer for typed question defs (single/multi/scale/duration/photoPrompt) driven entirely by packages/types schemas; progress indicator; free-text step; review screen.
**Accept:** Renderer unit tests per question type; adding a new question to a category requires zero mobile code change (test proves via injected schema).

#### T046 · Mobile: photo capture/pick step — M
**Deps:** T045,T023 · **Do:** expo-image-picker + camera, ≤3 photos, client compress, upload via presigned flow with progress, retry on flaky network, skippable.
**Accept:** Component tests for add/remove/limit; upload state machine unit-tested (pending/uploading/failed/retry).

#### T047 · Mobile: submission + result loading — M
**Deps:** T042,T045,T046,T019 · **Do:** Submit → immediate red-flag branch (T048/T049) or polling screen (1.5s backoff, calm copy, cancel-safe); offline guard (block submit w/ clear message).
**Accept:** Tests: polling stops on DONE/FALLBACK; red-flag branch bypasses polling; offline submit blocked with retry affordance.

#### T048 · Result screen — L
**Deps:** T047 · **Do:** Urgency banner (tier color system), summary, possible causes, red-flags-to-watch, home care, do-nots, vet questions, `<VetDisclaimer/>` (non-dismissible), actions: Find vet nearby (maps deep link w/ "emergency vet near me" query for top tiers), share-as-text, done→timeline.
**Accept:** Snapshot per tier; disclaimer presence asserted in every snapshot; FALLBACK status renders safe screen (distinct snapshot); share payload includes disclaimer line.

#### T049 · Emergency interstitial — M
**Deps:** T031,T044 · **Do:** Full-screen takeover for red-flag hits: what was detected, "go now" guidance, call-vet + emergency-vet-search buttons, region-aware poison hotline (from packages/data/regions via /config), cannot be swiped past accidentally (explicit acknowledge).
**Accept:** Component tests incl. region hotline resolution + fallback when region unknown; renders before any AI content (flow test).

#### T050 · Check history + detail — S
**Deps:** T048 · **Do:** Per-pet history list (tier chip, date, category), detail view reuses result screen read-only.
**Accept:** List states (empty/paginated) tested; deep link `pawcareright://checks/:id` opens detail.

#### T051 · Follow-up loop — M
**Deps:** T043,T050 · **Do:** followUpHours from result schedules a push (via reminders/push queues once P5 lands — implement with queue interface now + integration test using direct enqueue); `POST /checks/:id/followup` better/same/worse; "worse" creates escalation card (tier+1 guidance, vet CTA) on timeline + result.
**Accept:** API tests for all three responses; worse-path escalation asserted; duplicate follow-up idempotent.

#### T052 · Phase 4 E2E + load sanity — M
**Deps:** T041–T051 · **Do:** API-level E2E: full check lifecycle with fake provider (text + photo variants); k6 (or autocannon) script: 50 concurrent check submissions sustain, queue drains, no event-loop blocking >50ms (rules layer).
**Accept:** E2E in CI; load script committed with thresholds + journal results.

**🚩 Milestone M4 gate:** device demo of full check (journal + screenshots) · suite + evals green · tag `milestone/M4` · push.

---

## Phase 5 — Care Plans & Reminders → Milestone M5

**Goal:** the retention engine — reminders that are never wrong about time.

#### T053 · Reminder models + migration — S
**Deps:** T011 · **Do:** Reminder + ReminderEvent per ARCHITECTURE §3; rrule string validated; nextFireAt maintained.
**Accept:** Migration clean; invalid rrule rejected at DTO layer.

#### T054 · Care template packs — L
**Deps:** T005 · **Do:** `packages/data/care-templates`: species × life-stage schedules (core vaccines, deworming, flea/tick cadence, dental/grooming suggestions) grouped by region protocol groups (NA/EU/UK/IN/BR/MENA/SEA/AU + default), encoded as our own structured guidance (source names in comments, no copied text); every generated reminder carries "confirm with your vet" note field.
**Accept:** Zod-validated; matrix meta-test (every species×life-stage×group resolves); IN group includes rabies emphasis case.

#### T055 · Reminders CRUD API — M
**Deps:** T053,T015 · **Do:** CRUD + agenda endpoint (`from/to` expansion of rrules in reminder timezone, merged with pending events); template-instantiate endpoint (petId + pack → reminders batch).
**Accept:** Agenda expansion unit tests incl. DST boundary (Europe/Paris + America/New_York cases) and monthly-on-31st handling; template instantiation idempotent.

#### T056 · Scheduler worker — L
**Deps:** T053,T043-infra · **Do:** Minute-tick scan of due ReminderEvents → enqueue push jobs → mark SENT; after fire, compute next occurrence via rrule in stored timezone; recovery: on boot, backfill missed events (<24h) as MISSED without pushing stale floods.
**Accept:** Worker tests with fake clock: fires within tick, DST transition correctness, restart backfill behavior, idempotency by event id.

#### T057 · Expo push sender — M
**Deps:** T016,T056 · **Do:** Batch send (100/chunk), receipt polling, DeviceNotRegistered pruning, per-user collapse of simultaneous reminders into one push with count.
**Accept:** Sender unit tests with mocked Expo SDK: batching, pruning on receipts, collapse logic.

#### T058 · Notification preferences + quiet hours — S
**Deps:** T057 · **Do:** Per-user prefs (types on/off, quiet window in local tz — deliveries inside window defer to window end); settings API + mobile screen.
**Accept:** Defer logic unit tests (window straddling midnight); prefs respected in sender tests.

#### T059 · Mobile: care plan setup wizard — M
**Deps:** T054,T055,T024 · **Do:** Post-pet-creation prompt: suggested plan from species/age/region → review list (toggle items, edit dates) → confirm creates reminders; entry also from Care tab.
**Accept:** Component tests: suggestions match template pack for fixture pets; every item shows vet-confirm note.

#### T060 · Mobile: agenda & reminder management — L
**Deps:** T055,T058 · **Do:** Care tab: agenda (today/upcoming), complete/snooze (optimistic + rollback), create/edit custom reminder (type, schedule builder mapping to rrule), per-pet filter chips.
**Accept:** Optimistic complete rollback test on API failure; schedule builder outputs valid rrule for daily/weekly/monthly/every-N cases.

#### T061 · Medication tracker — M
**Deps:** T060 · **Do:** Med reminder subtype: name + dose *as entered* + course length; per-dose events; timeline write on completion (MED_GIVEN); UI copy forbids suggestions (static text only).
**Accept:** Course generation tests (e.g., 2×/day for 10 days = 20 events); no string in module matches dosage-suggestion detector patterns (reuse T038 detector as lint test).

#### T062 · Phase 5 timezone/clock test sweep — S
**Deps:** T053–T061 · **Do:** Consolidated clock-skew, tz-change (user moves timezone), and device-vs-server drift tests; agenda vs fired-event consistency check job.
**Accept:** Suite green; documented tz test matrix in test file header.

**🚩 Milestone M5 gate:** on-device: template plan created, push received on schedule (journal evidence) · tag `milestone/M5` · push.

---

## Phase 6 — Health Timeline → Milestone M6

#### T063 · HealthLog model + migration — S
**Deps:** T011 · **Do:** Per ARCHITECTURE §3, kind enum incl. CHECK_REF backlink; photo keys reuse T023 pipeline.
**Accept:** Migration clean; kind-specific valueJson Zod validators (weight grams int>0, visit fields, etc.).

#### T064 · Timeline API — M
**Deps:** T063,T015 · **Do:** Cursor list (merged kinds, newest first, kind filter), create endpoints per kind, weight-series endpoint (downsampled if >200 points).
**Accept:** Pagination + filter tests; series downsample unit test.

#### T065 · Weight chart — M
**Deps:** T064,T022 · **Do:** Mobile chart (react-native-svg based) with breed typical-range band when available (from T022 data), unit toggle per locale, add-weight quick action.
**Accept:** Chart logic (scaling, band mapping, unit conversion) unit-tested pure; snapshot for empty/1-point/many.

#### T066 · Quick-log actions — S
**Deps:** T064 · **Do:** Pet home quick actions wired: weight, note+photo, vet visit; 2-tap logging goal.
**Accept:** Each action creates correct kind (integration test); forms validate via shared schemas.

#### T067 · Timeline UI — M
**Deps:** T064,T050 · **Do:** Timeline tab: infinite list with kind icons/colors, check entries deep-link to result detail, filter chips, month section headers.
**Accept:** List virtualization sanity (no full re-render on append — test via render counts); empty/offline states.

#### T068 · Vet visit prep summary — M
**Deps:** T064 · **Do:** `GET /pets/:id/vet-summary`: structured plain-text (last 90d: weight trend, checks w/ tiers, meds given, notes) with disclaimer footer; mobile share sheet.
**Accept:** Golden-file test of generated summary for a fixture pet; ≤2,500 chars target enforced.

#### T069 · Photo attachments on logs — S
**Deps:** T063,T023 · **Do:** Multi-photo on NOTE/VET_VISIT kinds; thumbnails in timeline; full-screen viewer.
**Accept:** Upload reuse tests; viewer accessible-label test.

#### T070 · Phase 6 sweep — S
**Deps:** T063–T069 · **Do:** Factories for logs; coverage confirm; fix stragglers.
**Accept:** Suite green; coverage held ≥80% services.

**🚩 Milestone M6 gate:** tag `milestone/M6` · push.

---

## Phase 7 — Monetization → Milestone M7 · ⛔ HUMAN CHECKPOINT

**Goal:** money flows correctly and honestly; server is the entitlement oracle.

#### T071 · RevenueCat SDK + offerings config — M
**Deps:** T018 · **Do:** react-native-purchases integration; offerings mapping (monthly/annual/family) with product-id conventions documented in `docs/store-setup.md` (created here — includes regional tier table from SPEC §7 for manual store console entry); purchaser identification = backend userId.
**Accept:** SDK boots in dev with stub keys; store-setup doc complete enough for a human to configure both consoles without guessing.

#### T072 · Subscription mirror model + entitlement service — M
**Deps:** T011 · **Do:** Subscription model per ARCHITECTURE §3; entitlement service resolving household premium (family plan = household-scoped); `GET /billing/entitlement`.
**Accept:** Service unit tests: free, premium, expired, family-member resolution paths.

#### T073 · RevenueCat webhook handler — L
**Deps:** T072,T017 · **Do:** `POST /billing/rc-webhook`: signature/auth header verify, idempotent event processing (event id dedupe), state machine for INITIAL_PURCHASE/RENEWAL/CANCELLATION/EXPIRATION/BILLING_ISSUE/PRODUCT_CHANGE, raw event retained.
**Accept:** Table-driven tests per event type incl. out-of-order delivery; replay-safe; bad signature 401.

#### T074 · Paywall screen — L
**Deps:** T071,T048 · **Do:** Onboarding placement (after first check result, before second) + settings entry; plan cards (annual highlighted, family explainer), 7-day trial CTA, restore link, legal links; copy/variant from `/config` remote values.
**Accept:** Snapshot both variants; purchase/restore flows tested with mocked SDK (success, user-cancel, pending); paywall never blocks Emergency interstitial path (flow test).

#### T075 · Free-tier gating — M
**Deps:** T039,T072,T042 · **Do:** Wire quota service to real entitlements: free = 1 lifetime check, 5 food lookups/day, 1 pet, no chat/sharing premium gates; consistent 402-class error → mobile upsell sheet.
**Accept:** Integration matrix free vs premium across gated endpoints; counters survive reinstall (server-side assertion); upsell sheet triggered by error code (mobile test).

#### T076 · Restore & manage subscription — S
**Deps:** T074 · **Do:** Restore purchases action; manage-subscription deep links (platform-correct); billing-issue banner from entitlement status.
**Accept:** Mocked-SDK tests; banner renders on BILLING_ISSUE fixture.

#### T077 · Family plan household wiring — M
**Deps:** T072,T026 · **Do:** Family entitlement covers all household members/pets; leaving household drops access (grace message); owner-only purchase management.
**Accept:** Tests: member premium via owner's family plan; removal revokes; non-owner purchase attempt handled gracefully.

#### T078 · Analytics event layer — M
**Deps:** T010 · **Do:** PostHog wrapper in packages (typed event map per SPEC §8), mobile + api emitters, user/household ids, consent flag respected (default on, off switch in settings pre-wired for T091).
**Accept:** Event map type-tested (unknown event = compile error); emissions asserted in key flows (first_check_completed, paywall_view, trial_start via webhook).

#### T079 · Remote config + A/B scaffold — S
**Deps:** T042-config,T074 · **Do:** `/config` extended: paywall variant assignment (stable hash by userId), min-version gate, hotline pack version; mobile config hook with cached fallback.
**Accept:** Variant assignment deterministic (test); stale-cache behavior offline tested.

#### T080 · Sandbox purchase QA checklist + phase sweep — S
**Deps:** T071–T079 · **Do:** `docs/qa/billing-sandbox-checklist.md`: step-by-step human test script (both stores, trial, cancel, restore, family); automated suite consolidation.
**Accept:** Checklist complete; suite green.

**🚩 Milestone M7 gate:** suite green · tag `milestone/M7` · push.
**⛔ CHECKPOINT C2 (loop pauses):** founder configures store products per `docs/store-setup.md`, runs the sandbox checklist on device, approves pricing — then sets `checkpoints.C2.approved=true` + journal note.

---

## Phase 8 — Ask Paw Care Right + (Chat) + Content → Milestone M8

#### T081 · Chat API (threads + SSE) — L
**Deps:** T029,T033,T075 · **Do:** ChatThread/ChatMessage models; `POST /chat/threads`, message endpoint streaming via SSE; pet context + last-90d timeline digest injected; shared safety system prompt (same policy module as triage); symptom-like messages get a structured-check nudge block in the response; premium-gated with quota (fair-use 200 msgs/mo).
**Accept:** Stream integration test (chunk order, completion event); nudge triggers on symptom fixture; quota + gate tests; injection attempt in message handled per red-team detector.

#### T082 · Chat safety + moderation pass — M
**Deps:** T081,T038 · **Do:** Run unsafe-output detector on streamed completions (buffer-then-release strategy for flagged spans → replace with safe fallback message); log incidents; extend red-team set with 10 chat-specific cases.
**Accept:** Deliberately-bad fake provider yields fallback, incident logged; evals updated + green.

#### T083 · Mobile chat UI — M
**Deps:** T081,T027 · **Do:** Chat screen (active-pet badge, streaming bubbles, quick prompts like "Is this food safe?" routing to F3, disclaimer footer persistent, retry on stream drop).
**Accept:** Component tests: stream render, drop-retry, nudge block renders as tappable card into check flow.

#### T084 · Breed hub content — M
**Deps:** T022 · **Do:** For top 50 breeds: structured care profile (temperament summary, exercise needs, common-condition awareness list phrased as "talk to your vet about…", grooming cadence) generated into `packages/data/breed-guides` behind a `reviewed:boolean` flag (ships only reviewed=true; generation script + 5 hand-reviewed exemplars now, rest default false for post-C3 review).
**Accept:** Schema-valid; app renders only reviewed guides (test); no dosage/diagnosis language (detector lint over dataset).

#### T085 · Web programmatic SEO pages — L
**Deps:** T035,T007 · **Do:** SSG route `/can-{species}-eat/{item}` from toxin dataset (~600 pages): verdict hero, nuance section, emergency CTA when toxic, app-store CTA, disclaimer, FAQ schema.org markup, cross-links; sitemap generation.
**Accept:** Build renders all pages (count assert); lighthouse SEO ≥ 95 on sample; every toxic/emergency page shows hotline CTA (test on sample set).

#### T086 · Web landing + legal — M
**Deps:** T007 · **Do:** Landing (hero, how-it-works, pricing, FAQ, store badges), privacy policy + terms real content (template-based, health-data + AI-guidance clauses, GDPR/CCPA sections flagged `LEGAL-REVIEW` for C3), app deep-link handling.
**Accept:** Builds; legal pages contain review markers; links validated.

#### T087 · In-app content reader — S
**Deps:** T084 · **Do:** Breed guide screen from pet profile ("About {breed}") + explore list; markdown-ish renderer for dataset content blocks.
**Accept:** Renders exemplar guides; deep link works; a11y labels on sections.

#### T088 · Phase 8 sweep — S
**Deps:** T081–T087 · **Do:** Consolidate tests; evals green incl. chat cases.
**Accept:** Suite + `test:ai-evals` green.

**🚩 Milestone M8 gate:** tag `milestone/M8` · push.

---

## Phase 9 — Hardening, Compliance & Quality → Milestone M9

#### T089 · Sentry everywhere + release tagging — S
**Deps:** T008,T006,T007 · **Do:** Sentry init api/web/mobile with environment + release (git sha), source maps upload in CI, PII scrubbing config (no intake text in events).
**Accept:** Forced test error appears with release tag (journal evidence in staging run); scrubber unit test.

#### T090 · Abuse controls + AI audit log — M
**Deps:** T017,T043 · **Do:** Tighten per-route rate classes; anomaly counters (checks/user/hour alert threshold); append-only AiAuditLog (checkId/threadId, promptVersion, modelId, detectorFlags, costs) with 90-day retention job.
**Accept:** Limits tested; audit rows written on check + chat paths; retention job unit-tested.

#### T091 · Privacy: consent, export & deletion — L
**Deps:** T078,T063 · **Do:** Settings: analytics opt-out (kills PostHog client-side + server flag), `POST /me/export` (async job → email link stub/dev log with JSON bundle), `DELETE /me` (grace-period soft delete → hard cascade job incl. S3 objects); confirmation UX.
**Accept:** Deletion integration test proves cascade (db rows + storage keys gone post-job); export bundle schema test; opt-out stops event emission (test).

#### T092 · Store privacy declarations prep — S
**Deps:** T091 · **Do:** `docs/store-privacy.md`: Apple privacy nutrition labels + Play Data Safety answers derived from actual data flows (table: data type → purpose → shared? → retention), reviewed against code.
**Accept:** Doc complete; cross-checked list matches PostHog/Sentry/RC data actually sent (grep-verified inventory in doc appendix).

#### T093 · Accessibility pass — M
**Deps:** mobile screens · **Do:** Sweep: accessibility labels/roles on interactive elements, dynamic type non-breaking on key screens, contrast tokens audited, touch targets ≥44pt, reduce-motion respected on urgency animations.
**Accept:** a11y lint/test additions pass; manual VoiceOver/TalkBack script results in journal for the 5 core flows.

#### T094 · Offline & state-sweep audit — M
**Deps:** T019 · **Do:** Every screen verified for loading/error/empty/offline (checklist-driven); reminder completes queue offline and sync on reconnect; global offline banner.
**Accept:** Checklist committed with per-screen ticks; offline-queue reconnect test green.

#### T095 · Performance budgets — M
**Deps:** T008,T007 · **Do:** Mobile: bundle analysis, heavy-dep audit, image cache policy, cold-start measurement script + budget (<2.5s mid-Android target documented); Web: lighthouse-ci budgets enforced in CI (perf ≥90 landing, SEO ≥95 programmatic sample).
**Accept:** CI budget job green; before/after numbers in journal.

#### T096 · Security pass — M
**Deps:** T012–T017,T073 · **Do:** Dependency audit (fail CI on high CVEs with allowlist file), SecureStore usage audit, webhook + presign endpoints fuzz-ish tests, secrets scan hook, ADR on cert-pinning (deferred, documented).
**Accept:** `pnpm audit`-gated CI step; audit findings resolved or allowlisted with justification; tests green.

#### T097 · Disclaimer & claims copy audit — S
**Deps:** all UI · **Do:** Sweep every user-facing string vs Safety Policy: disclaimer placements, no "diagnose/treat/vet-approved" claims, emergency copy tone; centralize disclaimers in one strings module; extend detector-lint to app string files.
**Accept:** Detector-lint over `strings.ts` files green in CI; placement checklist in journal.

#### T098 · Full regression + coverage gate — M
**Deps:** T089–T097 · **Do:** Stabilize: flaky-test hunt, coverage report gates wired (≥80% api services + packages/ai) as CI requirement, E2E web smoke (landing + a food page) via Playwright.
**Accept:** 3 consecutive full CI runs green (journal links); coverage gate enforced.

**🚩 Milestone M9 gate:** tag `milestone/M9` · push.

---

## Phase 10 — Beta Release → Milestone M10 · ⛔ HUMAN CHECKPOINT

#### T099 · EAS build profiles + signing setup — M
**Deps:** T008 · **Do:** eas.json (development/preview/production), env wiring per profile, app.config finalization (real bundle ids pending T102 naming), version/build auto-increment, `docs/release-runbook.md` started.
**Accept:** `eas build --profile preview` config validates (dry); runbook covers build→submit→OTA flow.

#### T100 · App icon, splash & store screenshot kit — M
**Deps:** T099 · **Do:** Final icon/splash (all densities), screenshot generation setup (device frames for 6.7"/6.1"/5.5" + Android), marketing string blocks per screenshot; assets in `apps/mobile/store-assets/`.
**Accept:** Assets pass expo-doctor/store size specs; screenshot script produces the 8-shot set from staging build.

#### T101 · Internal distribution — S
**Deps:** T099 · **Do:** TestFlight internal + Play internal track submission steps executed as far as automatable; blockers requiring human console access listed in checkpoint notes.
**Accept:** Build artifacts produced; submission commands documented+attempted; remaining human steps enumerated in `loop/checkpoint-C3-notes.md`.

#### T102 · Naming/trademark check + store listing copy — M
**Deps:** — · **Do:** Chosen display name is **"Paw Care Right +"** (technical identifiers per CLAUDE.md §1a). Verify against: Apple App Store + Google Play search (exact + "paw care right" + "pawcareright"), basic trademark databases (USPTO, EUIPO, Algeria INAPI), and domains (`pawcareright.app`/`.com`). **Explicitly assess and record three known risks:** (1) collision with existing "paw/pet + right" pet-care businesses (e.g. Pawright pet-sitting, PetRight vet clinics) — confirm no *app* or same-class trademark conflict; (2) store handling of the literal `+` and spaces — fallback plan: register the store name without `+` if a store rejects it, keeping `+` only in marketing; (3) the name is phrase-like/descriptive → assess trademark distinctiveness and prepare 2 fallback names (e.g. `Vetright`, `Careright`) verified clear. ASO listing pack (title ≤30 chars — "Paw Care Right +" is 16, fits; subtitle, keyword field, long/short description) in `docs/store-listing.md`, claims-audit applied (T097 — subtitle must state "guidance, not a veterinarian").
**Accept:** Evidence table for chosen name + 2 verified fallbacks; the three risk assessments documented with go/no-go per store; `+`-rejection fallback plan written; listing copy passes detector-lint; final name + bundle-id decision flagged for C3 approval.

#### T103 · Crash-free & funnel dashboards — S
**Deps:** T089,T078 · **Do:** PostHog dashboards (activation funnel, paywall funnel, retention cohort) as saved insights via API/terraform-style script where possible + manual steps doc; Sentry alert rules (crash-free <99% warn).
**Accept:** Scripts/docs committed; staging events visible in funnel (journal screenshot).

#### T104 · In-app feedback + bug report — S
**Deps:** T008 · **Do:** Shake-to-report (screenshot + logs consent + text) → api endpoint → stored + Sentry breadcrumb link; beta banner with feedback CTA.
**Accept:** Report round-trip integration test; consent required before log attach (test).

#### T105 · Seed & dataset QA — S
**Deps:** T022,T035,T054,T084 · **Do:** Final dataset audit: counts, spot-check top-100 toxin verdicts against sources list, region hotline verification table (marked verified-by-human column for C3), reviewed-flag inventory for breed guides.
**Accept:** Audit report `docs/qa/dataset-audit.md`; all schema meta-tests green.

#### T106 · Launch runbook + rollback strategy — M
**Deps:** T099,T073 · **Do:** Complete runbook: deploy order (db→api→workers→web→mobile), OTA vs binary decision matrix, feature-kill switches via /config (checks, chat, paywall), incident playbook (AI provider down, bad triage report, store rejection), rollback steps per layer.
**Accept:** Runbook reviewed complete (every ARCHITECTURE container covered); kill switches implemented + tested for checks/chat.

### OTA code update system (see `docs/OTA_UPDATES.md`)

#### T113 · expo-updates + channels + fingerprint runtime policy — M
**Deps:** T008,T099 · **Do:** Install/configure expo-updates; `runtimeVersion: {policy:'fingerprint'}`; channels development/preview/production wired to eas.json profiles; boot-time tags (updateId, channel) exposed via a `useOtaInfo` hook; CI step printing fingerprint diff per PR (per OTA_UPDATES §1).
**Accept:** Preview build config resolves channel correctly (expo config assert test); fingerprint-diff CI step outputs on a native-dep-change fixture branch (journal evidence); hook unit-tested with mocked Updates module.

#### T114 · In-app update flow + deferral guard — L
**Deps:** T113,T079 · **Do:** Implement OTA_UPDATES §3: cold-start check (3s budget, non-blocking), background fetch, silent-apply-next-launch default, critical prompt path (`[critical]` metadata + `/config.criticalOtaVersion`), foreground re-check throttled 6h (persisted), deferral guard for symptom-check/emergency/paywall/onboarding flows.
**Accept:** Unit tests with mocked Updates: timeout continues app, critical prompts, non-critical silent; deferral guard test proves no reload prompt during an in-progress check flow; throttle persistence test.

#### T115 · Forced/recommended binary upgrade gate — S
**Deps:** T079 · **Do:** `/config` minAppVersion + recommendedAppVersion per platform; blocking upgrade screen (store deep link, no dismiss) below min; dismissible banner between min and recommended; semver compare util in packages/types.
**Accept:** Semver util unit-tested (build-number edge cases); screen/banner logic table-driven tests; blocking screen renders before any authenticated route (flow test).

#### T116 · CI publish pipeline + staged rollout — M
**Deps:** T113,T009 · **Do:** CI: auto `eas update --branch preview` on main after full gates; production job manual-dispatch with typed confirmation `PUBLISH-PROD`, pre-flight `GET /health` API-build check (OTA_UPDATES §5.3), then publish + `eas channel:rollout` to 10%; promotion/halt commands documented in the job summary; update message convention enforced by a lint step.
**Accept:** Workflow yaml valid; preview publish step gated on all checks (config assert); prod job refuses without confirmation input (dry-run evidence); message-lint rejects a bad fixture.

#### T117 · Rollback runbook + per-update release health — M
**Deps:** T113,T089,T106 · **Do:** Sentry release naming `pawcareright@{version}+{updateId}` with tags at boot; PostHog `ota_*` events (OTA_UPDATES §7); `eas update:republish` rollback procedure + promotion criteria table added to release runbook; `/v1/meta/client-versions` admin aggregate endpoint.
**Accept:** Sentry event in staging carries updateId tag (journal evidence); ota events fire in mocked flow tests; runbook section complete (criteria thresholds from OTA_UPDATES §6); endpoint tested + read-only.

#### T118 · OTA safety gates on publish jobs — S
**Deps:** T040,T116,T097 · **Do:** Publish jobs (preview + prod) additionally require: `test:ai-evals` green, `<VetDisclaimer/>` snapshot suite green, Emergency interstitial flow tests green (named required checks); loop is forbidden from prod publishes (assert job has no automated trigger); document in OTA_UPDATES §8 cross-ref.
**Accept:** CI config shows the three named required checks on both publish jobs; prod job trigger audit (no push/schedule triggers) asserted in a config test; docs cross-ref added.

**🚩 Milestone M10 gate:** tag `milestone/M10` · push. Preview channel receives the M10 OTA publish as part of the gate.
**⛔ CHECKPOINT C3 (loop pauses):** founder: final name + bundle ids, store console setup, legal-review markers resolved, hotline human-verification column complete, TestFlight/Play submission — then `checkpoints.C3.approved=true`.

---

## Phase 11 — Post-Beta Growth Scaffold → Milestone M11

#### T107 · Paywall A/B live — S
**Deps:** T079,C3 · **Do:** Activate variant experiment (copy + trial framing), success metric = trial_start rate, PostHog experiment wiring, min-sample guard.
**Accept:** Assignment + exposure events verified in staging; experiment doc with stop conditions.

#### T108 · Referral: invite → trial extension — M
**Deps:** T026,T075 · **Do:** Household invite accepted ⇒ +14 trial days both sides (entitlement service grant type), share copy, abuse guard (max 3 grants/user).
**Accept:** Grant math tests incl. stacking cap; RC entitlement unaffected (server-side grace only) — documented.

#### T109 · Smart review prompt — S
**Deps:** T051 · **Do:** StoreReview request only after positive moments (REASSURE result acknowledged, or 5th reminder streak), max 1/60 days, never after emergencies.
**Accept:** Trigger-logic unit tests incl. suppression cases.

#### T110 · i18n scaffold + first locales — L
**Deps:** T097 · **Do:** i18n runtime (mobile+web) over existing strings modules, locale detection, RTL smoke (ar), machine-translated es/pt-BR/hi behind `reviewed:false` per-locale flag (ship English-only until human review, but pipeline complete); date/number/unit localization audit.
**Accept:** Pseudo-locale test (no hardcoded strings leak — CI check); RTL snapshot of 3 core screens; unit/date localization tests.

#### T111 · Read-only admin mini-dashboard — M
**Deps:** T007,T072 · **Do:** apps/web `/admin` (basic-auth + email allowlist): daily KPIs (installs proxy, checks run, tier distribution, fallback rate, MRR events from RC webhooks), user lookup (entitlement, counters), AiAuditLog browser; strictly read-only.
**Accept:** Authz tests (allowlist enforced); queries paginated; no mutation endpoints exist.

#### T112 · v1.1 backlog seeding — S
**Deps:** T104 · **Do:** Synthesize beta feedback + metrics into `docs/BACKLOG.md` (scored ICE), incl. known deferrals from SPEC §10; propose next 2 phases draft for founder review.
**Accept:** Backlog with ≥15 scored items; loop writes final summary to journal and sets state `status: v1-complete`.

**🚩 Milestone M11 gate:** tag `milestone/M11` · push. **Loop complete.**
