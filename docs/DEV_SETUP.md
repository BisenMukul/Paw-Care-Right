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

| Server | Command | URL / notes |
|---|---|---|
| **API** (NestJS) | `pnpm --filter api dev` | http://localhost:3000 · routes under `/v1` · Swagger at `/docs` |
| **Web** (Next.js) | `pnpm --filter web dev` | http://localhost:3001 (auto-bumps off 3000; or `-- --port 3001`) |
| **Mobile** (Expo) | `pnpm --filter mobile start` | Metro at http://localhost:8081 |

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
