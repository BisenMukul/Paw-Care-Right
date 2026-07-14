import { randomUUID } from "node:crypto";

import { getQueueToken } from "@nestjs/bullmq";
import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { FakeTextProvider } from "@pawcareright/ai";
import { parseTriage } from "@pawcareright/types";
import { PrismaClient } from "@prisma/client";
import type { Job, Queue } from "bullmq";
import { QueueEvents } from "bullmq";
import { Redis } from "ioredis";
import sharp from "sharp";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { CHECKS_QUEUE, type ChecksJobData } from "../src/checks/checks.contract";
import { AppConfigService } from "../src/config/app-config.service";
import { StorageService } from "../src/storage/storage.service";
import { TRIAGE_TEXT_PROVIDER } from "../src/workers/check-runner.tokens";
import { FOLLOWUPS_QUEUE, type FollowUpJobData } from "../src/workers/followups.contract";
import { cleanupUsers, createOwnerContext, resolveJwtService, type AuthedContext } from "./factories";

const JOB_WAIT_TIMEOUT_MS = 30_000;
const TEST_TIMEOUT_MS = 40_000;

/**
 * Fixed, schema-valid triage response (mirrors `check-runner.processor.spec.ts`'s
 * `triageResultText()`/`textResult()`). Uses `canned` (not `script`) so the SAME
 * valid JSON is returned for every `generate()` call across both tests in this
 * file — a `script` of length 1 would exhaust on the 2nd job.
 */
const cannedTriageTextResult = {
  text: JSON.stringify({
    urgency: "MONITOR",
    confidence: "medium",
    summary: "Keep an eye on things and note any changes over the next day.",
    possibleCauses: [{ name: "Mild stomach upset", whyItFits: "Symptoms are mild and non-specific." }],
    redFlagsToWatch: ["Repeated vomiting"],
    homeCare: ["Offer small amounts of water"],
    doNot: ["Do not give human medications to your pet without a veterinarian's guidance."],
    vetQuestions: ["How long has this been going on?"],
    followUpHours: 24,
  }),
  model: "fake-text-model",
  usage: { latencyMs: 5, inputTokens: 10, outputTokens: 5, totalTokens: 15, costMicroUsd: 3 },
};

/**
 * Full API-level lifecycle E2E (T052): the ONLY suite with a REAL,
 * `@Processor`-attached `pawcareright-checks` BullMQ `Worker` (the actual
 * `CheckRunnerProcessor` — not overridden here). Only the `TRIAGE_TEXT_PROVIDER`
 * DI seam is swapped for a deterministic `FakeTextProvider`, so
 * `evaluateRedFlags`/`applyPostRules`/`VisionPrepService`/Prisma persistence all
 * run for real end-to-end over a real HTTP round-trip. Pinned to Redis DB 15
 * (plan Risk 1) — `AppConfigService` reads `REDIS_URL` at DI-construction time
 * (`defineEnv` reads `process.env` per-call, not memoized at import), so setting
 * it here before `compile()` pins this whole app instance's Bull connection
 * (and this suite's own `ioredis`/`QueueEvents`) to a logical DB with no other
 * suite's live consumer — every other AppModule-booting e2e suite no-ops
 * `CheckRunnerProcessor` via `overrideCheckRunner` (T043 hygiene), so DB 0's
 * queues have no live worker either. Restored in `afterAll`.
 */
describe("Checks lifecycle (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;
  let storage: StorageService;
  let checksQueue: Queue<ChecksJobData>;
  let followupsQueue: Queue<FollowUpJobData>;
  let queueEvents: QueueEvents;
  let queueEventsConnection: Redis;
  let priorRedisUrl: string | undefined;

  const userIds: string[] = [];
  const objectKeysToCleanup: string[] = [];

  beforeAll(async () => {
    priorRedisUrl = process.env.REDIS_URL;
    process.env.REDIS_URL = "redis://localhost:6379/15";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TRIAGE_TEXT_PROVIDER)
      .useValue(new FakeTextProvider({ canned: cannedTriageTextResult }))
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = new PrismaClient();
    jwtService = resolveJwtService(app);
    storage = app.get(StorageService);
    checksQueue = app.get(getQueueToken(CHECKS_QUEUE));
    followupsQueue = app.get(getQueueToken(FOLLOWUPS_QUEUE));

    await storage.ensureBucket();

    const config = app.get(AppConfigService);
    queueEventsConnection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
    queueEvents = new QueueEvents(CHECKS_QUEUE, { connection: queueEventsConnection });
    await queueEvents.waitUntilReady();
  });

  afterAll(async () => {
    for (const key of objectKeysToCleanup) {
      await storage.deleteObject(key).catch(() => undefined);
    }
    await cleanupUsers(prisma, userIds);

    await checksQueue.obliterate({ force: true });
    await followupsQueue.obliterate({ force: true });
    await queueEvents.close();
    await queueEventsConnection.quit();
    await prisma.$disconnect();
    await app.close();

    if (priorRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = priorRedisUrl;
    }
  });

  const owner = (): Promise<AuthedContext> => createOwnerContext(app, prisma, jwtService, userIds);

  async function createPet(ctx: AuthedContext, name = "Fido"): Promise<string> {
    const res = await ctx.authedAgent("post", "/v1/pets").send({ species: "DOG", name });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

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

  it(
    "text check: POST -> live worker -> DONE with schema-valid result, cost, and follow-up job",
    async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);

      const created = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expect(created.status).toBe(201);
      expect(created.body.status).toBe("QUEUED");
      expect(created.body.redFlag).toBeUndefined();
      const checkId = created.body.id as string;

      const job = (await checksQueue.getJob(checkId)) as Job<ChecksJobData>;
      expect(job).toBeDefined();
      await job.waitUntilFinished(queueEvents, JOB_WAIT_TIMEOUT_MS);

      const res = await ctx.authedAgent("get", `/v1/checks/${checkId}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("DONE");
      expect(res.body.result).toBeDefined();

      const parsed = parseTriage(res.body.result);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.result.urgency).toBe("MONITOR");
      }

      const checkRow = await prisma.symptomCheck.findUnique({ where: { id: checkId } });
      expect(checkRow?.costMicroUsd).toBe(3);
      const triageRow = await prisma.triageResult.findUnique({ where: { checkId } });
      expect(triageRow).not.toBeNull();

      // 24h follow-up hours -> a delayed job in `pawcareright-followups`.
      const followUpJob = (await followupsQueue.getJob(checkId)) as Job<FollowUpJobData>;
      expect(followUpJob).toBeDefined();
      expect(followUpJob.opts.delay).toBe(86_400_000);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "photo check: photoPrompt intake -> VisionPrep runs against real MinIO -> DONE",
    async () => {
      const ctx = await owner();
      const petId = await createPet(ctx, "Rex");

      const photoBuf = await sharp({
        create: { width: 64, height: 64, channels: 3, background: { r: 10, g: 120, b: 200 } },
      })
        .jpeg()
        .toBuffer();
      const photoKey = `pets/${petId}/original/lifecycle-${randomUUID()}.jpg`;
      await storage.putObject(photoKey, photoBuf, "image/jpeg");
      objectKeysToCleanup.push(photoKey);

      // "ears" category: onset/signs/which are the required questions (none of
      // their benign answer values map to a `RedFlagSign` in
      // `red-flag-intake.mapper.ts`'s `SIGN_MAPPING`), plus its optional
      // `photoPrompt` question ("photo") answered with the seeded key. Both the
      // intake answer's `photoKeys` AND the DTO's top-level `photoKeys` carry the
      // key — the check row's vision-prep gate reads the latter
      // (`check.photoKeys.length > 0`), while `collectPhotoKeys` (VisionPrep)
      // reads the former.
      const intake = {
        category: "ears",
        answers: [
          { questionId: "onset", type: "duration", value: 3, unit: "days" },
          { questionId: "signs", type: "multi", values: ["scratching"] },
          { questionId: "which", type: "single", value: "left" },
          { questionId: "photo", type: "photoPrompt", photoKeys: [photoKey] },
        ],
      };

      const created = await ctx
        .authedAgent("post", `/v1/pets/${petId}/checks`)
        .send({ intake, photoKeys: [photoKey] });
      expect(created.status).toBe(201);
      expect(created.body.status).toBe("QUEUED");
      expect(created.body.redFlag).toBeUndefined();
      const checkId = created.body.id as string;

      const job = (await checksQueue.getJob(checkId)) as Job<ChecksJobData>;
      expect(job).toBeDefined();
      await job.waitUntilFinished(queueEvents, JOB_WAIT_TIMEOUT_MS);

      const res = await ctx.authedAgent("get", `/v1/checks/${checkId}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("DONE");
      expect(res.body.result).toBeDefined();

      const parsed = parseTriage(res.body.result);
      expect(parsed.ok).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );
});
