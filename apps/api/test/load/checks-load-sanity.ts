/**
 * T052 load-sanity script — a standalone, zero-new-dependency `tsx` script
 * (NOT a jest spec: no `.spec` in the filename, so jest's `testMatch` ignores
 * it; it still typechecks + lints). Sustains 50 concurrent
 * `POST /v1/pets/:petId/checks` submissions against a LOCALLY RUNNING API for
 * 20s, asserts a p95/p99/error-rate latency budget (a rules-layer
 * (`evaluateRedFlags`, run inline in the request handler) event-loop stall
 * would show up as a p99 spike — see `loop/plans/T052.plan.md` Key decision
 * #2; the authoritative per-eval rules-layer bench is T031's, not
 * re-asserted here), waits for the checks queue to drain, and prints a
 * paste-ready `loop/journal.md` block.
 *
 * Prerequisites:
 *   1. `docker compose up -d` (postgres + redis + minio).
 *   2. `pnpm build` (or at least `pnpm --filter @pawcareright/ai... build`) so the
 *      workspace packages' `dist/` this script and the running API both import
 *      (`@pawcareright/ai`/`@pawcareright/types`/`@pawcareright/config` resolve to
 *      `dist/` via their `exports` map, not `src/`) are up to date.
 *   3. The API running locally with `AI_TEXT_PROVIDER=fake` (so the live
 *      `CheckRunnerProcessor` worker drains every enqueued job deterministically,
 *      with no network dependency) — e.g. `AI_TEXT_PROVIDER=fake pnpm --filter api dev`.
 *   4. `pnpm --filter api load:sanity`.
 *
 * Env (all optional, default to the same local dev values the rest of the repo
 * uses — see `.env.example`):
 *   API_BASE_URL   default `http://localhost:3000`
 *   DATABASE_URL   default `postgresql://pawcareright:pawcareright@localhost:5432/pawcareright?schema=public`
 *   REDIS_URL      default `redis://localhost:6379`
 *   JWT_SECRET     default `dev-insecure-jwt-secret-do-not-use-in-production` (must match the running API)
 *
 * NOT wired into CI (needs a running API + a drained live worker) — run
 * manually/locally. The orchestrator runs this at the M4 gate and pastes the
 * printed block into `loop/journal.md` (plan "Handoff").
 */
import { performance } from "node:perf_hooks";

import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import { Redis } from "ioredis";

import { CHECKS_QUEUE } from "../../src/checks/checks.contract";
import { AppConfigService } from "../../src/config/app-config.service";
import { cleanupUsers, createHousehold, createPet, createUser, mintAccessToken } from "../factories";

// CLAUDE.md §6 "No console.log — Nest Logger only" — this standalone script
// has no Nest DI container, but `Logger` is usable unbound (mirrors
// `main.ts`'s static `Logger.log` bootstrap line).
const logger = new Logger("checks-load-sanity");

const DEFAULT_DATABASE_URL = "postgresql://pawcareright:pawcareright@localhost:5432/pawcareright?schema=public";
// Mirrors `test/global-setup.ts`'s backfill so a standalone run (no shell
// export, no .env) still connects with the same local-dev default the rest
// of the repo uses.
process.env.DATABASE_URL ??= DEFAULT_DATABASE_URL;

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";
const CONCURRENCY = 50;
const DURATION_MS = 20_000;
const QUEUE_DRAIN_POLL_MS = 500;
const QUEUE_DRAIN_TIMEOUT_MS = 60_000;

// Thresholds (asserted; process exits non-zero on breach) — starting values,
// founder-tunable at the M4 gate (plan Risk 4).
const P95_THRESHOLD_MS = 400;
const P99_THRESHOLD_MS = 1000;

function benignIntake(): Record<string, unknown> {
  return {
    category: "not-eating",
    answers: [
      { questionId: "onset", type: "duration", value: 6, unit: "hours" },
      { questionId: "water", type: "single", value: "drinking-normally" },
      { questionId: "energy", type: "scale", value: 4 },
    ],
  };
}

interface RequestSample {
  durationMs: number;
  isError: boolean;
}

/** One worker: fire requests back-to-back until `deadline`, recording each round-trip's latency. */
async function runWorker(
  deadline: number,
  authHeader: string,
  petId: string,
  samples: RequestSample[],
): Promise<void> {
  while (performance.now() < deadline) {
    const startedAt = performance.now();
    let isError = false;
    try {
      const res = await fetch(`${API_BASE_URL}/v1/pets/${petId}/checks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ intake: benignIntake() }),
      });
      // Both 201 (created) and 402 (free-tier quota exceeded, expected after
      // the first successful check) exercise the inline rules layer — only a
      // 5xx (server fault) counts as an error here.
      isError = res.status >= 500;
    } catch {
      isError = true;
    }
    samples.push({ durationMs: performance.now() - startedAt, isError });
  }
}

function percentile(sortedDurations: number[], p: number): number {
  if (sortedDurations.length === 0) return 0;
  const index = Math.min(sortedDurations.length - 1, Math.ceil((p / 100) * sortedDurations.length) - 1);
  return sortedDurations[Math.max(0, index)] ?? 0;
}

async function pollQueueDrain(redisUrl: string): Promise<{ drainedInSeconds: number; drained: boolean }> {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue(CHECKS_QUEUE, { connection });
  const startedAt = performance.now();

  try {
    for (;;) {
      const counts = await queue.getJobCounts("waiting", "active");
      const remaining = (counts.waiting ?? 0) + (counts.active ?? 0);
      if (remaining === 0) {
        return { drainedInSeconds: (performance.now() - startedAt) / 1000, drained: true };
      }
      if (performance.now() - startedAt > QUEUE_DRAIN_TIMEOUT_MS) {
        return { drainedInSeconds: (performance.now() - startedAt) / 1000, drained: false };
      }
      await new Promise((resolve) => setTimeout(resolve, QUEUE_DRAIN_POLL_MS));
    }
  } finally {
    await queue.close();
    await connection.quit();
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const config = new AppConfigService();
  const jwt = new JwtService({ secret: config.jwtSecret });

  const user = await createUser(prisma);
  const household = await createHousehold(prisma, user.id);
  const pet = await createPet(prisma, household.id);
  const authHeader = `Bearer ${mintAccessToken(jwt, user.id)}`;

  try {
    const samples: RequestSample[] = [];
    const deadline = performance.now() + DURATION_MS;

    const workers = Array.from({ length: CONCURRENCY }, () => runWorker(deadline, authHeader, pet.id, samples));
    await Promise.all(workers);

    const durations = samples.map((s) => s.durationMs).sort((a, b) => a - b);
    const errors = samples.filter((s) => s.isError).length;
    const p50 = percentile(durations, 50);
    const p95 = percentile(durations, 95);
    const p99 = percentile(durations, 99);
    const max = durations[durations.length - 1] ?? 0;
    const errorRate = samples.length > 0 ? errors / samples.length : 0;

    const thresholdsPass = p95 < P95_THRESHOLD_MS && p99 < P99_THRESHOLD_MS && errorRate === 0;

    const drain = await pollQueueDrain(config.redisUrl);

    const isoDate = new Date().toISOString().slice(0, 10);
    const summary = [
      `### T052 load-sanity — ${isoDate}`,
      `concurrency=${CONCURRENCY} duration=${DURATION_MS / 1000}s provider=fake`,
      `requests=${samples.length} errors=${errors} p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms max=${max.toFixed(1)}ms`,
      `thresholds: p95<${P95_THRESHOLD_MS} p99<${P99_THRESHOLD_MS} errorRate=0 -> ${thresholdsPass ? "PASS" : "FAIL"}`,
      `checks-queue drained (waiting+active==0) in ${drain.drainedInSeconds.toFixed(1)}s -> ${drain.drained ? "PASS" : "FAIL"}`,
    ].join("\n");

    logger.log(`\n${summary}\n`);

    if (!thresholdsPass || !drain.drained) {
      process.exitCode = 1;
    }
  } finally {
    await cleanupUsers(prisma, [user.id]);
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  logger.error(err instanceof Error ? err.stack : String(err));
  process.exitCode = 1;
});
