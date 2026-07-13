import { getQueueToken } from "@nestjs/bullmq";
import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { errorResponseSchema, SAFE_FALLBACK, type Urgency } from "@pawcareright/types";
import { PrismaClient } from "@prisma/client";
import type { Queue } from "bullmq";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import type { ChecksJobData } from "../src/checks/checks.contract";
import { CHECKS_QUEUE } from "../src/checks/checks.contract";
import { ENTITLEMENT_RESOLVER } from "../src/quota/entitlement";
import { CheckRunnerProcessor } from "../src/workers/check-runner.processor";
import { cleanupUsers, createOwnerContext, createUser, mintAccessToken, resolveJwtService, type AuthedContext } from "./factories";

/**
 * Real Postgres + real Redis/BullMQ round-trip. `CheckRunnerProcessor`
 * (T043) is registered in `WorkersModule`/`AppModule`, but this suite
 * overrides it with a no-op `useValue` so the BullMQ explorer's
 * `isProcessor` scan (which keys off `@Processor` reflect-metadata on the
 * resolved instance's constructor) finds nothing to attach a real `Worker`
 * to for `pawcareright-checks` here -- this suite only ever asserts a job
 * was *enqueued*, and several tests manually stage `SymptomCheck.status`/
 * `TriageResult` rows to exercise the GET read-path in isolation; a live
 * worker racing those manual writes against T043's real (network-calling by
 * default, `AI_TEXT_PROVIDER=ollama`) triage pipeline would make this whole
 * suite non-deterministic. `CheckRunnerProcessor`'s own real behavior is
 * covered by its direct-invoke unit suite
 * (`src/workers/check-runner.processor.spec.ts`). FREE `checks` quota is a
 * persistent (`total`) Redis counter, so every quota-sensitive test uses a
 * FRESH user (see plan Traps).
 */
describe("Checks (e2e)", () => {
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
      .useValue({ resolve: async () => ({ tier: "PREMIUM", bypassQuota: true }) })
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

  async function createPet(ctx: AuthedContext, name = "Fido"): Promise<string> {
    const res = await ctx.authedAgent("post", "/v1/pets").send({ species: "DOG", name });
    expect(res.status).toBe(201);
    return res.body.id as string;
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

  describe("AC1 — red-flag intake returns emergency payload in the 201 and consumes no quota", () => {
    it("red-flag intake -> 201 with redFlag payload, job enqueued, quota not consumed", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);

      const res = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: redFlagIntake() });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("QUEUED");
      expect(res.body.redFlag.ruleId).toBeTruthy();
      expect(res.body.redFlag.payloadKey).toBeTruthy();

      const job = await queue.getJob(res.body.id as string);
      expect(job).toBeDefined();
      expect(job?.data.checkId).toBe(res.body.id);

      // The emergency check did not spend the single FREE credit — a
      // subsequent non-red-flag check for the same (fresh) user still
      // succeeds.
      const followUp = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expect(followUp.status).toBe(201);
      expect(followUp.body.redFlag).toBeUndefined();
    });
  });

  describe("AC2 — quota exceeded -> 402 PAYMENT_REQUIRED", () => {
    it("second free-tier non-red-flag check -> 402 PAYMENT_REQUIRED", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);

      const first = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expect(first.status).toBe(201);

      const second = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expect(second.status).toBe(402);
      expect(errorResponseSchema.parse(second.body).error.code).toBe("PAYMENT_REQUIRED");
    });

    it("PREMIUM bypass allows multiple checks", async () => {
      const ctx = await owner(premiumApp);
      const petId = await createPet(ctx);

      const first = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expect(first.status).toBe(201);

      const second = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expect(second.status).toBe(201);
    });
  });

  describe("AC3 — idempotent replays return the same checkId", () => {
    it("same Idempotency-Key returns same checkId, consumes quota once, persists one row", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);

      const first = await ctx
        .authedAgent("post", `/v1/pets/${petId}/checks`)
        .set("Idempotency-Key", "k1")
        .send({ intake: benignIntake() });
      expect(first.status).toBe(201);
      const checkId = first.body.id as string;

      const replay = await ctx
        .authedAgent("post", `/v1/pets/${petId}/checks`)
        .set("Idempotency-Key", "k1")
        .send({ intake: benignIntake() });
      expect(replay.status).toBe(201);
      expect(replay.body.id).toBe(checkId);

      // The replay did not double-consume the single FREE credit — a third,
      // unkeyed request from the same user is over quota.
      const third = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expect(third.status).toBe(402);

      const rows = await prisma.symptomCheck.findMany({ where: { createdById: ctx.user.id, idempotencyKey: "k1" } });
      expect(rows).toHaveLength(1);
    });
  });

  describe("validation", () => {
    it("malformed intake -> 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);

      const res = await ctx
        .authedAgent("post", `/v1/pets/${petId}/checks`)
        .send({ intake: { category: "nope", answers: [] } });

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("unauthenticated", () => {
    it("POST with no token -> 401 UNAUTHORIZED", async () => {
      const res = await request(app.getHttpServer())
        .post("/v1/pets/some-pet-id/checks")
        .send({ intake: benignIntake() });

      expect(res.status).toBe(401);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
    });

    it("GET /checks/:id with no token -> 401 UNAUTHORIZED", async () => {
      const res = await request(app.getHttpServer()).get("/v1/checks/some-check-id");

      expect(res.status).toBe(401);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("cross-household scoping", () => {
    it("POST on another household's pet -> 404 NOT_FOUND", async () => {
      const ownerA = await owner();
      const ownerB = await owner();
      const petId = await createPet(ownerA, "A's Dog");

      const res = await ownerB.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });

      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });

    it("GET /checks/:id for another household's check -> 404 NOT_FOUND", async () => {
      const ownerA = await owner();
      const ownerB = await owner();
      const petId = await createPet(ownerA, "A's Dog");
      const created = await ownerA.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expect(created.status).toBe(201);

      const res = await ownerB.authedAgent("get", `/v1/checks/${created.body.id}`);

      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });

    it("GET /pets/:petId/checks for another household's pet -> 404 NOT_FOUND", async () => {
      const ownerA = await owner();
      const ownerB = await owner();
      const petId = await createPet(ownerA, "A's Dog");

      const res = await ownerB.authedAgent("get", `/v1/pets/${petId}/checks`);

      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });
  });

  describe("no household for the caller", () => {
    it("POST for a bare user with no household -> 404 NOT_FOUND", async () => {
      const bareUser = await createUser(prisma);
      userIds.push(bareUser.id);
      const token = mintAccessToken(jwtService, bareUser.id);

      const res = await request(app.getHttpServer())
        .post("/v1/pets/some-pet-id/checks")
        .set("Authorization", `Bearer ${token}`)
        .send({ intake: benignIntake() });

      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });
  });

  describe("GET /checks/:id states", () => {
    it("fresh POST -> QUEUED, no result", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);
      const created = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expect(created.status).toBe(201);

      const res = await ctx.authedAgent("get", `/v1/checks/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("QUEUED");
      expect(res.body.result).toBeUndefined();
    });

    it("RUNNING status carries no result even if manually advanced", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);
      const created = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expect(created.status).toBe(201);
      await prisma.symptomCheck.update({ where: { id: created.body.id }, data: { status: "RUNNING" } });

      const res = await ctx.authedAgent("get", `/v1/checks/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("RUNNING");
      expect(res.body.result).toBeUndefined();
    });

    it("DONE status with a valid TriageResult row -> result present and matches the schema", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);
      const created = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expect(created.status).toBe(201);

      await prisma.symptomCheck.update({ where: { id: created.body.id }, data: { status: "DONE" } });
      await prisma.triageResult.create({
        data: {
          checkId: created.body.id,
          urgency: SAFE_FALLBACK.urgency,
          confidence: SAFE_FALLBACK.confidence,
          resultJson: SAFE_FALLBACK,
          modelId: "test-model",
          promptVersion: "v1",
        },
      });

      const res = await ctx.authedAgent("get", `/v1/checks/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("DONE");
      expect(res.body.result).toEqual(SAFE_FALLBACK);
    });

    it("FALLBACK status with an invalid resultJson -> result omitted (defensive)", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);
      const created = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expect(created.status).toBe(201);

      await prisma.symptomCheck.update({ where: { id: created.body.id }, data: { status: "FALLBACK" } });
      await prisma.triageResult.create({
        data: {
          checkId: created.body.id,
          urgency: "NOT_A_REAL_TIER",
          confidence: "low",
          resultJson: { urgency: "NOT_A_REAL_TIER" },
          modelId: "test-model",
          promptVersion: "v1",
        },
      });

      const res = await ctx.authedAgent("get", `/v1/checks/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("FALLBACK");
      expect(res.body.result).toBeUndefined();
    });

    it("a red-flag check's GET carries the redFlag payload", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);
      const created = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: redFlagIntake() });
      expect(created.status).toBe(201);

      const res = await ctx.authedAgent("get", `/v1/checks/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.redFlag.ruleId).toBeTruthy();
      expect(res.body.redFlag.payloadKey).toBeTruthy();
    });
  });

  describe("GET /pets/:petId/checks — list pagination", () => {
    it("pages through cursor + limit, newest first, final page nextCursor null", async () => {
      const ctx = await owner(premiumApp);
      const petId = await createPet(ctx);

      const createdIds: string[] = [];
      for (let i = 0; i < 3; i += 1) {
        const res = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
        expect(res.status).toBe(201);
        createdIds.push(res.body.id as string);
      }
      const expectedOrder = [...createdIds].reverse(); // newest first

      const page1 = await ctx.authedAgent("get", `/v1/pets/${petId}/checks?limit=2`);
      expect(page1.status).toBe(200);
      expect(page1.body.items).toHaveLength(2);
      expect(page1.body.items.map((item: { id: string }) => item.id)).toEqual(expectedOrder.slice(0, 2));
      expect(page1.body.nextCursor).toBeTruthy();

      const page2 = await ctx.authedAgent("get", `/v1/pets/${petId}/checks?limit=2&cursor=${page1.body.nextCursor}`);
      expect(page2.status).toBe(200);
      expect(page2.body.items).toHaveLength(1);
      expect(page2.body.items.map((item: { id: string }) => item.id)).toEqual(expectedOrder.slice(2));
      expect(page2.body.nextCursor).toBeNull();
    });

    it("cross-household list -> 404 NOT_FOUND", async () => {
      const ownerA = await owner();
      const ownerB = await owner();
      const petId = await createPet(ownerA, "A's Dog");

      const res = await ownerB.authedAgent("get", `/v1/pets/${petId}/checks`);
      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });
  });

  describe("POST /checks/:id/followup (T051)", () => {
    /** A minimal, schema-valid `TriageResult` fixture for the given tier (mirrors packages/types/src/triage.spec.ts's validFixtureFor). */
    function triageFixture(urgency: Urgency): Record<string, unknown> {
      const allowsHomeCare = (["VET_SOON", "MONITOR", "REASSURE"] as Urgency[]).includes(urgency);
      return {
        urgency,
        confidence: "high",
        summary: "General guidance based on the information provided.",
        possibleCauses: [{ name: "Mild issue", whyItFits: "Fits the reported symptoms." }],
        redFlagsToWatch: ["Worsening symptoms"],
        homeCare: allowsHomeCare ? ["Offer small amounts of water"] : [],
        doNot: ["Do not give human medications without veterinary guidance."],
        vetQuestions: ["How long has this been going on?"],
        followUpHours: 24,
      };
    }

    /** Stages a terminal (DONE), schema-valid check: create -> force DONE -> attach a TriageResult row. */
    async function stageTerminalCheck(ctx: AuthedContext, petId: string, urgency: Urgency = "MONITOR"): Promise<string> {
      const created = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expect(created.status).toBe(201);
      const checkId = created.body.id as string;

      await prisma.symptomCheck.update({ where: { id: checkId }, data: { status: "DONE" } });
      await prisma.triageResult.create({
        data: {
          checkId,
          urgency,
          confidence: "high",
          resultJson: triageFixture(urgency),
          modelId: "test-model",
          promptVersion: "v1",
        },
      });

      return checkId;
    }

    it("better -> 200, no escalatedTier", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);
      const checkId = await stageTerminalCheck(ctx, petId, "MONITOR");

      const res = await ctx.authedAgent("post", `/v1/checks/${checkId}/followup`).send({ response: "better" });

      expect(res.status).toBe(200);
      expect(res.body.followUp.response).toBe("better");
      expect(res.body.followUp.escalatedTier).toBeUndefined();
    });

    it("same -> 200, no escalatedTier", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);
      const checkId = await stageTerminalCheck(ctx, petId, "MONITOR");

      const res = await ctx.authedAgent("post", `/v1/checks/${checkId}/followup`).send({ response: "same" });

      expect(res.status).toBe(200);
      expect(res.body.followUp.response).toBe("same");
      expect(res.body.followUp.escalatedTier).toBeUndefined();
    });

    it("worse -> 200, escalatedTier present and raised exactly one tier (MONITOR -> VET_SOON)", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);
      const checkId = await stageTerminalCheck(ctx, petId, "MONITOR");

      const res = await ctx.authedAgent("post", `/v1/checks/${checkId}/followup`).send({ response: "worse" });

      expect(res.status).toBe(200);
      expect(res.body.followUp.response).toBe("worse");
      expect(res.body.followUp.escalatedTier).toBe("VET_SOON");
    });

    it("worse on an EMERGENCY_NOW result -> escalatedTier stays at the EMERGENCY_NOW ceiling", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);
      const checkId = await stageTerminalCheck(ctx, petId, "EMERGENCY_NOW");

      const res = await ctx.authedAgent("post", `/v1/checks/${checkId}/followup`).send({ response: "worse" });

      expect(res.status).toBe(200);
      expect(res.body.followUp.escalatedTier).toBe("EMERGENCY_NOW");
    });

    it("GET /checks/:id after a worse follow-up surfaces the same followUp/escalatedTier", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);
      const checkId = await stageTerminalCheck(ctx, petId, "MONITOR");

      const followUpRes = await ctx.authedAgent("post", `/v1/checks/${checkId}/followup`).send({ response: "worse" });
      expect(followUpRes.status).toBe(200);

      const res = await ctx.authedAgent("get", `/v1/checks/${checkId}`);
      expect(res.status).toBe(200);
      expect(res.body.followUp).toEqual({ response: "worse", escalatedTier: "VET_SOON" });
    });

    it("duplicate follow-up (same response twice) is idempotent", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);
      const checkId = await stageTerminalCheck(ctx, petId, "MONITOR");

      const first = await ctx.authedAgent("post", `/v1/checks/${checkId}/followup`).send({ response: "worse" });
      expect(first.status).toBe(200);

      const second = await ctx.authedAgent("post", `/v1/checks/${checkId}/followup`).send({ response: "worse" });
      expect(second.status).toBe(200);
      expect(second.body.followUp).toEqual(first.body.followUp);

      const count = await prisma.checkFollowUp.count({ where: { checkId } });
      expect(count).toBe(1);
    });

    it("first worse then better -> second call still returns worse + unchanged escalatedTier (never un-escalates, §5)", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);
      const checkId = await stageTerminalCheck(ctx, petId, "MONITOR");

      const first = await ctx.authedAgent("post", `/v1/checks/${checkId}/followup`).send({ response: "worse" });
      expect(first.status).toBe(200);
      expect(first.body.followUp.escalatedTier).toBe("VET_SOON");

      const second = await ctx.authedAgent("post", `/v1/checks/${checkId}/followup`).send({ response: "better" });
      expect(second.status).toBe(200);
      expect(second.body.followUp.response).toBe("worse");
      expect(second.body.followUp.escalatedTier).toBe("VET_SOON");

      const count = await prisma.checkFollowUp.count({ where: { checkId } });
      expect(count).toBe(1);
    });

    it("worse on a non-terminal (QUEUED) check -> 409 CONFLICT", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);
      const created = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expect(created.status).toBe(201);

      const res = await ctx.authedAgent("post", `/v1/checks/${created.body.id}/followup`).send({ response: "worse" });

      expect(res.status).toBe(409);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("CONFLICT");
    });

    it("invalid response value -> 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);
      const checkId = await stageTerminalCheck(ctx, petId, "MONITOR");

      const res = await ctx.authedAgent("post", `/v1/checks/${checkId}/followup`).send({ response: "worst" });

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("no token -> 401 UNAUTHORIZED", async () => {
      const res = await request(app.getHttpServer())
        .post("/v1/checks/some-check-id/followup")
        .send({ response: "better" });

      expect(res.status).toBe(401);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
    });

    it("another household's check -> 404 NOT_FOUND", async () => {
      const ownerA = await owner();
      const ownerB = await owner();
      const petId = await createPet(ownerA, "A's Dog");
      const checkId = await stageTerminalCheck(ownerA, petId, "MONITOR");

      const res = await ownerB.authedAgent("post", `/v1/checks/${checkId}/followup`).send({ response: "better" });

      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });
  });
});
