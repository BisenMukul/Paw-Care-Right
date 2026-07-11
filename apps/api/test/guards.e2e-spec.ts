import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { errorResponseSchema } from "@pawcareright/types";
import { PrismaClient } from "@prisma/client";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { HouseholdScopedTestController } from "./household-scoped-test.controller";
import {
  addMembership,
  cleanupUsers,
  createHousehold,
  createUser,
  mintAccessToken,
  resolveJwtService,
} from "./factories";

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

  let ownerToken: string;
  let memberToken: string;
  let otherOwnerToken: string;

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

    const owner = await createUser(prisma);
    const member = await createUser(prisma);
    const other = await createUser(prisma);
    ownerId = owner.id;
    memberId = member.id;
    otherId = other.id;

    const h1 = await createHousehold(prisma, ownerId, { name: "H1" });
    // H2 exists so `other` genuinely owns a different household; the
    // cross-household tests probe H1 with other's token, so only h1Id is kept.
    await createHousehold(prisma, otherId, { name: "H2" });
    h1Id = h1.id;

    await addMembership(prisma, { userId: memberId, householdId: h1Id, role: "MEMBER" });

    ownerToken = mintAccessToken(jwtService, ownerId);
    memberToken = mintAccessToken(jwtService, memberId);
    otherOwnerToken = mintAccessToken(jwtService, otherId);
  });

  afterAll(async () => {
    await cleanupUsers(prisma, [ownerId, memberId, otherId]);

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
