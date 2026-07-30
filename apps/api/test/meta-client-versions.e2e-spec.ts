import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { clientVersionsResponseSchema, errorResponseSchema } from "@bombaypetcompany/types";
import { PrismaClient } from "@prisma/client";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { ADMIN_TOKEN_HEADER } from "../src/meta/admin-token.guard";
import { cleanupUsers, createUser as createFactoryUser, overrideCheckRunner, uniqueEmail } from "./factories";

/**
 * T117 step 22: Supertest e2e for `/v1/meta/client-versions` (`configureApp`
 * + `./factories` idiom, mirrors `devices.e2e-spec.ts`/`billing-webhook.e2e-spec.ts`).
 * `ADMIN_API_TOKEN` is set via `process.env` BEFORE the testing module
 * compiles (the `account-privacy.e2e-spec.ts` idiom for env-based config
 * that must differ from its stub-safe default in this one file) and
 * restored in `afterAll` — the endpoint's D6 fail-closed default (empty =
 * closed) means a real, non-empty token must be configured for the happy
 * path to be reachable at all.
 */
describe("GET /v1/meta/client-versions (e2e, T117)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const userIds: string[] = [];
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
    await cleanupUsers(prisma, userIds);
    await prisma.$disconnect();
    await app.close();

    if (originalAdminApiToken === undefined) {
      delete process.env.ADMIN_API_TOKEN;
    } else {
      process.env.ADMIN_API_TOKEN = originalAdminApiToken;
    }
  });

  async function seedDevice(overrides: { appVersion?: string; otaUpdateId?: string } = {}) {
    const user = await createFactoryUser(prisma, { email: uniqueEmail("meta-client-versions") });
    userIds.push(user.id);
    const device = await prisma.device.create({
      data: {
        userId: user.id,
        expoPushToken: `ExponentPushToken[${randomUUID()}]`,
        platform: "ios",
        appVersion: overrides.appVersion ?? "1.2.3",
        otaUpdateId: overrides.otaUpdateId ?? "update-e2e-1",
      },
    });
    return { user, device };
  }

  it("happy 200: schema-valid body, a seeded device row's pair appears with deviceCount >= 1", async () => {
    const { device } = await seedDevice();

    const res = await request(app.getHttpServer())
      .get("/v1/meta/client-versions")
      .set(ADMIN_TOKEN_HEADER, ADMIN_TOKEN);

    expect(res.status).toBe(200);
    const parsed = clientVersionsResponseSchema.parse(res.body);

    const day = device.lastSeenAt.toISOString().slice(0, 10);
    const matchingRow = parsed.rows.find(
      (row) => row.day === day && row.appVersion === "1.2.3" && row.updateId === "update-e2e-1",
    );
    expect(matchingRow).toBeDefined();
    expect(matchingRow!.deviceCount).toBeGreaterThanOrEqual(1);
  });

  it("missing token -> 401 UNAUTHORIZED in the global error shape", async () => {
    const res = await request(app.getHttpServer()).get("/v1/meta/client-versions");

    expect(res.status).toBe(401);
    const parsed = errorResponseSchema.parse(res.body);
    expect(parsed.error.code).toBe("UNAUTHORIZED");
  });

  it("wrong token -> 401 UNAUTHORIZED", async () => {
    const res = await request(app.getHttpServer())
      .get("/v1/meta/client-versions")
      .set(ADMIN_TOKEN_HEADER, "wrong-token");

    expect(res.status).toBe(401);
    const parsed = errorResponseSchema.parse(res.body);
    expect(parsed.error.code).toBe("UNAUTHORIZED");
  });

  it("?days=0 -> 400 VALIDATION_FAILED", async () => {
    const res = await request(app.getHttpServer())
      .get("/v1/meta/client-versions?days=0")
      .set(ADMIN_TOKEN_HEADER, ADMIN_TOKEN);

    expect(res.status).toBe(400);
    const parsed = errorResponseSchema.parse(res.body);
    expect(parsed.error.code).toBe("VALIDATION_FAILED");
  });

  it("?days=abc -> 400 VALIDATION_FAILED", async () => {
    const res = await request(app.getHttpServer())
      .get("/v1/meta/client-versions?days=abc")
      .set(ADMIN_TOKEN_HEADER, ADMIN_TOKEN);

    expect(res.status).toBe(400);
    const parsed = errorResponseSchema.parse(res.body);
    expect(parsed.error.code).toBe("VALIDATION_FAILED");
  });

  it("is read-only: POST/PUT/PATCH/DELETE all 404, and a GET writes nothing (device count + row snapshot unchanged)", async () => {
    const { device } = await seedDevice({ appVersion: "9.9.9", otaUpdateId: "update-readonly-check" });

    const beforeCount = await prisma.device.count();
    const beforeRow = await prisma.device.findUniqueOrThrow({ where: { id: device.id } });

    for (const method of ["post", "put", "patch", "delete"] as const) {
      const res = await request(app.getHttpServer())
        [method]("/v1/meta/client-versions")
        .set(ADMIN_TOKEN_HEADER, ADMIN_TOKEN);
      expect(res.status).toBe(404);
    }

    const getRes = await request(app.getHttpServer())
      .get("/v1/meta/client-versions")
      .set(ADMIN_TOKEN_HEADER, ADMIN_TOKEN);
    expect(getRes.status).toBe(200);

    const afterCount = await prisma.device.count();
    const afterRow = await prisma.device.findUniqueOrThrow({ where: { id: device.id } });

    expect(afterCount).toBe(beforeCount);
    expect(afterRow).toEqual(beforeRow);
  });
});
