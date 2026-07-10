# CLAUDE.md — Paw Care Right + Project Constitution

> **Read this file at the start of every loop iteration.** It is the single source of truth for how code is written in this repository. `LOOP_PROTOCOL.md` defines *how the loop runs*; this file defines *how work is done*. If any instruction elsewhere conflicts with this file, this file wins — except the Safety Policy in `docs/PRODUCT_SPEC.md §5`, which wins over everything.

---

## 1. What we are building

**Paw Care Right +** (working title — trademark check is task T102) is a B2C mobile-first AI pet care companion: a "pocket vet + pet life manager" for dog and cat owners worldwide.

Core promise: **peace of mind between vet visits.** The app gives AI-powered symptom *guidance* (never diagnosis), food/toxin safety answers, care reminders (vaccines, parasites, meds), a health timeline, and family sharing — priced as a low-cost consumer subscription with regional pricing.

Non-negotiable product principle: **when in doubt, escalate to a real veterinarian.** Every ambiguous AI outcome fails *upward* in urgency, never downward.

## 1a. Naming convention (display name vs. identifiers) — do not violate

The product's **display name** is exactly `Paw Care Right +` (with spaces and the trailing `+`). This string is used **only** in user-facing surfaces: store listings, the app's on-screen title, marketing/legal copy, push-notification sender name, and email. Wherever the display name is rendered, it comes from **one constant** (`APP_DISPLAY_NAME` in `packages/config`) — never hardcode it in components.

The `+` and spaces are **illegal or unsafe** in identifiers, so everywhere that isn't user-facing prose uses these fixed technical derivatives — never invent new ones:

| Context | Value |
|---|---|
| npm/repo/workspace name, monorepo root | `pawcareright` |
| iOS/Android bundle id | `com.pawcareright.app` |
| Deep-link scheme | `pawcareright://` |
| S3 bucket, Redis prefixes, queue names | `pawcareright-*` |
| Sentry release | `pawcareright@{version}+{updateId}` |
| Web domain (placeholder until T102) | `pawcareright.app` |
| EAS project slug | `pawcareright` |

Rule: if a value goes into code, config, a URL, a package manifest, or an id → use `pawcareright` (or `com.pawcareright.app`). If it's shown to a human as the product's name → use `Paw Care Right +` via the shared constant. The final store name + bundle ids are confirmed at the **C3 checkpoint** after the T102 trademark pass; treat both as provisional until then.

## 2. Golden rules (in priority order)

1. **Animal & user safety beats every other goal.** No feature ships that could delay emergency vet care or give medication dosing advice. See `docs/PRODUCT_SPEC.md §5`.
2. **Follow the task card.** Implement exactly what the current task in `docs/PHASES.md` specifies. No scope creep, no speculative features. Over-engineering is a defect (Google review standard).
3. **Quality gates are not optional.** Typecheck, lint, tests, and build must pass before a task is marked done. Tests ship in the same commit as the code they cover.
4. **One task, one commit.** Conventional commit format, referencing the task ID.
5. **Never push mid-phase.** Git push happens only at milestone gates (see `LOOP_PROTOCOL.md §6`).
6. **Never touch:** `LOOP_PROTOCOL.md`, `CLAUDE.md`, `docs/PHASES.md` (except status markers if instructed), real secrets, or `.env` files containing credentials. `loop/loop-state.json` and `loop/journal.md` are the only loop files the agent writes.
7. **No new dependencies without justification.** Adding a package requires a one-line justification in `loop/journal.md` and it must be actively maintained (release < 6 months, meaningful adoption).

## 3. Locked tech stack

Do not substitute any of these. If a task seems to require something else, mark it blocked and journal why.

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Language | TypeScript, `strict: true` everywhere. No `any`, no `@ts-ignore` without a `// JUSTIFIED:` comment |
| Backend API | NestJS (REST + Swagger), class-validator DTOs |
| ORM / DB | Prisma + PostgreSQL 16 |
| Cache / queues | Redis 7 + BullMQ |
| Mobile | React Native + Expo (expo-router), NativeWind for styling |
| Web (marketing/SEO/admin) | Next.js (App Router) + Tailwind |
| Shared data validation | Zod schemas in `packages/types`, consumed by api, web, mobile |
| Data fetching (web+mobile) | TanStack Query via shared `packages/api-client` |
| Client state | Zustand (minimal; server state lives in Query) |
| AI provider | Ollama Cloud (text + vision) and Google Gemini (image generation), behind the provider abstraction in `packages/ai`. See docs/AI_PROVIDERS.md. No `ANTHROPIC_API_KEY` at runtime |
| Payments / subscriptions | RevenueCat (mobile IAP), server-side entitlement mirror via webhooks |
| Push | Expo Notifications |
| Object storage | S3-compatible (MinIO locally) |
| Analytics / errors | PostHog, Sentry |
| Testing | Jest (unit), Supertest (API integration), Playwright (web E2E), Detox deferred to post-beta — see PHASES notes |
| CI | GitHub Actions |
| Local infra | Docker Compose (postgres, redis, minio) |

## 4. Repository layout

```
pawcareright/
├── apps/
│   ├── api/          # NestJS backend
│   ├── mobile/       # Expo app (the product)
│   └── web/          # Next.js marketing + SEO pages + mini admin
├── packages/
│   ├── types/        # Zod schemas + shared TS types (single source of truth)
│   ├── api-client/   # Typed fetch wrapper + TanStack Query hooks (web + mobile)
│   ├── ai/           # Prompts, triage schema, rules engine, eval harness
│   ├── data/         # Seed datasets: breeds, toxins, care templates, regions
│   └── config/       # Shared eslint, tsconfig, prettier, tailwind presets
├── docs/             # PRODUCT_SPEC.md, ARCHITECTURE.md, PHASES.md
├── loop/             # loop-state.json, journal.md, KICKOFF_PROMPT.md
├── docker-compose.yml
└── turbo.json
```

## 5. Commands (must always work from repo root)

```
pnpm i                      # install
pnpm dev                    # turbo: api + web (mobile via pnpm --filter mobile start)
pnpm typecheck              # turbo run typecheck (all workspaces)
pnpm lint                   # turbo run lint
pnpm test                   # turbo run test (unit + integration)
pnpm test:ai-evals          # packages/ai eval harness against golden + red-team sets
pnpm build                  # turbo run build
docker compose up -d        # postgres + redis + minio
pnpm --filter api prisma:migrate:dev
pnpm --filter api prisma:seed
```

If a command in this list breaks, fixing it is an implicit P0 acceptance criterion of the current task.

## 6. Coding standards

**Backend (NestJS)**
- Module-per-domain (`auth`, `households`, `pets`, `checks`, `reminders`, `health-logs`, `billing`, `chat`, `content`).
- Every endpoint: DTO with class-validator + Swagger decorators + auth guard (public routes must be explicitly `@Public()`).
- Global error format: `{ error: { code, message, requestId } }` — error codes are enums in `packages/types`.
- Service methods carry business logic; controllers stay thin. Unit tests target services (≥80% coverage on services), Supertest covers every endpoint's happy path + auth failure + validation failure.
- All queries on indexed columns; every new query pattern gets an index in the same migration. No N+1 (use Prisma `include`/batching).
- No `console.log` — Nest `Logger` only. All config via validated env (Zod env schema in `packages/config`).
- Long-running work (AI calls, image processing, push sends) goes through BullMQ workers, never inline in request handlers. Every worker: idempotent, retry with backoff, dead-letter queue.

**Mobile (Expo)**
- expo-router file-based navigation; screens compose components from `apps/mobile/src/components`.
- NativeWind classes; no inline style objects except dynamic values.
- Every screen handles: loading, error, empty, offline. Keyboard avoidance and safe-area insets on all screens.
- Tokens in `expo-secure-store`, never AsyncStorage. Permissions requested just-in-time with a rationale screen first.
- Push handling covers foreground, background, and cold-start tap.
- Images: compressed before upload (max 1600px long edge), cached with `expo-image`.

**Shared**
- All request/response shapes are Zod schemas in `packages/types`; api validates with them, client infers types from them. Never hand-write a duplicate interface.
- kebab-case files, PascalCase components/classes, camelCase functions.
- No hardcoded user-facing strings in components — strings live in a `strings.ts` per app (i18n-ready; actual i18n is T110).

## 7. Safety content rules (enforced in code review by CHECKER)

These mirror `docs/PRODUCT_SPEC.md §5` and apply to every prompt, string, and UI copy:

1. Never output the word "diagnosis"/"diagnose" in user-facing AI results — use "possible causes" / "what this could be".
2. Never output medication dosages, drug names as recommendations, or instructions to administer human medication to animals. Med tracker records what a vet prescribed; it never suggests.
3. Every AI result screen renders the disclaimer component (`<VetDisclaimer/>`) — non-dismissible, present in snapshot tests.
4. Emergency red-flag matches (deterministic rules) must render the Emergency interstitial *before* any AI content, with region-aware emergency/poison hotline numbers.
5. Uncertainty fails upward: if AI output fails schema validation, confidence is low, or the provider errors → show the safe fallback ("we can't assess this reliably — please contact a vet") — never a retry-silently-and-guess.
6. No content that helps harm animals (fighting, cruelty, DIY sedation, DIY surgery, breeding malpractice). Refuse in-product via the safety system prompt; red-team evals (T038) verify.

## 8. Definition of Done (every task)

- [ ] Acceptance criteria on the task card all pass
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green
- [ ] `pnpm build` green for affected workspaces
- [ ] Tests written for new logic (unit for services/utils, integration for endpoints, component/snapshot for critical UI)
- [ ] No forbidden patterns: `any`, `@ts-ignore` (unjustified), `console.log`, hardcoded secrets, TODO without task reference
- [ ] Swagger updated (backend), strings externalized (mobile/web)
- [ ] Conventional commit made: `type(scope): TASK-ID short description`
- [ ] `loop/loop-state.json` + `loop/journal.md` updated

## 9. Document map

| File | Purpose |
|---|---|
| `docs/PRODUCT_SPEC.md` | What we're building, features, safety policy, pricing, metrics |
| `docs/ARCHITECTURE.md` | System design: containers, data model, API surface, AI engine, queues |
| `docs/PHASES.md` | All 12 phases, 119 task cards — the loop's work queue |
| `docs/OTA_UPDATES.md` | OTA code update system: EAS Update channels, rollouts, rollback, publish safety gates |
| `docs/MODEL_STRATEGY.md` | Planner(Fable)/Executor(Sonnet)/Checker(Fable) model-switching loop — how each task is executed |
| `docs/model-strategy-setup.md` | Setup + operation of the model-switching system (.claude agents/hooks) |
| `docs/AI_PROVIDERS.md` | Runtime AI providers: Ollama Cloud (text+vision), Gemini (images). Replaces Anthropic at runtime |
| `LOOP_PROTOCOL.md` | The autonomous loop: maker/checker, gates, milestones, checkpoints |
| `loop/loop-state.json` | Machine-readable progress state |
| `loop/journal.md` | Append-only human-readable log of every iteration |
