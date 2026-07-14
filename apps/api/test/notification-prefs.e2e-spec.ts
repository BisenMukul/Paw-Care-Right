import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { errorResponseSchema } from "@pawcareright/types";
import { PrismaClient } from "@prisma/client";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import {
  cleanupUsers,
  createUser as createFactoryUser,
  mintAccessToken,
  overrideCheckRunner,
  resolveJwtService,
  uniqueEmail,
} from "./factories";

describe("Notification prefs (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;

  const userIds: string[] = [];

  async function createUser(prefix: string): Promise<{ id: string; bearer: string }> {
    const user = await createFactoryUser(prisma, { email: uniqueEmail(prefix) });
    userIds.push(user.id);
    const bearer = mintAccessToken(jwtService, user.id);
    return { id: user.id, bearer };
  }

  function getPrefs(bearer: string) {
    return request(app.getHttpServer()).get("/v1/me/notification-prefs").set("Authorization", `Bearer ${bearer}`);
  }

  function putPrefs(bearer: string, body: unknown) {
    return request(app.getHttpServer())
      .put("/v1/me/notification-prefs")
      .set("Authorization", `Bearer ${bearer}`)
      .send(body);
  }

  beforeAll(async () => {
    const moduleRef = await overrideCheckRunner(Test.createTestingModule({ imports: [AppModule] })).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = new PrismaClient();
    jwtService = resolveJwtService(app);
  });

  afterAll(async () => {
    await cleanupUsers(prisma, userIds);

    await prisma.$disconnect();
    await app.close();
  });

  it("no Authorization header on GET -> 401 UNAUTHORIZED", async () => {
    const res = await request(app.getHttpServer()).get("/v1/me/notification-prefs");

    expect(res.status).toBe(401);
    const parsed = errorResponseSchema.parse(res.body);
    expect(parsed.error.code).toBe("UNAUTHORIZED");
  });

  it("no Authorization header on PUT -> 401 UNAUTHORIZED", async () => {
    const res = await request(app.getHttpServer())
      .put("/v1/me/notification-prefs")
      .send({ disabledTypes: [], quietHours: null });

    expect(res.status).toBe(401);
    const parsed = errorResponseSchema.parse(res.body);
    expect(parsed.error.code).toBe("UNAUTHORIZED");
  });

  it("GET returns defaults for a fresh user (no row yet)", async () => {
    const { bearer } = await createUser("fresh");

    const res = await getPrefs(bearer);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ disabledTypes: [], quietHours: null });
  });

  it("PUT then GET round-trips disabledTypes + quietHours", async () => {
    const { bearer } = await createUser("roundtrip");
    const payload = {
      disabledTypes: ["VACCINE", "CUSTOM"],
      quietHours: { start: "22:00", end: "07:00", timezone: "America/New_York" },
    };

    const putRes = await putPrefs(bearer, payload);
    expect(putRes.status).toBe(200);
    expect(putRes.body).toEqual(payload);

    const getRes = await getPrefs(bearer);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual(payload);
  });

  it("PUT with quietHours: null clears a previously-set window", async () => {
    const { bearer } = await createUser("clear");
    await putPrefs(bearer, {
      disabledTypes: [],
      quietHours: { start: "22:00", end: "07:00", timezone: "America/New_York" },
    });

    const res = await putPrefs(bearer, { disabledTypes: [], quietHours: null });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ disabledTypes: [], quietHours: null });
  });

  it("PUT with a bad HH:mm -> 400 VALIDATION_FAILED", async () => {
    const { bearer } = await createUser("badtime");

    const res = await putPrefs(bearer, {
      disabledTypes: [],
      quietHours: { start: "25:00", end: "07:00", timezone: "America/New_York" },
    });

    expect(res.status).toBe(400);
    const parsed = errorResponseSchema.parse(res.body);
    expect(parsed.error.code).toBe("VALIDATION_FAILED");
  });

  it("PUT with an unknown reminder type -> 400 VALIDATION_FAILED", async () => {
    const { bearer } = await createUser("badtype");

    const res = await putPrefs(bearer, { disabledTypes: ["NOT_A_TYPE"], quietHours: null });

    expect(res.status).toBe(400);
    const parsed = errorResponseSchema.parse(res.body);
    expect(parsed.error.code).toBe("VALIDATION_FAILED");
  });

  it("PUT with a partial (malformed) quietHours -> 400 VALIDATION_FAILED", async () => {
    const { bearer } = await createUser("partialquiet");

    const res = await putPrefs(bearer, { disabledTypes: [], quietHours: { start: "22:00" } });

    expect(res.status).toBe(400);
    const parsed = errorResponseSchema.parse(res.body);
    expect(parsed.error.code).toBe("VALIDATION_FAILED");
  });
});
