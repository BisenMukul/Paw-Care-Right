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
import { HouseholdScopedTestController } from "./household-scoped-test.controller";

// Exercises the real global APP_GUARD chain (JwtAuthGuard →
// HouseholdScopeGuard → RolesGuard) against `HouseholdScopedTestController`
// — a test-only route mounted only in this suite's TestingModule, never in
// AppModule / production. Two households, three users:
//   H1: owner (OWNER), member (MEMBER)
//   H2: other (OWNER) — used to prove cross-household access 404s.
describe("Guards (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;

  let ownerId: string;
  let memberId: string;
  let otherId: string;
  let h1Id: string;
  let h2Id: string;

  let ownerToken: string;
  let memberToken: string;
  let otherOwnerToken: string;

  function uniqueEmail(prefix: string): string {
    return `${prefix}-${randomUUID()}@pawcareright.local`;
  }

  function resolveJwtService(nestApp: INestApplication): JwtService {
    try {
      return nestApp.get(JwtService);
    } catch {
      // Falls back to a locally configured instance (same default secret
      // resolution as the app) if root-level DI resolution ever fails.
      return new JwtService({ secret: new AppConfigService().jwtSecret });
    }
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [HouseholdScopedTestController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = new PrismaClient();
    jwtService = resolveJwtService(app);

    const owner = await prisma.user.create({
      data: { email: uniqueEmail("owner"), locale: DEFAULT_LOCALE, region: DEFAULT_REGION },
    });
    const member = await prisma.user.create({
      data: { email: uniqueEmail("member"), locale: DEFAULT_LOCALE, region: DEFAULT_REGION },
    });
    const other = await prisma.user.create({
      data: { email: uniqueEmail("other"), locale: DEFAULT_LOCALE, region: DEFAULT_REGION },
    });
    ownerId = owner.id;
    memberId = member.id;
    otherId = other.id;

    const h1 = await prisma.household.create({ data: { name: "H1", ownerId } });
    const h2 = await prisma.household.create({ data: { name: "H2", ownerId: otherId } });
    h1Id = h1.id;
    h2Id = h2.id;

    await prisma.membership.create({ data: { userId: ownerId, householdId: h1Id, role: "OWNER" } });
    await prisma.membership.create({ data: { userId: memberId, householdId: h1Id, role: "MEMBER" } });
    await prisma.membership.create({ data: { userId: otherId, householdId: h2Id, role: "OWNER" } });

    ownerToken = jwtService.sign({ sub: ownerId });
    memberToken = jwtService.sign({ sub: memberId });
    otherOwnerToken = jwtService.sign({ sub: otherId });
  });

  afterAll(async () => {
    const userIds = [ownerId, memberId, otherId];
    await prisma.membership.deleteMany({ where: { userId: { in: userIds } } });
    // Household.owner is onDelete: Restrict — households must be removed
    // before their owner users.
    await prisma.household.deleteMany({ where: { id: { in: [h1Id, h2Id] } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    await prisma.$disconnect();
    await app.close();
  });

  function getResource(token?: string, householdId: string = h1Id) {
    const req = request(app.getHttpServer()).get(`/v1/__test__/households/${householdId}/resource`);
    return token ? req.set("Authorization", `Bearer ${token}`) : req;
  }

  function deleteResource(token: string, householdId: string = h1Id) {
    return request(app.getHttpServer())
      .delete(`/v1/__test__/households/${householdId}/resource`)
      .set("Authorization", `Bearer ${token}`);
  }

  describe("JwtAuthGuard", () => {
    it("no Authorization header → 401 UNAUTHORIZED", async () => {
      const res = await getResource();

      expect(res.status).toBe(401);
      const parsed = errorResponseSchema.parse(res.body);
      expect(parsed.error.code).toBe("UNAUTHORIZED");
    });

    it("garbage token → 401 UNAUTHORIZED", async () => {
      const res = await getResource("not-a-real-jwt");

      expect(res.status).toBe(401);
      const parsed = errorResponseSchema.parse(res.body);
      expect(parsed.error.code).toBe("UNAUTHORIZED");
    });

    it("expired token → 401 UNAUTHORIZED", async () => {
      const expiredToken = jwtService.sign({ sub: ownerId }, { expiresIn: -10 });

      const res = await getResource(expiredToken);

      expect(res.status).toBe(401);
      const parsed = errorResponseSchema.parse(res.body);
      expect(parsed.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("HouseholdScopeGuard + RolesGuard matrix", () => {
    it("member GET own household → 200 with role MEMBER", async () => {
      const res = await getResource(memberToken);

      expect(res.status).toBe(200);
      expect(res.body.scope.role).toBe("MEMBER");
      expect(res.body.scope.householdId).toBe(h1Id);
      expect(res.body.userId).toBe(memberId);
    });

    it("owner GET own household → 200 with role OWNER", async () => {
      const res = await getResource(ownerToken);

      expect(res.status).toBe(200);
      expect(res.body.scope.role).toBe("OWNER");
      expect(res.body.scope.householdId).toBe(h1Id);
      expect(res.body.userId).toBe(ownerId);
    });

    it("cross-household GET (H2 owner reading H1) → 404 NOT_FOUND, NOT a 403 (no existence leak)", async () => {
      const res = await getResource(otherOwnerToken, h1Id);

      expect(res.status).toBe(404);
      expect(res.status).not.toBe(403);
      const parsed = errorResponseSchema.parse(res.body);
      expect(parsed.error.code).toBe("NOT_FOUND");
    });

    it("member DELETE own household → 403 FORBIDDEN (insufficient role, resource known to exist)", async () => {
      const res = await deleteResource(memberToken);

      expect(res.status).toBe(403);
      const parsed = errorResponseSchema.parse(res.body);
      expect(parsed.error.code).toBe("FORBIDDEN");
    });

    it("owner DELETE own household → 200", async () => {
      const res = await deleteResource(ownerToken);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });

    it("cross-household DELETE (H2 owner deleting on H1) → 404 NOT_FOUND", async () => {
      const res = await deleteResource(otherOwnerToken, h1Id);

      expect(res.status).toBe(404);
      const parsed = errorResponseSchema.parse(res.body);
      expect(parsed.error.code).toBe("NOT_FOUND");
    });
  });

  describe("@Public() non-regression", () => {
    it("GET /v1/health with no token → 200 (unaffected by the global guard chain)", async () => {
      const res = await request(app.getHttpServer()).get("/v1/health");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok", db: "ok", redis: "ok" });
    });
  });
});
