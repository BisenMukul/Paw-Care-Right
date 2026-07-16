import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { errorResponseSchema } from "@pawcareright/types";
import { PrismaClient } from "@prisma/client";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { INVITE_CODE_REGEX } from "../src/households/invite-code";
import {
  cleanupUsers,
  createMemberContext,
  createOwnerContext,
  createPet,
  createSubscription,
  createUser,
  mintAccessToken,
  overrideCheckRunner,
  resolveJwtService,
  type AuthedContext,
} from "./factories";

// Household invites (T026): mint (owner-only) -> accept (JOIN-REPLACES, see
// plan's CENTRAL DESIGN COLLISION). `cleanupUsers` cascade-deletes
// `HouseholdInvite`/`Membership`/`Pet` rows through `household.deleteMany`
// (each FK'd to `Household` with `onDelete: Cascade`), so no direct
// `prisma.householdInvite`/`prisma.pet` cleanup is needed here.
describe("Households — invites (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;

  const userIds: string[] = [];

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

  const owner = (): Promise<AuthedContext> => createOwnerContext(app, prisma, jwtService, userIds);
  const member = (): Promise<AuthedContext> => createMemberContext(app, prisma, jwtService, userIds);

  /**
   * T075 added a premium-only gate on invite creation (SPEC §7 "sharing is
   * premium"). This suite is about the invite/accept MECHANICS, not
   * entitlement, so every context that mints an invite here is first granted
   * an active own `Subscription` — orthogonal to what each test actually
   * asserts. The entitlement gate itself is covered by
   * `quota-gating.e2e-spec.ts`'s FREE/PREMIUM matrix.
   */
  async function grantPremium(ctx: AuthedContext): Promise<void> {
    await createSubscription(prisma, {
      rcAppUserId: ctx.user.id,
      householdId: ctx.household.id,
      entitlement: "PREMIUM",
      expiresAt: null,
    });
  }

  async function mintInvite(ctx: AuthedContext): Promise<{ code: string; deepLink: string; expiresAt: string }> {
    await grantPremium(ctx);
    const res = await ctx.authedAgent("post", "/v1/households/invites");
    expect(res.status).toBe(201);
    return res.body as { code: string; deepLink: string; expiresAt: string };
  }

  describe("unauthenticated", () => {
    it("POST /v1/households/invites with no token → 401 UNAUTHORIZED", async () => {
      const res = await request(app.getHttpServer()).post("/v1/households/invites");

      expect(res.status).toBe(401);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
    });

    it("POST /v1/households/invites/accept with no token → 401 UNAUTHORIZED", async () => {
      const res = await request(app.getHttpServer())
        .post("/v1/households/invites/accept")
        .send({ code: "AB3DEFGH" });

      expect(res.status).toBe(401);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
    });

    it("GET /v1/households/me with no token → 401 UNAUTHORIZED", async () => {
      const res = await request(app.getHttpServer()).get("/v1/households/me");

      expect(res.status).toBe(401);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("owner-only invite creation", () => {
    it("MEMBER-role user POST invites → 403 FORBIDDEN", async () => {
      const ctx = await member();

      const res = await ctx.authedAgent("post", "/v1/households/invites");

      expect(res.status).toBe(403);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("FORBIDDEN");
    });

    it("OWNER POST → 201 with a valid code, deep link, and ~7-day expiry", async () => {
      const ctx = await owner();
      await grantPremium(ctx);

      const before = Date.now();
      const res = await ctx.authedAgent("post", "/v1/households/invites");
      const after = Date.now();

      expect(res.status).toBe(201);
      expect(res.body.code).toMatch(INVITE_CODE_REGEX);
      expect(res.body.deepLink).toBe(`pawcareright://join/${res.body.code}`);

      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const expiresAt = new Date(res.body.expiresAt as string).getTime();
      expect(expiresAt).toBeGreaterThanOrEqual(before + sevenDaysMs - 5000);
      expect(expiresAt).toBeLessThanOrEqual(after + sevenDaysMs + 5000);
    });
  });

  describe("expired code", () => {
    it("accept on an expired invite → 404 NOT_FOUND", async () => {
      const ownerCtx = await owner();
      const joinerCtx = await owner();

      const invite = await mintInvite(ownerCtx);
      await prisma.householdInvite.update({
        where: { code: invite.code },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const res = await joinerCtx.authedAgent("post", "/v1/households/invites/accept").send({ code: invite.code });

      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });
  });

  describe("reuse blocked after accept (single-use)", () => {
    it("a second accept of an already-used code → 404 NOT_FOUND", async () => {
      const ownerCtx = await owner();
      const firstJoiner = await owner();
      const secondJoiner = await owner();

      const invite = await mintInvite(ownerCtx);

      const firstRes = await firstJoiner
        .authedAgent("post", "/v1/households/invites/accept")
        .send({ code: invite.code });
      expect(firstRes.status).toBe(200);

      const secondRes = await secondJoiner
        .authedAgent("post", "/v1/households/invites/accept")
        .send({ code: invite.code });

      expect(secondRes.status).toBe(404);
      expect(errorResponseSchema.parse(secondRes.body).error.code).toBe("NOT_FOUND");
    });
  });

  describe("accept happy path (two real users)", () => {
    it("B accepts A's code: 200 returning A's household; B's old household deleted; B is MEMBER in A's; invite used; B's /v1/pets resolves to A's pets", async () => {
      const ownerA = await owner();
      const ownerB = await owner();
      const oldHouseholdBId = ownerB.household.id;

      const petRes = await ownerA.authedAgent("post", "/v1/pets").send({ species: "DOG", name: "A's Dog" });
      expect(petRes.status).toBe(201);

      const invite = await mintInvite(ownerA);

      const acceptRes = await ownerB
        .authedAgent("post", "/v1/households/invites/accept")
        .send({ code: invite.code });

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body).toEqual({ householdId: ownerA.household.id, name: ownerA.household.name });

      const oldHousehold = await prisma.household.findUnique({ where: { id: oldHouseholdBId } });
      expect(oldHousehold).toBeNull();

      const membership = await prisma.membership.findUnique({
        where: { userId_householdId: { userId: ownerB.user.id, householdId: ownerA.household.id } },
      });
      expect(membership?.role).toBe("MEMBER");

      const usedInvite = await prisma.householdInvite.findUnique({ where: { code: invite.code } });
      expect(usedInvite?.usedAt).not.toBeNull();
      expect(usedInvite?.usedById).toBe(ownerB.user.id);

      const petsRes = await ownerB.authedAgent("get", "/v1/pets");
      expect(petsRes.status).toBe(200);
      expect(petsRes.body.some((pet: { id: string }) => pet.id === petRes.body.id)).toBe(true);
    });
  });

  describe("pets-present blocks join-replaces", () => {
    it("joiner's current household still has pets → 409 CONFLICT; joiner still resolves to their own household afterward", async () => {
      const ownerA = await owner();
      const ownerB = await owner();

      await createPet(prisma, ownerB.household.id, { species: "CAT", name: "B's Cat" });

      const invite = await mintInvite(ownerA);

      const res = await ownerB.authedAgent("post", "/v1/households/invites/accept").send({ code: invite.code });

      expect(res.status).toBe(409);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("CONFLICT");

      const petsRes = await ownerB.authedAgent("get", "/v1/pets");
      expect(petsRes.status).toBe(200);
      expect(petsRes.body.some((pet: { name: string }) => pet.name === "B's Cat")).toBe(true);
    });
  });

  describe("GET /v1/households/me", () => {
    it("returns { id, name, members[] } with owner + a joined member", async () => {
      const ownerA = await owner();
      const ownerB = await owner();

      const invite = await mintInvite(ownerA);
      const acceptRes = await ownerB
        .authedAgent("post", "/v1/households/invites/accept")
        .send({ code: invite.code });
      expect(acceptRes.status).toBe(200);

      const res = await ownerA.authedAgent("get", "/v1/households/me");

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(ownerA.household.id);
      expect(res.body.name).toBe(ownerA.household.name);
      expect(res.body.members).toEqual(
        expect.arrayContaining([
          { userId: ownerA.user.id, email: ownerA.user.email, role: "OWNER" },
          { userId: ownerB.user.id, email: ownerB.user.email, role: "MEMBER" },
        ]),
      );
    });
  });

  describe("cross-cutting", () => {
    it("accepting a code for a user's own household (self-accept) → 409 CONFLICT", async () => {
      const ownerA = await owner();
      const invite = await mintInvite(ownerA);

      const res = await ownerA.authedAgent("post", "/v1/households/invites/accept").send({ code: invite.code });

      expect(res.status).toBe(409);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("CONFLICT");
    });

    it("malformed code → 400 VALIDATION_FAILED (DTO regex)", async () => {
      const ctx = await owner();

      const res = await ctx.authedAgent("post", "/v1/households/invites/accept").send({ code: "not-a-code!" });

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("unknown but well-formed code → 404 NOT_FOUND (no probing signal)", async () => {
      const ctx = await owner();

      const res = await ctx
        .authedAgent("post", "/v1/households/invites/accept")
        .send({ code: "ZZZZZZZZ" });

      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });

    it("bare user with no household → GET /v1/households/me → 404 NOT_FOUND", async () => {
      const bareUser = await createUser(prisma);
      userIds.push(bareUser.id);
      const token = mintAccessToken(jwtService, bareUser.id);

      const res = await request(app.getHttpServer())
        .get("/v1/households/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });
  });
});
