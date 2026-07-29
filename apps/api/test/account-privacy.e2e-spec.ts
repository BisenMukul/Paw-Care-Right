import { randomUUID } from "node:crypto";

import { getQueueToken } from "@nestjs/bullmq";
import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { accountExportSchema } from "@bombaypetcompany/types";
import { PrismaClient } from "@prisma/client";
import type { Job, Queue } from "bullmq";
import { QueueEvents } from "bullmq";
import { Redis } from "ioredis";

import { AnalyticsService } from "../src/analytics/analytics.service";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { AppConfigService } from "../src/config/app-config.service";
import { StorageService } from "../src/storage/storage.service";
import { ACCOUNT_EXPORT_QUEUE, type AccountExportJobData } from "../src/workers/account-export.contract";
import {
  cleanupUsers,
  createOwnerContext,
  createSubscription,
  overrideCheckRunner,
  resolveJwtService,
  type AuthedContext,
} from "./factories";

const JOB_WAIT_TIMEOUT_MS = 30_000;

/**
 * Real Postgres + real MinIO + real BullMQ round-trip for privacy settings
 * + the export bundle (T091 plan AC2/AC3). `AccountExportProcessor`
 * (registered in-process via `@Processor`) actually builds the bundle here
 * -- no mocking of storage, the queue, or `AccountExportService`.
 */
describe("Account privacy (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;
  let storage: StorageService;
  let exportQueue: Queue<AccountExportJobData>;
  let queueEvents: QueueEvents;
  let queueEventsConnection: Redis;

  const userIds: string[] = [];
  const originalPosthogApiKey = process.env.POSTHOG_API_KEY;

  beforeAll(async () => {
    // AC3's "a server-side emit path sends nothing" test needs the
    // underlying transport to be REACHABLE (not stub-safe-no-op'd by an
    // empty key) so the opt-out gate is the thing actually proven to stop
    // it -- see `AnalyticsService.captureForUser`'s own unit tests for the
    // paired mocked-Prisma proof; this e2e proves the real DI-wired path.
    process.env.POSTHOG_API_KEY = "phc_test_e2e_key";

    const moduleRef = await overrideCheckRunner(Test.createTestingModule({ imports: [AppModule] })).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = new PrismaClient();
    jwtService = resolveJwtService(app);
    storage = app.get(StorageService);
    exportQueue = app.get(getQueueToken(ACCOUNT_EXPORT_QUEUE));

    await storage.ensureBucket();

    const config = app.get(AppConfigService);
    queueEventsConnection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
    queueEvents = new QueueEvents(ACCOUNT_EXPORT_QUEUE, { connection: queueEventsConnection });
    await queueEvents.waitUntilReady();
  });

  afterAll(async () => {
    await cleanupUsers(prisma, userIds);
    await queueEvents.close();
    await queueEventsConnection.quit();
    await prisma.$disconnect();
    await app.close();
    if (originalPosthogApiKey === undefined) {
      delete process.env.POSTHOG_API_KEY;
    } else {
      process.env.POSTHOG_API_KEY = originalPosthogApiKey;
    }
  });

  const owner = (): Promise<AuthedContext> => createOwnerContext(app, prisma, jwtService, userIds);

  /** Runs the real export job for `exportId` (jobId === exportId, see `PrivacyService.requestExport`). */
  async function waitForExportJob(exportId: string): Promise<void> {
    const job = (await exportQueue.getJob(exportId)) as Job<AccountExportJobData>;
    expect(job).toBeDefined();
    await job.waitUntilFinished(queueEvents, JOB_WAIT_TIMEOUT_MS);
  }

  describe("GET/PUT /me/privacy", () => {
    it("PUT { analyticsOptOut: true } persists and is returned by GET", async () => {
      const ctx = await owner();

      const initial = await ctx.authedAgent("get", "/v1/me/privacy");
      expect(initial.status).toBe(200);
      expect(initial.body).toEqual({ analyticsOptOut: false, deletionScheduledAt: null });

      const putRes = await ctx.authedAgent("put", "/v1/me/privacy").send({ analyticsOptOut: true });
      expect(putRes.status).toBe(200);
      expect(putRes.body).toEqual({ analyticsOptOut: true, deletionScheduledAt: null });

      const getRes = await ctx.authedAgent("get", "/v1/me/privacy");
      expect(getRes.body).toEqual({ analyticsOptOut: true, deletionScheduledAt: null });
    });
  });

  describe("AC3: opting out stops a real server-side emit path", () => {
    it("after opting out, captureForUser sends nothing; opting back in sends one event", async () => {
      const ctx = await owner();
      const originalFetch = global.fetch;
      const fetchSpy = jest.fn().mockResolvedValue({ ok: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JUSTIFIED: swapping global.fetch for a test spy, restored in finally
      (global as any).fetch = fetchSpy;

      try {
        const analytics = app.get(AnalyticsService);

        const optOutRes = await ctx.authedAgent("put", "/v1/me/privacy").send({ analyticsOptOut: true });
        expect(optOutRes.status).toBe(200);

        await analytics.captureForUser(ctx.user.id, "paywall_view", { source: "onboarding" });
        expect(fetchSpy).not.toHaveBeenCalled();

        const optInRes = await ctx.authedAgent("put", "/v1/me/privacy").send({ analyticsOptOut: false });
        expect(optInRes.status).toBe(200);

        await analytics.captureForUser(ctx.user.id, "paywall_view", { source: "onboarding" });
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("POST /me/export (AC2)", () => {
    async function seedFullAccount(ctx: AuthedContext): Promise<{
      petId: string;
      checkId: string;
      healthLogId: string;
      reminderId: string;
      threadId: string;
    }> {
      const pet = await prisma.pet.create({
        data: { householdId: ctx.household.id, species: "DOG", name: "Rex" },
      });

      const check = await prisma.symptomCheck.create({
        data: {
          petId: pet.id,
          createdById: ctx.user.id,
          category: "vomiting",
          intakeJson: { category: "vomiting", answers: [] },
          photoKeys: [],
          status: "DONE",
        },
      });
      await prisma.triageResult.create({
        data: {
          checkId: check.id,
          urgency: "MONITOR",
          confidence: "medium",
          resultJson: {
            urgency: "MONITOR",
            confidence: "medium",
            summary: "Keep an eye on your pet.",
            possibleCauses: [],
            redFlagsToWatch: [],
            homeCare: [],
            doNot: [],
            vetQuestions: [],
            followUpHours: 24,
          },
          modelId: "test-model",
          promptVersion: "v1",
        },
      });

      const healthLog = await prisma.healthLog.create({
        data: { petId: pet.id, kind: "NOTE", valueJson: { text: "fine" }, occurredAt: new Date() },
      });

      const reminder = await prisma.reminder.create({
        data: {
          petId: pet.id,
          type: "VACCINE",
          title: "Rabies",
          rrule: "FREQ=YEARLY",
          timezone: "UTC",
          startAt: new Date(),
          nextFireAt: new Date(Date.now() + 86_400_000),
        },
      });
      await prisma.reminderEvent.create({
        data: { reminderId: reminder.id, dueAt: new Date(Date.now() + 86_400_000) },
      });

      const thread = await prisma.chatThread.create({ data: { petId: pet.id, createdById: ctx.user.id } });
      await prisma.chatMessage.create({ data: { threadId: thread.id, role: "USER", content: "hi" } });
      await prisma.chatMessage.create({ data: { threadId: thread.id, role: "ASSISTANT", content: "hello" } });

      await prisma.device.create({
        data: { userId: ctx.user.id, expoPushToken: `ExponentPushToken[${randomUUID()}]`, platform: "ios" },
      });
      await createSubscription(prisma, {
        rcAppUserId: ctx.user.id,
        householdId: ctx.household.id,
        entitlement: "PREMIUM",
      });

      return { petId: pet.id, checkId: check.id, healthLogId: healthLog.id, reminderId: reminder.id, threadId: thread.id };
    }

    it("produces a bundle that satisfies accountExportSchema, with exactly the seeded pet/check ids", async () => {
      const ctx = await owner();
      const seeded = await seedFullAccount(ctx);

      const requestRes = await ctx.authedAgent("post", "/v1/me/export");
      expect(requestRes.status).toBe(202);
      const { exportId } = requestRes.body as { exportId: string };

      await waitForExportJob(exportId);

      const objectKey = `exports/${ctx.user.id}/${exportId}.json`;
      const body = await storage.getObject(objectKey);
      const parsed = JSON.parse(body.toString());

      expect(() => accountExportSchema.parse(parsed)).not.toThrow();
      expect(parsed.pets.map((p: { id: string }) => p.id)).toEqual([seeded.petId]);
      expect(parsed.checks.map((c: { id: string }) => c.id)).toEqual([seeded.checkId]);
      expect(parsed.healthLogs.map((h: { id: string }) => h.id)).toEqual([seeded.healthLogId]);
      expect(parsed.chatThreads.map((t: { id: string }) => t.id)).toEqual([seeded.threadId]);
    }, JOB_WAIT_TIMEOUT_MS + 10_000);

    it("the bundle contains no data belonging to another household (mutation M4's leak proof)", async () => {
      const ctxA = await owner();
      const seededA = await seedFullAccount(ctxA);

      const ctxB = await owner();
      const seededB = await seedFullAccount(ctxB);

      const requestRes = await ctxA.authedAgent("post", "/v1/me/export");
      expect(requestRes.status).toBe(202);
      const { exportId } = requestRes.body as { exportId: string };
      await waitForExportJob(exportId);

      const objectKey = `exports/${ctxA.user.id}/${exportId}.json`;
      const body = await storage.getObject(objectKey);
      const serialized = body.toString();
      const parsed = JSON.parse(serialized);

      // Positive: the bundle DOES contain exactly A's own seeded rows (not
      // empty/missing -- so the negative assertions below can't be
      // satisfied merely by a hollow bundle).
      expect(parsed.pets.map((p: { id: string }) => p.id)).toEqual([seededA.petId]);
      expect(parsed.checks.map((c: { id: string }) => c.id)).toEqual([seededA.checkId]);
      expect(parsed.user.id).toBe(ctxA.user.id);

      // Negative: never B's ids/email.
      expect(serialized).not.toContain(ctxB.user.id);
      expect(serialized).not.toContain(ctxB.user.email);
      expect(serialized).not.toContain(seededB.petId);
      expect(serialized).not.toContain(seededB.checkId);
    }, JOB_WAIT_TIMEOUT_MS + 10_000);

    it("omits push tokens and raw billing payloads", async () => {
      const ctx = await owner();
      await seedFullAccount(ctx);

      const requestRes = await ctx.authedAgent("post", "/v1/me/export");
      const { exportId } = requestRes.body as { exportId: string };
      await waitForExportJob(exportId);

      const objectKey = `exports/${ctx.user.id}/${exportId}.json`;
      const body = await storage.getObject(objectKey);
      const serialized = body.toString();

      expect(serialized).not.toContain("expoPushToken");
      expect(serialized).not.toContain("ExponentPushToken");
      expect(serialized).not.toContain("rawEventJson");
    }, JOB_WAIT_TIMEOUT_MS + 10_000);

    it("is idempotent while a PENDING export exists: a second POST returns the same exportId", async () => {
      const ctx = await owner();
      let exportId: string;

      // Pauses the QUEUE (not the DB/API) so the first job cannot complete
      // before the second POST runs -- otherwise, for a bare account, the
      // build is fast enough that the race would make this test flaky
      // rather than deterministic.
      await exportQueue.pause();
      try {
        const first = await ctx.authedAgent("post", "/v1/me/export");
        expect(first.status).toBe(202);
        expect(first.body.status).toBe("PENDING");
        exportId = first.body.exportId as string;

        const second = await ctx.authedAgent("post", "/v1/me/export");
        expect(second.status).toBe(202);
        expect(second.body.exportId).toBe(exportId);
      } finally {
        await exportQueue.resume();
      }

      // Let the (now-unblocked) job actually finish -- proves the queue
      // pause above didn't leave a permanently-stuck job/dangling test data.
      await waitForExportJob(exportId);
    }, JOB_WAIT_TIMEOUT_MS + 10_000);
  });
});
