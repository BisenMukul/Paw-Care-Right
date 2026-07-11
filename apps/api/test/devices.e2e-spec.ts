import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { errorResponseSchema } from "@pawcareright/types";
import { PrismaClient } from "@prisma/client";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { DEFAULT_LOCALE, DEFAULT_REGION } from "../src/auth/auth.constants";
import { AppConfigService } from "../src/config/app-config.service";
import { DEVICE_TOKEN_HEADER } from "../src/devices/last-seen.middleware";

describe("Devices (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;

  const userIds: string[] = [];
  const tokens: string[] = [];

  function uniqueEmail(prefix: string): string {
    return `${prefix}-${randomUUID()}@pawcareright.local`;
  }

  function uniqueToken(prefix: string): string {
    return `ExponentPushToken[${prefix}-${randomUUID()}]`;
  }

  function resolveJwtService(nestApp: INestApplication): JwtService {
    try {
      return nestApp.get(JwtService);
    } catch {
      return new JwtService({ secret: new AppConfigService().jwtSecret });
    }
  }

  async function createUser(prefix: string): Promise<{ id: string; bearer: string }> {
    const user = await prisma.user.create({
      data: { email: uniqueEmail(prefix), locale: DEFAULT_LOCALE, region: DEFAULT_REGION },
    });
    userIds.push(user.id);
    const jwt = jwtService.sign({ sub: user.id });
    return { id: user.id, bearer: jwt };
  }

  function registerDevice(bearer: string, expoPushToken: string, platform = "ios") {
    return request(app.getHttpServer())
      .post("/v1/devices")
      .set("Authorization", `Bearer ${bearer}`)
      .send({ expoPushToken, platform });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = new PrismaClient();
    jwtService = resolveJwtService(app);
  });

  afterAll(async () => {
    await prisma.device.deleteMany({ where: { expoPushToken: { in: tokens } } });
    await prisma.device.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    await prisma.$disconnect();
    await app.close();
  });

  it("no Authorization header → 401 UNAUTHORIZED", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/devices")
      .send({ expoPushToken: uniqueToken("noauth"), platform: "ios" });

    expect(res.status).toBe(401);
    const parsed = errorResponseSchema.parse(res.body);
    expect(parsed.error.code).toBe("UNAUTHORIZED");
  });

  it("garbage expoPushToken → 400 VALIDATION_FAILED", async () => {
    const { bearer } = await createUser("garbage");

    const res = await registerDevice(bearer, "not-a-token");

    expect(res.status).toBe(400);
    const parsed = errorResponseSchema.parse(res.body);
    expect(parsed.error.code).toBe("VALIDATION_FAILED");
  });

  it("invalid platform → 400", async () => {
    const { bearer } = await createUser("badplatform");
    const token = uniqueToken("badplatform");
    tokens.push(token);

    const res = await request(app.getHttpServer())
      .post("/v1/devices")
      .set("Authorization", `Bearer ${bearer}`)
      .send({ expoPushToken: token, platform: "windows" });

    expect(res.status).toBe(400);
    const parsed = errorResponseSchema.parse(res.body);
    expect(parsed.error.code).toBe("VALIDATION_FAILED");
  });

  it("parallel register of the same token → all 200, exactly 1 row", async () => {
    const { bearer } = await createUser("parallel");
    const token = uniqueToken("parallel");
    tokens.push(token);

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => registerDevice(bearer, token)),
    );

    for (const res of responses) {
      expect(res.status).toBe(200);
    }
    const count = await prisma.device.count({ where: { expoPushToken: token } });
    expect(count).toBe(1);
  });

  it("re-register same token → same id, lastSeenAt bumped, no duplicate", async () => {
    const { bearer } = await createUser("reregister");
    const token = uniqueToken("reregister");
    tokens.push(token);

    const res1 = await registerDevice(bearer, token);
    expect(res1.status).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 5));

    const res2 = await registerDevice(bearer, token);
    expect(res2.status).toBe(200);
    expect(res2.body.id).toBe(res1.body.id);

    const count = await prisma.device.count({ where: { expoPushToken: token } });
    expect(count).toBe(1);
    expect(new Date(res2.body.lastSeenAt as string).getTime()).toBeGreaterThan(
      new Date(res1.body.lastSeenAt as string).getTime(),
    );
  });

  it("second token same platform prunes the first", async () => {
    const { id: userId, bearer } = await createUser("prune");
    const tokenA = uniqueToken("prune-a");
    const tokenB = uniqueToken("prune-b");
    tokens.push(tokenA, tokenB);

    const resA = await registerDevice(bearer, tokenA, "ios");
    expect(resA.status).toBe(200);

    const resB = await registerDevice(bearer, tokenB, "ios");
    expect(resB.status).toBe(200);

    const count = await prisma.device.count({ where: { userId, platform: "ios" } });
    expect(count).toBe(1);

    const surviving = await prisma.device.findFirst({ where: { userId, platform: "ios" } });
    expect(surviving?.expoPushToken).toBe(tokenB);
  });

  it("token registered to another user is reassigned", async () => {
    const user1 = await createUser("reassign1");
    const user2 = await createUser("reassign2");
    const token = uniqueToken("reassign");
    tokens.push(token);

    const res1 = await registerDevice(user1.bearer, token);
    expect(res1.status).toBe(200);

    const res2 = await registerDevice(user2.bearer, token);
    expect(res2.status).toBe(200);

    const count = await prisma.device.count({ where: { expoPushToken: token } });
    expect(count).toBe(1);

    const device = await prisma.device.findUnique({ where: { expoPushToken: token } });
    expect(device?.userId).toBe(user2.id);
  });

  it("request carrying x-device-token touches lastSeenAt", async () => {
    const { id: userId } = await createUser("lastseen");
    const token = uniqueToken("lastseen");
    tokens.push(token);

    const seededLastSeen = new Date(Date.now() - 60_000);
    await prisma.device.create({
      data: { userId, expoPushToken: token, platform: "ios", lastSeenAt: seededLastSeen },
    });

    await request(app.getHttpServer()).get("/v1/health").set(DEVICE_TOKEN_HEADER, token);

    const deadline = Date.now() + 2000;
    let advanced = false;
    while (Date.now() < deadline) {
      const current = await prisma.device.findUnique({ where: { expoPushToken: token } });
      if (current && current.lastSeenAt.getTime() > seededLastSeen.getTime()) {
        advanced = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(advanced).toBe(true);
  });
});
