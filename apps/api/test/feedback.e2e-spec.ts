import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { errorResponseSchema } from "@bombaypetcompany/types";
import { PrismaClient } from "@prisma/client";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { StorageService } from "../src/storage/storage.service";
import {
  cleanupUsers,
  createOwnerContext,
  overrideCheckRunner,
  resolveJwtService,
  type AuthedContext,
} from "./factories";

/**
 * Real Postgres + real MinIO round-trip for T104 in-app feedback (AC1/AC2).
 * Nothing mocked -- mirrors `photos.e2e-spec.ts`/`account-privacy.e2e-spec.ts`'s
 * harness shape.
 */
describe("Feedback (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;
  let storage: StorageService;

  const userIds: string[] = [];
  const objectKeysToCleanup: string[] = [];

  beforeAll(async () => {
    const moduleRef = await overrideCheckRunner(Test.createTestingModule({ imports: [AppModule] })).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = new PrismaClient();
    jwtService = resolveJwtService(app);
    storage = app.get(StorageService);

    await storage.ensureBucket();
  });

  afterAll(async () => {
    for (const key of objectKeysToCleanup) {
      await storage.deleteObject(key).catch(() => undefined);
    }
    await prisma.feedbackReport.deleteMany({ where: { userId: { in: userIds } } });
    await cleanupUsers(prisma, userIds);
    await prisma.$disconnect();
    await app.close();
  });

  const owner = (): Promise<AuthedContext> => createOwnerContext(app, prisma, jwtService, userIds);

  describe("unauthenticated", () => {
    it("POST /v1/feedback/screenshot-upload-url with no token -> 401 UNAUTHORIZED", async () => {
      const res = await request(app.getHttpServer()).post("/v1/feedback/screenshot-upload-url").send({});

      expect(res.status).toBe(401);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
    });

    it("POST /v1/feedback with no token -> 401 UNAUTHORIZED", async () => {
      const res = await request(app.getHttpServer()).post("/v1/feedback").send({
        category: "BUG",
        message: "no auth",
        platform: "ios",
        appVersion: "1.0.0",
        attachLogs: false,
      });

      expect(res.status).toBe(401);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("validation", () => {
    it("rejects an over-long message with 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();

      const res = await ctx.authedAgent("post", "/v1/feedback").send({
        category: "BUG",
        message: "a".repeat(2001),
        platform: "ios",
        appVersion: "1.0.0",
        attachLogs: false,
      });

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("rejects an unknown body key with 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();

      const res = await ctx.authedAgent("post", "/v1/feedback").send({
        category: "BUG",
        message: "hi",
        platform: "ios",
        appVersion: "1.0.0",
        attachLogs: false,
        unknownField: "nope",
      });

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("AC2: consent required before log attach (server-side)", () => {
    it("rejects logs submitted without consent (attachLogs:false + logs[]) with 400, persists no row", async () => {
      const ctx = await owner();

      const before = await prisma.feedbackReport.count({ where: { userId: ctx.user.id } });

      const res = await ctx.authedAgent("post", "/v1/feedback").send({
        category: "BUG",
        message: "unconsented logs",
        platform: "ios",
        appVersion: "1.0.0",
        attachLogs: false,
        logs: [{ at: new Date().toISOString(), level: "error", code: "captured_error" }],
      });

      expect(res.status).toBe(400);

      const after = await prisma.feedbackReport.count({ where: { userId: ctx.user.id } });
      expect(after).toBe(before);
    });

    it("accepts logs when attachLogs:true and persists them", async () => {
      const ctx = await owner();

      const res = await ctx.authedAgent("post", "/v1/feedback").send({
        category: "BUG",
        message: "consented logs",
        platform: "android",
        appVersion: "1.0.0",
        attachLogs: true,
        logs: [{ at: new Date().toISOString(), level: "warn", code: "startup_nonfatal" }],
      });

      expect(res.status).toBe(201);

      const row = await prisma.feedbackReport.findUniqueOrThrow({ where: { id: res.body.reportId as string } });
      expect(row.logsConsent).toBe(true);
      expect(row.logs).toEqual([{ at: expect.any(String), level: "warn", code: "startup_nonfatal" }]);
    });
  });

  describe("AC1: report round-trip", () => {
    it("round-trips a report with a screenshot: presign -> PUT to MinIO -> POST /v1/feedback -> row readable", async () => {
      const ctx = await owner();

      const presignRes = await ctx.authedAgent("post", "/v1/feedback/screenshot-upload-url").send({});
      expect(presignRes.status).toBe(200);
      const { uploadUrl, key } = presignRes.body as { uploadUrl: string; key: string };
      expect(key.startsWith(`feedback/${ctx.user.id}/`)).toBe(true);
      objectKeysToCleanup.push(key);

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: Buffer.from("fake-jpeg-bytes"),
        headers: { "Content-Type": "image/jpeg" },
      });
      expect(putRes.ok).toBe(true);

      const submitRes = await ctx.authedAgent("post", "/v1/feedback").send({
        category: "IDEA",
        message: "It would be great to add dark mode.",
        platform: "ios",
        appVersion: "2.3.1",
        attachLogs: false,
        screenshotKey: key,
        sentryEventId: "a".repeat(32),
        sentryRelease: "bombaypetcompany@2.3.1+abc1234",
      });

      expect(submitRes.status).toBe(201);
      const { reportId } = submitRes.body as { reportId: string };
      expect(typeof reportId).toBe("string");

      const row = await prisma.feedbackReport.findUniqueOrThrow({ where: { id: reportId } });
      expect(row.userId).toBe(ctx.user.id);
      expect(row.category).toBe("IDEA");
      expect(row.message).toBe("It would be great to add dark mode.");
      expect(row.platform).toBe("ios");
      expect(row.appVersion).toBe("2.3.1");
      expect(row.screenshotKey).toBe(key);
      expect(row.sentryEventId).toBe("a".repeat(32));
      expect(row.logsConsent).toBe(false);
      expect(row.logs).toEqual([]);
    });

    it("a screenshotKey outside the caller's own feedback namespace -> 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();

      const res = await ctx.authedAgent("post", "/v1/feedback").send({
        category: "BUG",
        message: "cross-user key",
        platform: "ios",
        appVersion: "1.0.0",
        attachLogs: false,
        screenshotKey: "feedback/some-other-user/x.jpg",
      });

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("a well-formed but never-uploaded screenshotKey -> 404 NOT_FOUND", async () => {
      const ctx = await owner();
      const key = `feedback/${ctx.user.id}/never-uploaded.jpg`;

      const res = await ctx.authedAgent("post", "/v1/feedback").send({
        category: "BUG",
        message: "never uploaded",
        platform: "ios",
        appVersion: "1.0.0",
        attachLogs: false,
        screenshotKey: key,
      });

      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });
  });
});
