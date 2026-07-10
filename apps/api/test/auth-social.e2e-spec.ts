import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { errorResponseSchema } from "@pawcareright/types";
import { PrismaClient } from "@prisma/client";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import type { JWK, KeyLike } from "jose";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { APPLE_ISSUER, APPLE_JWKS_RESOLVER } from "../src/auth/social/apple-token-verifier";
import { DEFAULT_LOCALE, DEFAULT_REGION } from "../src/auth/auth.constants";

const TEST_AUDIENCE = "com.pawcareright.app"; // APPLE_CLIENT_ID default
const KEY_ID = "e2e-test-key-1";

describe("Auth social (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let signingKey: KeyLike;
  let otherSigningKey: KeyLike;
  const createdUserIds = new Set<string>();

  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    signingKey = privateKey;

    const publicJwk = (await exportJWK(publicKey)) as JWK;
    publicJwk.kid = KEY_ID;
    publicJwk.use = "sig";
    publicJwk.alg = "RS256";

    const localResolver = createLocalJWKSet({ keys: [publicJwk] });

    // A key that is NOT part of the overridden JWKS — simulates a
    // tampered/forged signature.
    const otherPair = await generateKeyPair("RS256");
    otherSigningKey = otherPair.privateKey;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APPLE_JWKS_RESOLVER)
      .useValue(localResolver)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = new PrismaClient();
  });

  afterEach(async () => {
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
    await app.close();
  });

  function uniqueSubject(): string {
    return `apple-${randomUUID()}`;
  }

  function uniqueEmail(): string {
    return `apple-${randomUUID()}@pawcareright.local`;
  }

  async function signAppleToken(options: {
    key?: KeyLike;
    issuer?: string;
    audience?: string;
    subject?: string;
    email?: string;
    emailVerified?: boolean | string;
    expiresInSeconds?: number;
    kid?: string | undefined;
  }): Promise<string> {
    const {
      key = signingKey,
      issuer = APPLE_ISSUER,
      audience = TEST_AUDIENCE,
      subject = uniqueSubject(),
      email,
      emailVerified,
      expiresInSeconds = 3600,
      kid = KEY_ID,
    } = options;

    const claims: Record<string, unknown> = {};
    if (email !== undefined) {
      claims.email = email;
    }
    if (emailVerified !== undefined) {
      claims.email_verified = emailVerified;
    }

    let builder = new SignJWT(claims)
      .setProtectedHeader(kid ? { alg: "RS256", kid } : { alg: "RS256" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(subject)
      .setIssuedAt();

    builder =
      expiresInSeconds < 0
        ? builder.setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
        : builder.setExpirationTime(`${expiresInSeconds}s`);

    return builder.sign(key);
  }

  function postSocial(body: unknown) {
    return request(app.getHttpServer()).post("/v1/auth/social").send(body);
  }

  it("valid Apple token for a new user provisions account + returns a session", async () => {
    const email = uniqueEmail();
    const subject = uniqueSubject();
    const token = await signAppleToken({ subject, email, emailVerified: true });

    const res = await postSocial({ provider: "apple", identityToken: token });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
    expect(typeof res.body.accessToken).toBe("string");
    expect((res.body.accessToken as string).length).toBeGreaterThan(0);
    expect(typeof res.body.refreshToken).toBe("string");
    expect((res.body.refreshToken as string).length).toBeGreaterThan(0);
    expect(typeof res.body.householdId).toBe("string");

    const userId = res.body.user.id as string;
    createdUserIds.add(userId);

    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.appleSub).toBe(subject);
    expect(dbUser?.locale).toBe(DEFAULT_LOCALE);
    expect(dbUser?.region).toBe(DEFAULT_REGION);

    const dbHousehold = await prisma.household.findFirst({ where: { ownerId: userId } });
    expect(dbHousehold).not.toBeNull();
    expect(dbHousehold?.id).toBe(res.body.householdId);

    const dbMembership = await prisma.membership.findFirst({
      where: { userId, householdId: dbHousehold?.id },
    });
    expect(dbMembership).not.toBeNull();
    expect(dbMembership?.role).toBe("OWNER");

    const jwtService = new JwtService();
    const decoded = jwtService.decode(res.body.accessToken as string) as { sub: string };
    expect(decoded.sub).toBe(userId);
  });

  it("tampered token → 401", async () => {
    const token = await signAppleToken({ key: otherSigningKey });

    const res = await postSocial({ provider: "apple", identityToken: token });

    expect(res.status).toBe(401);
    const parsed = errorResponseSchema.parse(res.body);
    expect(parsed.error.code).toBe("UNAUTHORIZED");
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
  });

  it("wrong audience → 401", async () => {
    const token = await signAppleToken({ audience: "com.someone-else.app" });

    const res = await postSocial({ provider: "apple", identityToken: token });

    expect(res.status).toBe(401);
  });

  it("wrong issuer → 401", async () => {
    const token = await signAppleToken({ issuer: "https://not-apple.example.com" });

    const res = await postSocial({ provider: "apple", identityToken: token });

    expect(res.status).toBe(401);
  });

  it("expired token → 401", async () => {
    const token = await signAppleToken({ expiresInSeconds: -3600 });

    const res = await postSocial({ provider: "apple", identityToken: token });

    expect(res.status).toBe(401);
  });

  it("Apple sign-in with an email matching an existing user links, does not duplicate", async () => {
    const email = uniqueEmail();

    const existing = await prisma.user.create({
      data: { email, locale: DEFAULT_LOCALE, region: DEFAULT_REGION },
    });
    const household = await prisma.household.create({
      data: { name: "My Household", ownerId: existing.id },
    });
    await prisma.membership.create({
      data: { userId: existing.id, householdId: household.id, role: "OWNER" },
    });
    createdUserIds.add(existing.id);

    const subject = uniqueSubject();
    const token = await signAppleToken({ subject, email, emailVerified: true });

    const res = await postSocial({ provider: "apple", identityToken: token });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(existing.id);

    const usersWithEmail = await prisma.user.findMany({ where: { email } });
    expect(usersWithEmail).toHaveLength(1);
    expect(usersWithEmail[0]?.appleSub).toBe(subject);

    const jwtService = new JwtService();
    const decoded = jwtService.decode(res.body.accessToken as string) as { sub: string };
    expect(decoded.sub).toBe(existing.id);
  });

  it("same token twice returns the same user (idempotent by sub)", async () => {
    const email = uniqueEmail();
    const subject = uniqueSubject();
    const token = await signAppleToken({ subject, email, emailVerified: true });

    const first = await postSocial({ provider: "apple", identityToken: token });
    expect(first.status).toBe(200);
    createdUserIds.add(first.body.user.id as string);

    const second = await postSocial({ provider: "apple", identityToken: token });
    expect(second.status).toBe(200);
    expect(second.body.user.id).toBe(first.body.user.id);

    const usersWithSub = await prisma.user.findMany({ where: { appleSub: subject } });
    expect(usersWithSub).toHaveLength(1);
  });

  it("new sub with no verified email → 401", async () => {
    const token = await signAppleToken({ subject: uniqueSubject(), emailVerified: false });

    const res = await postSocial({ provider: "apple", identityToken: token });

    expect(res.status).toBe(401);
  });

  it("unknown provider → 400", async () => {
    const res = await postSocial({ provider: "google", identityToken: "x" });

    expect(res.status).toBe(400);
    const parsed = errorResponseSchema.parse(res.body);
    expect(parsed.error.code).toBe("VALIDATION_FAILED");
  });
});
