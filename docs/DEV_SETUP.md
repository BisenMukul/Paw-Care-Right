# DEV_SETUP.md — Running & Setting Up Paw Care Right +

Operational runbook: install, infra, migrations, and running every server locally.
For *what* we're building see `PRODUCT_SPEC.md`; for *how code is written* see `../CLAUDE.md`.

> **Local infra assumption (current machine):** Redis 7 runs in Docker on `6379`; PostgreSQL
> runs **natively** on `5432` (`postgres` / `root`, database `pawcareright`). Adjust the
> `.env` values in §3 if your infra differs.

---

## 0. The one rule that governs everything

The app **does not auto-load `.env` yet** — the API reads `process.env` directly and nothing
populates it from the file. So in **every new terminal**, load `.env` into the shell first, then
run your pnpm commands (child processes inherit the vars).

Required for the **API** and **all Prisma commands** (they need `DATABASE_URL`; the API also needs
`REDIS_URL`). Web and Mobile do **not** need it.

Run from the **repo root** (where `.env` lives), once per terminal:

**PowerShell:**
```powershell
Get-Content .env | ? { $_ -match '^\s*[^#\s].*?=' } | % { $k,$v = $_ -split '=',2; [Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim()) }
```

**Git Bash:**
```bash
set -a; source .env; set +a
```

> This workaround goes away once the env-loading task lands (wire a dotenv loader into the API
> `dev`/`start` scripts or `main.ts`). Until then, load `.env` manually.

---

## 1. Where do I run commands? (root vs folder)

**Almost everything runs from the repo root.** Turborepo + pnpm workspaces handle the sub-packages.

| Scope | How | Example |
|---|---|---|
| Whole monorepo | `pnpm <script>` at root (turbo fans out) | `pnpm typecheck`, `pnpm test`, `pnpm build` |
| One app/package | `pnpm --filter <name> <script>` **from root** | `pnpm --filter api dev` |
| Arbitrary binary in a package | `pnpm --filter <name> exec <cmd>` | `pnpm --filter api exec prisma studio` |

`<name>` is `api`, `web`, or `mobile` (or the full `@pawcareright/api`, etc.). Prisma commands run
from root via `--filter api` — pnpm sets `apps/api` as the working directory, where the schema
lives. You basically never need to `cd` into a folder.

---

## 2. Prerequisites (one-time, per machine)

- **Node ≥ 22** — required by `engines.node`. (Repo currently observed on 20.19.4 → upgrade with
  `nvm install 22 && nvm use 22`, otherwise you get "Unsupported engine" + AWS SDK warnings.)
- **pnpm 10.34.3** — pinned via `packageManager`; run `corepack enable` to activate it.
- **Docker Desktop** — for Redis (and optionally Postgres/MinIO via `docker-compose.yml`).

---

## 3. First-time setup (fresh clone) — all from root

```bash
pnpm i                                   # install (stop the API first — see §7 gotcha 2)
pnpm build                               # REQUIRED before dev — builds packages/* dist (see §7 gotcha 7)
docker compose up -d redis               # Redis 7 on 6379 (Postgres runs natively on 5432)
# load .env  (see §0)
pnpm --filter api prisma:migrate:dev     # apply migrations to the DB
pnpm --filter api prisma:seed            # seed breeds / toxins / care templates / regions
```

Ensure `.env` matches your infra:

```
DATABASE_URL=postgresql://postgres:root@localhost:5432/pawcareright?schema=public
REDIS_URL=redis://localhost:6379
```

> Full Docker infra alternative: `docker compose up -d` brings up postgres (5432), redis (6379),
> and minio (9000). Skip the `postgres` service if you use a native Postgres on 5432 to avoid a
> port clash.

---

## 4. Running the servers (daily) — from root, `.env` loaded

> **Build the packages first if their source changed** (fresh clone, after a pull, or after editing
> anything in `packages/*`): `pnpm build`. The turbo `dev` task has **no** `dependsOn: ["^build"]`,
> so running dev never builds `packages/*` — the apps compile against a stale/missing `dist` and you
> get "has no exported member" / "Cannot find module" errors. See §7 gotcha 7.

| Server | Command | URL / notes |
|---|---|---|
| **API** (NestJS) | `pnpm --filter api dev` | http://localhost:3000 · routes under `/v1` · Swagger at `/docs` |
| **Web** (Next.js) | `pnpm --filter web dev` | http://localhost:3001 (auto-bumps off 3000; or `-- --port 3001`) |
| **Mobile** (Expo) | `pnpm --filter mobile start` | Metro at http://localhost:8081 — **requires a dev build, not Expo Go** (§7 gotcha 10) |

- Start the **API first** so it claims port 3000; Web then takes 3001.
- **Only the API terminal needs `.env` loaded.** Web/Mobile don't.
- All-at-once: after loading `.env`, `pnpm dev` at root runs api + web + mobile together — but
  Expo is noisy in a shared turbo pane, so run **mobile in its own terminal** in practice.

---

## 5. Prisma / database workflow — from root, `.env` loaded

| Task | Command |
|---|---|
| Regenerate client (after schema change / fresh install) | `pnpm --filter api prisma:generate` |
| **Create a new migration** (after editing `schema.prisma`) | `pnpm --filter api exec prisma migrate dev --name <descriptive_name>` |
| Apply pending migrations (no new one) | `pnpm --filter api prisma:migrate:dev` |
| Apply committed migrations only (CI/prod style) | `pnpm --filter api exec prisma migrate deploy` |
| Seed | `pnpm --filter api prisma:seed` |
| Reset DB (drop → recreate → migrate → seed) | `pnpm --filter api exec prisma migrate reset` |
| Visual DB browser | `pnpm --filter api exec prisma studio` |

**`migrate dev` vs `migrate deploy`:** `dev` detects schema drift, *creates* a new migration if the
schema changed, applies all pending, regenerates the client, and runs seed — use it while
developing. `deploy` only applies already-committed migration files — use it in CI/prod.

Schema lives at `apps/api/prisma/schema.prisma`; migrations in `apps/api/prisma/migrations/`;
seed at `apps/api/prisma/seed.ts` (`prisma db seed` → `tsx prisma/seed.ts`).

---

## 6. Quality gates — from root (turbo runs across all workspaces)

```
pnpm typecheck      pnpm lint      pnpm test      pnpm build      pnpm test:ai-evals
```

These don't need `.env`, except integration tests that hit a real DB/Redis — for those, bring up
infra and load `.env` first.

---

## 7. Gotchas (this setup)

1. **`.env` isn't auto-loaded** → load it per terminal (§0). Goes away once the dotenv task lands.
2. **`pnpm i` while the API is running → Prisma `EPERM`** (Windows locks the engine DLL). Stop the
   API first, or ignore the cosmetic exit-1 if you didn't change `schema.prisma`.
3. **Node 20 vs required 22** → upgrade.
4. **Redis container has no restart policy** → after a reboot, re-run `docker compose up -d redis`.
5. **API and Web both default to :3000** → start API first; Web auto-picks 3001.
6. **Postgres**: currently the **native** PG on 5432 (`postgres`/`root`, db `pawcareright`). The
   Docker PG on **5433** (`pawcareright-postgres-1`) is unused in this setup — leave it or
   `docker compose stop postgres`.
7. **`dev` does not build `packages/*` → stale-`dist` errors.** The apps import each package's
   **built `dist`** (via its `exports` field), not its source. In `turbo.json`, `build`, `typecheck`,
   `lint`, and `test` all declare `dependsOn: ["^build"]`, but **`dev` does not** — so
   `pnpm dev` / `pnpm --filter api dev` compiles against whatever `dist` exists. Symptoms:

   ```
   error TS2305: Module '"@pawcareright/types"' has no exported member 'X'
   error TS2307: Cannot find module '@pawcareright/analytics'
   ```

   **Fix:** `pnpm build` (or `pnpm -r --filter "./packages/*" build`) from root, then restart dev.
   Note `tsup` *cleans* the output folder before writing, so a build interrupted partway (e.g. the
   process is killed) leaves `dist` wiped or partial — producing the same errors. If the symbol
   exists in the package's `src` but not its `dist`, it's always this: rebuild.
8. **Expo/EAS commands must run in the mobile workspace, not the repo root.** The Expo config is
   `apps/mobile/app.config.js`; there is none at the root. Running `npx expo …` from the root fails
   with:

   ```
   CommandError: No platforms are configured to use the Metro bundler in the project Expo config.
   ```

   **Fix:** `pnpm --filter mobile exec expo <cmd>` from root, or `cd apps/mobile` first. Example:
   `pnpm --filter mobile exec expo export --platform android --clear` → writes `apps/mobile/dist`.
   Also note `app.config.js` does `require("@pawcareright/config")` — it loads that package's **built**
   output, so `packages/config/dist` must exist (see gotcha 7) or the config won't even load.
9. **`pnpm build` (turbo) crashed once with exit `3221226505`** (`0xC0000409`,
   STATUS_STACK_BUFFER_OVERRUN — a native crash) and printed no task output. It was not reproducible;
   a retry ran 9/9 tasks fine. If it recurs, fall back to `pnpm -r --filter "./packages/*" build`
   (bypasses turbo), and/or upgrade turbo. Running Node 20 against a repo requiring ≥22 (gotcha 3) is
   a plausible contributor.
10. **The app does NOT run in Expo Go — use a development build.** Expo Go lacks the native modules
    this app depends on. Symptoms when you try:

    ```
    FATAL JS error: expo-notifications: Android Push notifications ... removed from Expo Go with SDK 53
    Error configuring Purchases: Invalid API key. The native store is not available inside Expo Go
    Route "./push-rationale.tsx" is missing the required default export.   <- red herring, see below
    ```

    - `src/push/use-push-registration.ts` **statically imports** `expo-notifications`, which runs a
      side-effect on import and **throws in Expo Go**. This happens at *import* time, so the
      `try/catch` inside `register()` cannot catch it.
    - The "missing default export" warning is a **symptom, not a bug** — `push-rationale.tsx` does
      export default; it just imports the throwing module, so expo-router never sees the export.
    - RevenueCat needs the native store; the config's `stub_*` keys fail in Expo Go.

    **Fix:** build and install a dev build (already configured — `expo-dev-client` is a dependency
    and an `app.config.js` plugin; `eas.json` has a `development` profile with
    `developmentClient: true`):

    ```bash
    cd apps/mobile
    npx eas-cli login                                           # once
    npx eas-cli build --profile development --platform android  # produces an installable APK
    ```

    Install the APK, then `pnpm --filter mobile start` and the dev client connects to Metro.
    Local `expo run:android` needs a full Android SDK + JDK toolchain (`ANDROID_HOME`, `adb`, `java`),
    which is not installed on this machine.
