import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  adminAuditPageSchema,
  adminKpisResponseSchema,
  adminUserSummarySchema,
  errorResponseSchema,
} from "@bombaypetcompany/types";
import { Prisma, PrismaClient } from "@prisma/client";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { ADMIN_TOKEN_HEADER } from "../src/meta/admin-token.guard";
import {
  cleanupUsers,
  createHousehold,
  createPet,
  createSubscription,
  createUser as createFactoryUser,
  overrideCheckRunner,
  uniqueEmail,
} from "./factories";

/**
 * T111 step 14: Supertest e2e for `/v1/admin/*` (`configureApp` + `./factories`
 * idiom, mirrors `test/meta-client-versions.e2e-spec.ts`). `ADMIN_API_TOKEN`
 * is set via `process.env` BEFORE the testing module compiles and restored
 * in `afterAll` (T117 precedent) -- the shared `AdminTokenGuard`'s D6
 * fail-closed default (empty = closed) means a real, non-empty token must
 * be configured for the happy path to be reachable at all.
 *
 * `AiAuditLog`/`ProcessedWebhookEvent` carry no FK to `User` (loose id
 * references by design -- T090), so `cleanupUsers`'s cascade does not touch
 * them; this suite tracks and deletes its own seeded rows explicitly.
 */
describe("/v1/admin/* (e2e, T111)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const userIds: string[] = [];
  const auditIds: string[] = [];
  const webhookEventIds: string[] = [];
  const ADMIN_TOKEN = "e2e-test-admin-token-not-a-real-secret";
  const originalAdminApiToken = process.env.ADMIN_API_TOKEN;

  beforeAll(async () => {
    process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;

    const moduleRef = await overrideCheckRunner(Test.createTestingModule({ imports: [AppModule] })).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.aiAuditLog.deleteMany({ where: { id: { in: auditIds } } });
    await prisma.processedWebhookEvent.deleteMany({ where: { eventId: { in: webhookEventIds } } });
    await cleanupUsers(prisma, userIds);
    await prisma.$disconnect();
    await app.close();

    if (originalAdminApiToken === undefined) {
      delete process.env.ADMIN_API_TOKEN;
    } else {
      process.env.ADMIN_API_TOKEN = originalAdminApiToken;
    }
  });

  /** Realistic lifecycle: user + household + pet + one DONE + one FALLBACK
   *  check + a device + a Subscription + a ProcessedWebhookEvent + two
   *  AiAuditLog rows. */
  async function seedLifecycle() {
    const user = await createFactoryUser(prisma, { email: uniqueEmail("admin-dashboard") });
    userIds.push(user.id);
    const household = await createHousehold(prisma, user.id);
    const pet = await createPet(prisma, household.id);

    const doneCheck = await prisma.symptomCheck.create({
      data: {
        petId: pet.id,
        createdById: user.id,
        status: "DONE",
        category: "vomiting",
        intakeJson: {} as Prisma.InputJsonValue,
      },
    });
    const fallbackCheck = await prisma.symptomCheck.create({
      data: {
        petId: pet.id,
        createdById: user.id,
        status: "FALLBACK",
        category: "lethargy",
        intakeJson: {} as Prisma.InputJsonValue,
      },
    });

    await prisma.device.create({
      data: {
        userId: user.id,
        expoPushToken: `ExponentPushToken[${randomUUID()}]`,
        platform: "ios",
      },
    });

    await createSubscription(prisma, {
      rcAppUserId: user.id,
      householdId: household.id,
      entitlement: "PREMIUM",
      plan: "bombaypetcompany_monthly",
      status: "active",
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    });

    const webhookEventId = randomUUID();
    webhookEventIds.push(webhookEventId);
    await prisma.processedWebhookEvent.create({ data: { eventId: webhookEventId } });

    const auditRowA = await prisma.aiAuditLog.create({
      data: {
        surface: "CHECK",
        checkId: doneCheck.id,
        promptVersion: "v1",
        modelId: "model-1",
        detectorFlags: [],
        costMicroUsd: 100,
        latencyMs: 500,
        status: "OK",
      },
    });
    const auditRowB = await prisma.aiAuditLog.create({
      data: {
        surface: "CHECK",
        checkId: fallbackCheck.id,
        promptVersion: "v1",
        modelId: "model-1",
        detectorFlags: ["infra_fallback"],
        costMicroUsd: 0,
        status: "SAFE_FALLBACK",
      },
    });
    auditIds.push(auditRowA.id, auditRowB.id);

    return { user, household, pet, doneCheck, fallbackCheck, auditRowA, auditRowB };
  }

  describe("happy path (200, schema-valid)", () => {
    it("GET /v1/admin/kpis -> 200, schema-valid body", async () => {
      await seedLifecycle();

      const res = await request(app.getHttpServer())
        .get("/v1/admin/kpis")
        .set(ADMIN_TOKEN_HEADER, ADMIN_TOKEN);

      expect(res.status).toBe(200);
      adminKpisResponseSchema.parse(res.body);
    });

    it("GET /v1/admin/users/lookup -> 200, schema-valid body, correct counters for the seeded user", async () => {
      const { user } = await seedLifecycle();

      const res = await request(app.getHttpServer())
        .get(`/v1/admin/users/lookup?email=${encodeURIComponent(user.email.toUpperCase())}`)
        .set(ADMIN_TOKEN_HEADER, ADMIN_TOKEN);

      expect(res.status).toBe(200);
      const parsed = adminUserSummarySchema.parse(res.body);
      expect(parsed.userId).toBe(user.id);
      expect(parsed.counters.symptomChecksTotal).toBeGreaterThanOrEqual(2);
      expect(parsed.counters.symptomChecksFallback).toBeGreaterThanOrEqual(1);
      expect(parsed.counters.devices).toBeGreaterThanOrEqual(1);
      expect(parsed.entitlement.entitled).toBe(true);
      expect(parsed.entitlement.source).toBe("own");
    });

    it("GET /v1/admin/ai-audit -> 200, schema-valid body, includes a seeded row with exactly the pinned columns", async () => {
      const { doneCheck } = await seedLifecycle();

      const res = await request(app.getHttpServer())
        .get("/v1/admin/ai-audit?limit=100")
        .set(ADMIN_TOKEN_HEADER, ADMIN_TOKEN);

      expect(res.status).toBe(200);
      const parsed = adminAuditPageSchema.parse(res.body);
      const found = parsed.rows.find((row) => row.checkId === doneCheck.id);
      expect(found).toBeDefined();
      expect(found!.status).toBe("OK");
      expect(new Set(Object.keys(found!))).toEqual(
        new Set([
          "id",
          "surface",
          "checkId",
          "threadId",
          "promptVersion",
          "modelId",
          "detectorFlags",
          "costMicroUsd",
          "latencyMs",
          "status",
          "createdAt",
        ]),
      );
    });
  });

  describe("authz (AC1)", () => {
    const ENDPOINTS = ["/v1/admin/kpis", "/v1/admin/users/lookup?email=x@example.com", "/v1/admin/ai-audit"];

    for (const endpoint of ENDPOINTS) {
      it(`missing token -> 401 UNAUTHORIZED (${endpoint})`, async () => {
        const res = await request(app.getHttpServer()).get(endpoint);
        expect(res.status).toBe(401);
        const parsed = errorResponseSchema.parse(res.body);
        expect(parsed.error.code).toBe("UNAUTHORIZED");
      });

      it(`wrong token -> 401 UNAUTHORIZED (${endpoint})`, async () => {
        const res = await request(app.getHttpServer()).get(endpoint).set(ADMIN_TOKEN_HEADER, "wrong-token");
        expect(res.status).toBe(401);
        const parsed = errorResponseSchema.parse(res.body);
        expect(parsed.error.code).toBe("UNAUTHORIZED");
      });
    }
  });

  describe("validation (400)", () => {
    it("?days=0 -> 400 VALIDATION_FAILED", async () => {
      const res = await request(app.getHttpServer())
        .get("/v1/admin/kpis?days=0")
        .set(ADMIN_TOKEN_HEADER, ADMIN_TOKEN);
      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("?days=abc -> 400 VALIDATION_FAILED", async () => {
      const res = await request(app.getHttpServer())
        .get("/v1/admin/kpis?days=abc")
        .set(ADMIN_TOKEN_HEADER, ADMIN_TOKEN);
      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("?limit=101 -> 400 VALIDATION_FAILED", async () => {
      const res = await request(app.getHttpServer())
        .get("/v1/admin/ai-audit?limit=101")
        .set(ADMIN_TOKEN_HEADER, ADMIN_TOKEN);
      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("an unknown cursor id -> 400 VALIDATION_FAILED (never a 500)", async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/admin/ai-audit?cursor=${randomUUID()}`)
        .set(ADMIN_TOKEN_HEADER, ADMIN_TOKEN);
      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("not found (404)", () => {
    it("an unknown email -> 404 NOT_FOUND", async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/admin/users/lookup?email=${uniqueEmail("nobody")}`)
        .set(ADMIN_TOKEN_HEADER, ADMIN_TOKEN);
      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });
  });

  describe("pagination (AC2)", () => {
    it("?limit=1 returns exactly one row and a non-null nextCursor; following the cursor returns the next distinct row in createdAt-desc order", async () => {
      await seedLifecycle();
      await seedLifecycle();

      const firstRes = await request(app.getHttpServer())
        .get("/v1/admin/ai-audit?limit=1")
        .set(ADMIN_TOKEN_HEADER, ADMIN_TOKEN);
      expect(firstRes.status).toBe(200);
      const firstPage = adminAuditPageSchema.parse(firstRes.body);
      expect(firstPage.rows).toHaveLength(1);
      expect(firstPage.nextCursor).not.toBeNull();

      const secondRes = await request(app.getHttpServer())
        .get(`/v1/admin/ai-audit?limit=1&cursor=${firstPage.nextCursor}`)
        .set(ADMIN_TOKEN_HEADER, ADMIN_TOKEN);
      expect(secondRes.status).toBe(200);
      const secondPage = adminAuditPageSchema.parse(secondRes.body);
      expect(secondPage.rows).toHaveLength(1);
      expect(secondPage.rows[0]!.id).not.toBe(firstPage.rows[0]!.id);

      const firstCreatedAt = new Date(firstPage.rows[0]!.createdAt).getTime();
      const secondCreatedAt = new Date(secondPage.rows[0]!.createdAt).getTime();
      expect(firstCreatedAt).toBeGreaterThanOrEqual(secondCreatedAt);
    });
  });

  describe("read-only proof (AC3, runtime)", () => {
    const ENDPOINTS = ["/v1/admin/kpis", "/v1/admin/users/lookup", "/v1/admin/ai-audit"];

    for (const endpoint of ENDPOINTS) {
      it(`${endpoint}: POST/PUT/PATCH/DELETE all 404`, async () => {
        for (const method of ["post", "put", "patch", "delete"] as const) {
          const res = await request(app.getHttpServer())[method](endpoint).set(ADMIN_TOKEN_HEADER, ADMIN_TOKEN);
          expect(res.status).toBe(404);
        }
      });
    }

    // Row-snapshot equality on THIS test's own seeded rows (id-scoped),
    // rather than whole-table `.count()` (the T117
    // `meta-client-versions.e2e-spec.ts` idiom): this suite runs against a
    // shared dev/CI Postgres alongside every other *.e2e-spec.ts file in
    // the same `pnpm --filter api test` run, and jest runs spec files in
    // parallel worker processes -- a global `user`/`symptomCheck` count can
    // (and, empirically, does) shift between the "before" and "after" reads
    // purely from unrelated concurrent suites seeding their own fixtures,
    // which would make this assertion flaky for reasons that have nothing
    // to do with whether the admin routes themselves ever write. Snapshotting
    // this test's own rows by id is strictly more precise (still fails if
    // an admin route mutates ANY column of ANY of these rows) and immune to
    // that unrelated concurrency.
    it("a full GET sweep across all three endpoints leaves this test's own seeded rows byte-identical (id-scoped, immune to concurrent e2e suites sharing the dev DB)", async () => {
      const { user, doneCheck, fallbackCheck, auditRowA, auditRowB } = await seedLifecycle();

      const [subscriptionBefore, userBefore, doneCheckBefore, fallbackCheckBefore, auditRowABefore, auditRowBBefore] =
        await Promise.all([
          prisma.subscription.findUniqueOrThrow({ where: { rcAppUserId: user.id } }),
          prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
          prisma.symptomCheck.findUniqueOrThrow({ where: { id: doneCheck.id } }),
          prisma.symptomCheck.findUniqueOrThrow({ where: { id: fallbackCheck.id } }),
          prisma.aiAuditLog.findUniqueOrThrow({ where: { id: auditRowA.id } }),
          prisma.aiAuditLog.findUniqueOrThrow({ where: { id: auditRowB.id } }),
        ]);

      for (const endpoint of ENDPOINTS) {
        const res = await request(app.getHttpServer())
          .get(endpoint.includes("lookup") ? `${endpoint}?email=nobody@example.com` : endpoint)
          .set(ADMIN_TOKEN_HEADER, ADMIN_TOKEN);
        expect([200, 404]).toContain(res.status);
      }

      const [subscriptionAfter, userAfter, doneCheckAfter, fallbackCheckAfter, auditRowAAfter, auditRowBAfter] =
        await Promise.all([
          prisma.subscription.findUniqueOrThrow({ where: { rcAppUserId: user.id } }),
          prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
          prisma.symptomCheck.findUniqueOrThrow({ where: { id: doneCheck.id } }),
          prisma.symptomCheck.findUniqueOrThrow({ where: { id: fallbackCheck.id } }),
          prisma.aiAuditLog.findUniqueOrThrow({ where: { id: auditRowA.id } }),
          prisma.aiAuditLog.findUniqueOrThrow({ where: { id: auditRowB.id } }),
        ]);

      expect(subscriptionAfter).toEqual(subscriptionBefore);
      expect(userAfter).toEqual(userBefore);
      expect(doneCheckAfter).toEqual(doneCheckBefore);
      expect(fallbackCheckAfter).toEqual(fallbackCheckBefore);
      expect(auditRowAAfter).toEqual(auditRowABefore);
      expect(auditRowBAfter).toEqual(auditRowBBefore);
    });
  });
});
