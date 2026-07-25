import { getQueueToken } from "@nestjs/bullmq";
import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import type { Queue } from "bullmq";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import type { ChecksJobData } from "../src/checks/checks.contract";
import { CHECKS_QUEUE } from "../src/checks/checks.contract";
import { cleanupUsers, createOwnerContext, createPet, overrideCheckRunner, resolveJwtService, type AuthedContext } from "./factories";

/**
 * T090 plan §2.1/§5 — per-route rate classes + the mandatory §5 exemption
 * proof, real Postgres + real Redis/BullMQ (`CheckRunnerProcessor` no-op'd,
 * same posture as `checks.e2e-spec.ts`). ONE shared app instance/`beforeAll`
 * for the whole file (R10 isolation note): `@nestjs/throttler@6.5.0`'s
 * `ThrottlerGuard.generateKey` is `sha256(ControllerClass.name +
 * handlerMethod.name + throttlerName + tracker)` (verified directly against
 * the installed dist) — every controller METHOD gets its own independent
 * counter bucket, even under the same named `default` throttler and even
 * the same client IP. Each `it()` below therefore drives requests at a
 * DISTINCT handler (never re-visited by any other case in this file), so no
 * cross-case bucket pollution is possible and no per-case app/module
 * overrides or `X-Forwarded-For` tricks are needed.
 */
describe("Rate limits + §5 exemption (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;
  let queue: Queue<ChecksJobData>;

  const userIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await overrideCheckRunner(Test.createTestingModule({ imports: [AppModule] })).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = new PrismaClient();
    jwtService = resolveJwtService(app);
    queue = app.get(getQueueToken(CHECKS_QUEUE));
  }, 60_000);

  afterAll(async () => {
    await cleanupUsers(prisma, userIds);
    await queue.obliterate({ force: true });
    await queue.close();
    await prisma.$disconnect();
    await app.close();
  });

  const owner = (): Promise<AuthedContext> => createOwnerContext(app, prisma, jwtService, userIds);

  function redFlagIntake(): Record<string, unknown> {
    return {
      category: "breathing",
      answers: [
        { questionId: "onset", type: "duration", value: 10, unit: "minutes" },
        { questionId: "character", type: "single", value: "gasping" },
        { questionId: "gum-color", type: "single", value: "pink" },
        { questionId: "energy", type: "scale", value: 1 },
      ],
    };
  }

  describe("THROTTLE_AUTH — POST /auth/otp/verify", () => {
    // Regression case (T090 follow-up): `auth.e2e-spec.ts` and
    // `auth-social.e2e-spec.ts` were updated to reset `ThrottlerGuard`'s
    // in-memory storage between their own test cases (they were never
    // designed around a per-route request-count limit on this route). This
    // case proves the control itself is still fully live in a real,
    // unresetted 60s window: the 6th `verifyOtp` request in a row -> 429.
    it("the 6th request within the window returns 429 (control is live despite the resets applied elsewhere)", async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 6; i += 1) {
        const res = await request(app.getHttpServer())
          .post("/v1/auth/otp/verify")
          .send({ email: "nobody@pawcareright.local", code: "000000" });
        statuses.push(res.status);
      }

      for (const status of statuses.slice(0, 5)) {
        expect(status).not.toBe(429);
      }
      expect(statuses[5]).toBe(429);
    }, 30_000);
  });

  describe("THROTTLE_AUTH_REFRESH — POST /auth/refresh", () => {
    it("tolerates 30 requests before 429 (a distinct, looser class from THROTTLE_AUTH)", async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 31; i += 1) {
        const res = await request(app.getHttpServer()).post("/v1/auth/refresh").send({ refreshToken: "not-a-real-token" });
        statuses.push(res.status);
      }

      for (const status of statuses.slice(0, 30)) {
        expect(status).not.toBe(429);
      }
      expect(statuses[30]).toBe(429);
    }, 30_000);
  });

  describe("THROTTLE_AI_WRITE — POST /chat/threads/:id/messages", () => {
    it("returns 429 after 20 requests", async () => {
      const ctx = await owner();
      const statuses: number[] = [];
      for (let i = 0; i < 21; i += 1) {
        const res = await ctx
          .authedAgent("post", "/v1/chat/threads/nonexistent-thread/messages")
          .send({ content: "hello" });
        statuses.push(res.status);
      }

      for (const status of statuses.slice(0, 20)) {
        expect(status).not.toBe(429);
        expect(status).toBe(404); // thread lookup 404s before feature-lock/quota — deterministic, consistent status.
      }
      expect(statuses[20]).toBe(429);
    }, 30_000);
  });

  describe("§5 mandatory exemption — POST /pets/:petId/checks", () => {
    it("is never rate-limited: a red-flag check still returns 201 with redFlag after well over THROTTLE_DEFAULT's limit", async () => {
      const ctx = await owner();
      const petId = (await createPet(prisma, ctx.household.id)).id;

      const REQUEST_COUNT = 105; // > THROTTLE_DEFAULT.limit (100)
      let lastRes: { status: number; body: Record<string, unknown> } | undefined;
      for (let i = 0; i < REQUEST_COUNT; i += 1) {
        const res = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: redFlagIntake() });
        expect(res.status).not.toBe(429);
        expect(res.status).toBe(201);
        lastRes = res;
      }

      expect(lastRes?.status).toBe(201);
      expect((lastRes?.body as { redFlag?: unknown }).redFlag).toBeDefined();
    }, 60_000);
  });

  describe("§5 mandatory exemption — GET /checks/:id and POST /checks/:id/followup", () => {
    it("are never rate-limited", async () => {
      const ctx = await owner();

      for (let i = 0; i < 105; i += 1) {
        const res = await ctx.authedAgent("get", "/v1/checks/nonexistent-check-id");
        expect(res.status).not.toBe(429);
        expect(res.status).toBe(404);
      }

      for (let i = 0; i < 105; i += 1) {
        const res = await ctx
          .authedAgent("post", "/v1/checks/nonexistent-check-id/followup")
          .send({ response: "same" });
        expect(res.status).not.toBe(429);
        expect(res.status).toBe(404);
      }
    }, 60_000);
  });

  describe("GET /pets/:petId/checks is NOT skip-throttled", () => {
    it("429s once its own THROTTLE_DEFAULT window is saturated", async () => {
      const ctx = await owner();
      const petId = (await createPet(prisma, ctx.household.id)).id;

      const statuses: number[] = [];
      for (let i = 0; i < 101; i += 1) {
        const res = await ctx.authedAgent("get", `/v1/pets/${petId}/checks`);
        statuses.push(res.status);
      }

      for (const status of statuses.slice(0, 100)) {
        expect(status).not.toBe(429);
      }
      expect(statuses[100]).toBe(429);
    }, 60_000);
  });
});
