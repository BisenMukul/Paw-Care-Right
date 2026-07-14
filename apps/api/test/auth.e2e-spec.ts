import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { errorResponseSchema } from "@pawcareright/types";
import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { OTP_MAX_ATTEMPTS, RATE_LIMIT_MAX } from "../src/auth/auth.constants";
import { OTP_TRANSPORT, type OtpTransport } from "../src/auth/otp-transport";
import { AppConfigService } from "../src/config/app-config.service";
import { overrideCheckRunner } from "./factories";

class CapturingOtpTransport implements OtpTransport {
  private readonly codes = new Map<string, string>();

  sendOtp(email: string, code: string): void {
    this.codes.set(email.trim().toLowerCase(), code);
  }

  lastCodeFor(email: string): string {
    const code = this.codes.get(email.trim().toLowerCase());
    if (!code) {
      throw new Error(`no OTP code captured for ${email}`);
    }
    return code;
  }
}

// Returns a 6-digit code guaranteed to differ from `correctCode`.
function wrongCodeFor(correctCode: string): string {
  const wrongNumber = (Number(correctCode) + 1) % 1_000_000;
  return String(wrongNumber).padStart(6, "0");
}

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let redis: Redis;
  let transport: CapturingOtpTransport;
  const createdUserIds = new Set<string>();

  beforeAll(async () => {
    transport = new CapturingOtpTransport();

    const moduleRef = await overrideCheckRunner(
      Test.createTestingModule({ imports: [AppModule] }).overrideProvider(OTP_TRANSPORT).useValue(transport),
    ).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = new PrismaClient();
    redis = new Redis(new AppConfigService().redisUrl);
  });

  beforeEach(async () => {
    // Isolate the per-IP rate-limit counter across tests — supertest can't
    // vary the request IP, so every test would otherwise share one counter.
    const rateLimitKeys = await redis.keys("pawcareright:rl:*");
    if (rateLimitKeys.length > 0) {
      await redis.del(...rateLimitKeys);
    }
  });

  afterEach(async () => {
    const otpKeys = await redis.keys("pawcareright:otp:*");
    if (otpKeys.length > 0) {
      await redis.del(...otpKeys);
    }

    for (const userId of createdUserIds) {
      // Household.owner is onDelete: Restrict — households (and anything
      // FK'd to the user) must be removed before the user row.
      await prisma.membership.deleteMany({ where: { userId } });
      await prisma.refreshToken.deleteMany({ where: { userId } });
      await prisma.household.deleteMany({ where: { ownerId: userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    createdUserIds.clear();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await redis.quit();
    await app.close();
  });

  function uniqueEmail(): string {
    return `otp-${randomUUID()}@pawcareright.local`;
  }

  async function requestAndCapture(email: string): Promise<string> {
    const res = await request(app.getHttpServer()).post("/v1/auth/otp/request").send({ email });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    return transport.lastCodeFor(email);
  }

  it("happy path: request → verify provisions user+household → tokens → refresh", async () => {
    const email = uniqueEmail();
    const code = await requestAndCapture(email);

    const verifyRes = await request(app.getHttpServer())
      .post("/v1/auth/otp/verify")
      .send({ email, code });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.user.email).toBe(email);
    expect(typeof verifyRes.body.accessToken).toBe("string");
    expect((verifyRes.body.accessToken as string).length).toBeGreaterThan(0);
    expect(typeof verifyRes.body.refreshToken).toBe("string");
    expect((verifyRes.body.refreshToken as string).length).toBeGreaterThan(0);
    expect(typeof verifyRes.body.householdId).toBe("string");

    const userId = verifyRes.body.user.id as string;
    createdUserIds.add(userId);

    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(dbUser).not.toBeNull();

    const dbHousehold = await prisma.household.findFirst({ where: { ownerId: userId } });
    expect(dbHousehold).not.toBeNull();
    const householdId = dbHousehold?.id;
    if (householdId === undefined) {
      throw new Error("expected a household id");
    }
    expect(householdId).toBe(verifyRes.body.householdId);

    const dbMembership = await prisma.membership.findFirst({
      where: { userId, householdId },
    });
    expect(dbMembership).not.toBeNull();
    expect(dbMembership?.role).toBe("OWNER");

    const jwtService = new JwtService();
    const decoded = jwtService.decode(verifyRes.body.accessToken as string) as { sub: string };
    expect(decoded.sub).toBe(userId);

    const refreshRes = await request(app.getHttpServer())
      .post("/v1/auth/refresh")
      .send({ refreshToken: verifyRes.body.refreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.refreshToken).not.toBe(verifyRes.body.refreshToken);
  });

  it("wrong code → 401", async () => {
    const email = uniqueEmail();
    const code = await requestAndCapture(email);

    const res = await request(app.getHttpServer())
      .post("/v1/auth/otp/verify")
      .send({ email, code: wrongCodeFor(code) });

    expect(res.status).toBe(401);
    const parsed = errorResponseSchema.parse(res.body);
    expect(parsed.error.code).toBe("UNAUTHORIZED");
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
  });

  it("attempt cap: correct code after MAX wrong attempts → 401", async () => {
    const email = uniqueEmail();
    const code = await requestAndCapture(email);
    const wrongCode = wrongCodeFor(code);

    for (let attempt = 0; attempt < OTP_MAX_ATTEMPTS; attempt += 1) {
      const res = await request(app.getHttpServer())
        .post("/v1/auth/otp/verify")
        .send({ email, code: wrongCode });
      expect(res.status).toBe(401);
    }

    const finalRes = await request(app.getHttpServer())
      .post("/v1/auth/otp/verify")
      .send({ email, code });

    expect(finalRes.status).toBe(401);
  });

  it("expired code → 401", async () => {
    const email = uniqueEmail();
    const code = await requestAndCapture(email);

    // Simulate TTL expiry by deleting the OTP record directly.
    const otpKeys = await redis.keys("pawcareright:otp:*");
    if (otpKeys.length > 0) {
      await redis.del(...otpKeys);
    }

    const res = await request(app.getHttpServer())
      .post("/v1/auth/otp/verify")
      .send({ email, code });

    expect(res.status).toBe(401);
  });

  it("rotation: reusing a rotated refresh token revokes the family", async () => {
    const email = uniqueEmail();
    const code = await requestAndCapture(email);
    const verifyRes = await request(app.getHttpServer())
      .post("/v1/auth/otp/verify")
      .send({ email, code });
    createdUserIds.add(verifyRes.body.user.id as string);

    const refreshToken1 = verifyRes.body.refreshToken as string;

    const refresh1 = await request(app.getHttpServer())
      .post("/v1/auth/refresh")
      .send({ refreshToken: refreshToken1 });
    expect(refresh1.status).toBe(200);
    const refreshToken2 = refresh1.body.refreshToken as string;

    const reuse1 = await request(app.getHttpServer())
      .post("/v1/auth/refresh")
      .send({ refreshToken: refreshToken1 });
    expect(reuse1.status).toBe(401);

    const reuse2 = await request(app.getHttpServer())
      .post("/v1/auth/refresh")
      .send({ refreshToken: refreshToken2 });
    expect(reuse2.status).toBe(401);
  });

  it("logout revokes the token family", async () => {
    const email = uniqueEmail();
    const code = await requestAndCapture(email);
    const verifyRes = await request(app.getHttpServer())
      .post("/v1/auth/otp/verify")
      .send({ email, code });
    createdUserIds.add(verifyRes.body.user.id as string);

    const refreshToken = verifyRes.body.refreshToken as string;

    const logoutRes = await request(app.getHttpServer())
      .post("/v1/auth/logout")
      .send({ refreshToken });
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body).toEqual({ ok: true });

    const refreshRes = await request(app.getHttpServer())
      .post("/v1/auth/refresh")
      .send({ refreshToken });
    expect(refreshRes.status).toBe(401);

    const randomLogoutRes = await request(app.getHttpServer())
      .post("/v1/auth/logout")
      .send({ refreshToken: randomUUID() });
    expect(randomLogoutRes.status).toBe(200);
    expect(randomLogoutRes.body).toEqual({ ok: true });
  });

  it("6th otp/request from same IP → 429", async () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i += 1) {
      const res = await request(app.getHttpServer())
        .post("/v1/auth/otp/request")
        .send({ email: uniqueEmail() });
      expect(res.status).toBe(200);
    }

    const overflowRes = await request(app.getHttpServer())
      .post("/v1/auth/otp/request")
      .send({ email: uniqueEmail() });

    expect(overflowRes.status).toBe(429);
    const parsed = errorResponseSchema.parse(overflowRes.body);
    expect(parsed.error.code).toBe("RATE_LIMITED");
    expect(overflowRes.headers["retry-after"]).toBeDefined();
  });
});
