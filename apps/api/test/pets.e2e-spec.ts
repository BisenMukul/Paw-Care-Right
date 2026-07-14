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
  createMemberContext,
  createOwnerContext,
  createUser,
  mintAccessToken,
  overrideCheckRunner,
  resolveJwtService,
  type AuthedContext,
} from "./factories";

// Flat `/v1/pets` routes, scoped via `HouseholdScopeGuard`'s additive
// resolve-from-membership mode (`@HouseholdFromMembership()` on
// `PetsController`). `cleanupUsers` cascade-deletes pets through
// `household.deleteMany` (Pet -> Household is `onDelete: Cascade`), so no
// direct `prisma.pet` cleanup is needed here.
describe("Pets (e2e)", () => {
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

  function minimalPet(overrides: Record<string, unknown> = {}) {
    return { species: "DOG", name: "Fido", ...overrides };
  }

  describe("unauthenticated", () => {
    it("GET /v1/pets with no token → 401 UNAUTHORIZED", async () => {
      const res = await request(app.getHttpServer()).get("/v1/pets");

      expect(res.status).toBe(401);
      const parsed = errorResponseSchema.parse(res.body);
      expect(parsed.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("no household for the caller (resolve-from-membership, zero memberships)", () => {
    it("GET /v1/pets for a bare user with no household → 404 NOT_FOUND", async () => {
      const bareUser = await createUser(prisma);
      userIds.push(bareUser.id);
      const token = mintAccessToken(jwtService, bareUser.id);

      const res = await request(app.getHttpServer())
        .get("/v1/pets")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      const parsed = errorResponseSchema.parse(res.body);
      expect(parsed.error.code).toBe("NOT_FOUND");
    });
  });

  describe("happy path", () => {
    it("create -> get -> list -> patch", async () => {
      const ctx = await owner();

      const createRes = await ctx.authedAgent("post", "/v1/pets").send(minimalPet({ name: "Rex" }));
      expect(createRes.status).toBe(201);
      expect(createRes.body.name).toBe("Rex");
      expect(createRes.body.species).toBe("DOG");
      expect(createRes.body.householdId).toBe(ctx.household.id);
      const petId = createRes.body.id as string;

      const getRes = await ctx.authedAgent("get", `/v1/pets/${petId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.id).toBe(petId);

      const listRes = await ctx.authedAgent("get", "/v1/pets");
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);
      expect(listRes.body.some((pet: { id: string }) => pet.id === petId)).toBe(true);

      const patchRes = await ctx.authedAgent("patch", `/v1/pets/${petId}`).send({ name: "Rex II" });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.name).toBe("Rex II");
    });
  });

  describe("cross-household access -> 404 (not a 403 leak)", () => {
    it("user B GET/PATCH/DELETE user A's pet -> 404 NOT_FOUND", async () => {
      const ownerA = await owner();
      const ownerB = await owner();

      const createRes = await ownerA
        .authedAgent("post", "/v1/pets")
        .send(minimalPet({ name: "A's Dog" }));
      expect(createRes.status).toBe(201);
      const petId = createRes.body.id as string;

      const getRes = await ownerB.authedAgent("get", `/v1/pets/${petId}`);
      expect(getRes.status).toBe(404);
      expect(errorResponseSchema.parse(getRes.body).error.code).toBe("NOT_FOUND");

      const patchRes = await ownerB.authedAgent("patch", `/v1/pets/${petId}`).send({ name: "Hijacked" });
      expect(patchRes.status).toBe(404);
      expect(errorResponseSchema.parse(patchRes.body).error.code).toBe("NOT_FOUND");

      const deleteRes = await ownerB.authedAgent("delete", `/v1/pets/${petId}`);
      expect(deleteRes.status).toBe(404);
      expect(errorResponseSchema.parse(deleteRes.body).error.code).toBe("NOT_FOUND");
    });
  });

  describe("soft-delete hides from list and direct get", () => {
    it("create -> DELETE (owner) -> GET /pets omits it AND GET /pets/:id -> 404", async () => {
      const ctx = await owner();

      const createRes = await ctx
        .authedAgent("post", "/v1/pets")
        .send(minimalPet({ name: "Gone" }));
      expect(createRes.status).toBe(201);
      const petId = createRes.body.id as string;

      const deleteRes = await ctx.authedAgent("delete", `/v1/pets/${petId}`);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.id).toBe(petId);

      const listRes = await ctx.authedAgent("get", "/v1/pets");
      expect(listRes.status).toBe(200);
      expect(listRes.body.some((pet: { id: string }) => pet.id === petId)).toBe(false);

      const getRes = await ctx.authedAgent("get", `/v1/pets/${petId}`);
      expect(getRes.status).toBe(404);
      expect(errorResponseSchema.parse(getRes.body).error.code).toBe("NOT_FOUND");
    });
  });

  describe("DELETE role enforcement", () => {
    it("member DELETE -> 403 FORBIDDEN", async () => {
      const ctx = await member();

      const createRes = await ctx
        .authedAgent("post", "/v1/pets")
        .send(minimalPet({ name: "Member's Dog" }));
      expect(createRes.status).toBe(201);
      const petId = createRes.body.id as string;

      const deleteRes = await ctx.authedAgent("delete", `/v1/pets/${petId}`);
      expect(deleteRes.status).toBe(403);
      expect(errorResponseSchema.parse(deleteRes.body).error.code).toBe("FORBIDDEN");
    });

    it("owner DELETE -> 200", async () => {
      const ctx = await owner();

      const createRes = await ctx
        .authedAgent("post", "/v1/pets")
        .send(minimalPet({ name: "Owner's Dog" }));
      expect(createRes.status).toBe(201);
      const petId = createRes.body.id as string;

      const deleteRes = await ctx.authedAgent("delete", `/v1/pets/${petId}`);
      expect(deleteRes.status).toBe(200);
    });
  });

  describe("age XOR birthDate validation matrix", () => {
    it("POST both birthDate and ageEstimateMonths set -> 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();

      const res = await ctx.authedAgent("post", "/v1/pets").send(
        minimalPet({ birthDate: "2020-01-01T00:00:00.000Z", ageEstimateMonths: 6 }),
      );

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("POST birthDate alone -> 201", async () => {
      const ctx = await owner();

      const res = await ctx
        .authedAgent("post", "/v1/pets")
        .send(minimalPet({ birthDate: "2020-01-01T00:00:00.000Z" }));

      expect(res.status).toBe(201);
    });

    it("POST ageEstimateMonths alone -> 201", async () => {
      const ctx = await owner();

      const res = await ctx.authedAgent("post", "/v1/pets").send(minimalPet({ ageEstimateMonths: 6 }));

      expect(res.status).toBe(201);
    });

    it("POST neither -> 201", async () => {
      const ctx = await owner();

      const res = await ctx.authedAgent("post", "/v1/pets").send(minimalPet());

      expect(res.status).toBe(201);
    });

    it("PATCH: existing birthDate, adding ageEstimateMonths without nulling birthDate -> 400", async () => {
      const ctx = await owner();

      const createRes = await ctx
        .authedAgent("post", "/v1/pets")
        .send(minimalPet({ birthDate: "2020-01-01T00:00:00.000Z" }));
      expect(createRes.status).toBe(201);
      const petId = createRes.body.id as string;

      const patchRes = await ctx
        .authedAgent("patch", `/v1/pets/${petId}`)
        .send({ ageEstimateMonths: 6 });

      expect(patchRes.status).toBe(400);
      expect(errorResponseSchema.parse(patchRes.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("PATCH: sets ageEstimateMonths AND birthDate: null in one body -> 200", async () => {
      const ctx = await owner();

      const createRes = await ctx
        .authedAgent("post", "/v1/pets")
        .send(minimalPet({ birthDate: "2020-01-01T00:00:00.000Z" }));
      expect(createRes.status).toBe(201);
      const petId = createRes.body.id as string;

      const patchRes = await ctx
        .authedAgent("patch", `/v1/pets/${petId}`)
        .send({ ageEstimateMonths: 6, birthDate: null });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.ageEstimateMonths).toBe(6);
      expect(patchRes.body.birthDate).toBeNull();
    });
  });
});
