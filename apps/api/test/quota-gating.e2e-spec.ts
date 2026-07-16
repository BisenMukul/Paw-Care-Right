import { getQueueToken } from "@nestjs/bullmq";
import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { errorResponseSchema, FAMILY_PLAN_PRODUCT_ID } from "@pawcareright/types";
import { PrismaClient } from "@prisma/client";
import type { Queue } from "bullmq";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import type { ChecksJobData } from "../src/checks/checks.contract";
import { CHECKS_QUEUE } from "../src/checks/checks.contract";
import { ENTITLEMENT_RESOLVER } from "../src/quota/entitlement";
import { CheckRunnerProcessor } from "../src/workers/check-runner.processor";
import {
  cleanupUsers,
  createMemberContext,
  createOwnerContext,
  createSubscription,
  mintAccessToken,
  resolveJwtService,
  type AuthedContext,
} from "./factories";

/**
 * T075 free-tier gating integration matrix: real Postgres + real Redis.
 * `app` runs the REAL `BillingEntitlementResolver` (FREE for any caller
 * with no `Subscription` row — the default for a freshly created user);
 * `premiumApp` overrides `ENTITLEMENT_RESOLVER` -> a fixed PREMIUM
 * (`bypassQuota:false`, unlike `checks.e2e-spec.ts`'s own override, so this
 * suite also proves PREMIUM is simply "not blocked at the free limit", not
 * "unlimited"). `checks` quota is a persistent (`total`) Redis counter, so
 * every quota-sensitive case uses a FRESH user (see `checks.e2e-spec.ts`'s
 * own note).
 */
describe("Quota gating — free vs premium matrix (e2e)", () => {
  let app: INestApplication;
  let premiumApp: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;
  let queue: Queue<ChecksJobData>;

  const userIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CheckRunnerProcessor)
      .useValue({ process: async () => undefined })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    const premiumModuleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENTITLEMENT_RESOLVER)
      .useValue({ resolve: async () => ({ tier: "PREMIUM", bypassQuota: false }) })
      .overrideProvider(CheckRunnerProcessor)
      .useValue({ process: async () => undefined })
      .compile();
    premiumApp = premiumModuleRef.createNestApplication();
    configureApp(premiumApp);
    await premiumApp.init();

    prisma = new PrismaClient();
    jwtService = resolveJwtService(app);
    queue = app.get(getQueueToken(CHECKS_QUEUE));
  });

  afterAll(async () => {
    await cleanupUsers(prisma, userIds);
    await queue.obliterate({ force: true });
    await queue.close();
    await prisma.$disconnect();
    await app.close();
    await premiumApp.close();
  });

  const owner = (targetApp: INestApplication = app): Promise<AuthedContext> =>
    createOwnerContext(targetApp, prisma, jwtService, userIds);
  const member = (targetApp: INestApplication = app): Promise<AuthedContext> =>
    createMemberContext(targetApp, prisma, jwtService, userIds);

  async function createPet(ctx: AuthedContext, name = "Fido"): Promise<{ status: number; body: Record<string, unknown> }> {
    const res = await ctx.authedAgent("post", "/v1/pets").send({ species: "DOG", name });
    return { status: res.status, body: res.body as Record<string, unknown> };
  }

  function benignIntake(): Record<string, unknown> {
    return {
      category: "not-eating",
      answers: [
        { questionId: "onset", type: "duration", value: 6, unit: "hours" },
        { questionId: "water", type: "single", value: "drinking-normally" },
        { questionId: "energy", type: "scale", value: 4 },
      ],
    };
  }

  function redFlagIntake(): Record<string, unknown> {
    return {
      category: "breathing",
      answers: [
        { questionId: "onset", type: "duration", value: 10, unit: "minutes" },
        { questionId: "character", type: "single", value: "gasping" },
        { questionId: "gum-color", type: "single", value: "pink" },
        { questionId: "energy", type: "scale", value: 1 },
      ],
    };
  }

  function expectPaymentRequired(res: { status: number; body: unknown }): void {
    expect(res.status).toBe(402);
    expect(errorResponseSchema.parse(res.body)).toEqual({
      error: { code: "PAYMENT_REQUIRED", message: expect.any(String), requestId: expect.any(String) },
    });
  }

  describe("checks — FREE vs PREMIUM", () => {
    it("FREE: 1st benign check 201, 2nd 402 PAYMENT_REQUIRED", async () => {
      const ctx = await owner();
      const petRes = await createPet(ctx);
      const petId = petRes.body.id as string;

      const first = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expect(first.status).toBe(201);

      const second = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expectPaymentRequired(second);
    });

    it("PREMIUM: two benign checks both 201 (not blocked at the free limit)", async () => {
      const ctx = await owner(premiumApp);
      const petRes = await createPet(ctx);
      const petId = petRes.body.id as string;

      const first = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expect(first.status).toBe(201);

      const second = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expect(second.status).toBe(201);
    });
  });

  describe("pets — FREE vs PREMIUM (1-pet gate)", () => {
    it("FREE: 1st pet 201, 2nd pet 402 PAYMENT_REQUIRED", async () => {
      const ctx = await owner();

      const first = await createPet(ctx, "First");
      expect(first.status).toBe(201);

      const second = await createPet(ctx, "Second");
      expectPaymentRequired(second);
    });

    it("PREMIUM: 2nd pet 201 (gate lifted)", async () => {
      const ctx = await owner(premiumApp);

      const first = await createPet(ctx, "First");
      expect(first.status).toBe(201);

      const second = await createPet(ctx, "Second");
      expect(second.status).toBe(201);
    });

    it("family-member premium via household: a MEMBER whose household carries an active family Subscription lifts the gate", async () => {
      const ctx = await member();
      await createSubscription(prisma, {
        rcAppUserId: ctx.household.ownerId,
        householdId: ctx.household.id,
        entitlement: "PREMIUM",
        plan: FAMILY_PLAN_PRODUCT_ID,
        expiresAt: new Date(Date.now() + 60_000),
      });

      const first = await createPet(ctx, "First");
      expect(first.status).toBe(201);

      const second = await createPet(ctx, "Second");
      expect(second.status).toBe(201);
    });
  });

  describe("household sharing (invites) — FREE vs PREMIUM", () => {
    it("FREE owner: createInvite -> 402 PAYMENT_REQUIRED", async () => {
      const ctx = await owner();

      const res = await ctx.authedAgent("post", "/v1/households/invites");
      expectPaymentRequired(res);
    });

    it("PREMIUM owner: createInvite -> 201", async () => {
      const ctx = await owner(premiumApp);

      const res = await ctx.authedAgent("post", "/v1/households/invites");
      expect(res.status).toBe(201);
      expect(res.body.code).toBeTruthy();
    });
  });

  describe("counters survive reinstall (server-side, fresh JWT for the same user/device)", () => {
    it("checks: FREE user's exhausted quota still blocks after a fresh JWT (simulated reinstall)", async () => {
      const ctx = await owner();
      const petRes = await createPet(ctx);
      const petId = petRes.body.id as string;

      const first = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expect(first.status).toBe(201);

      const freshToken = mintAccessToken(jwtService, ctx.user.id);
      const second = await request(app.getHttpServer())
        .post(`/v1/pets/${petId}/checks`)
        .set("Authorization", `Bearer ${freshToken}`)
        .send({ intake: benignIntake() });

      expectPaymentRequired(second);
    });

    it("pets: FREE user's 1-pet cap still blocks after a fresh JWT (Pet rows are server-side)", async () => {
      const ctx = await owner();

      const first = await createPet(ctx, "First");
      expect(first.status).toBe(201);

      const freshToken = mintAccessToken(jwtService, ctx.user.id);
      const second = await request(app.getHttpServer())
        .post("/v1/pets")
        .set("Authorization", `Bearer ${freshToken}`)
        .send({ species: "DOG", name: "Second" });

      expectPaymentRequired(second);
    });
  });

  describe("emergency bypass still intact after quota exhaustion (never regress T042/CLAUDE.md §5)", () => {
    it("FREE user exhausts the 1 check quota, THEN a red-flag intake still returns 201 with the redFlag payload", async () => {
      const ctx = await owner();
      const petRes = await createPet(ctx);
      const petId = petRes.body.id as string;

      const benign = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expect(benign.status).toBe(201);

      const exhausted = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expectPaymentRequired(exhausted);

      const redFlag = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: redFlagIntake() });

      expect(redFlag.status).toBe(201);
      expect(redFlag.body.redFlag.ruleId).toBeTruthy();
      expect(redFlag.body.redFlag.payloadKey).toBeTruthy();

      const job = await queue.getJob(redFlag.body.id as string);
      expect(job).toBeDefined();
    });
  });
});
