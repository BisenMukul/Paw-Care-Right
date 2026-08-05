import { getQueueToken } from "@nestjs/bullmq";
import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { FakeTextProvider } from "@bombaypetcompany/ai";
import { errorResponseSchema, type FeatureFlags, type FeatureKey } from "@bombaypetcompany/types";
import { PrismaClient } from "@prisma/client";
import type { Queue } from "bullmq";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import type { ChecksJobData } from "../src/checks/checks.contract";
import { CHECKS_QUEUE } from "../src/checks/checks.contract";
import { CHAT_TEXT_PROVIDER } from "../src/chat/chat.tokens";
import { ENTITLEMENT_RESOLVER } from "../src/quota/entitlement";
import { FeatureFlagsService } from "../src/remote-config/feature-flags.service";

import {
  cleanupUsers,
  createChatThread,
  createOwnerContext,
  createPet,
  overrideCheckRunner,
  resolveJwtService,
  type AuthedContext,
} from "./factories";

/**
 * T106 Step 10 — the `checks`/`chat` kill switches, tested against
 * `.overrideProvider(FeatureFlagsService)` fakes so the cases are
 * deterministic and need no Redis writes (the real Redis-backed resolution
 * — env default / Redis override / cache TTL / sticky-last-known — is
 * covered by `feature-flags.service.spec.ts`). Two app instances:
 * `killedApp` (both flags forced off) and `onApp` (both flags forced on,
 * PREMIUM entitlement so chat is reachable) — proving the guard actually
 * gates AND that leaving both flags on is a true non-vacuous baseline.
 *
 * Safety invariant (D9/D5): `GET /checks/:id`, `GET /pets/:petId/checks`,
 * and `POST /checks/:id/followup` carry NO `@RequiresFeature` metadata, so
 * they must stay reachable — including a check's `redFlag` Emergency-
 * interstitial payload — even with `checks` killed.
 */
function fixedFlags(flags: FeatureFlags): Pick<FeatureFlagsService, "isEnabled" | "getAll"> {
  return {
    isEnabled: async (key: FeatureKey) => flags[key],
    getAll: async () => flags,
  };
}

describe("Feature kill switch (e2e)", () => {
  let killedApp: INestApplication;
  let onApp: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;
  let checksQueue: Queue<ChecksJobData>;

  const userIds: string[] = [];

  beforeAll(async () => {
    const killedModuleRef = await overrideCheckRunner(
      Test.createTestingModule({ imports: [AppModule] }).overrideProvider(FeatureFlagsService).useValue(
        fixedFlags({ checks: false, chat: false, paywall: true }),
      ),
    ).compile();
    killedApp = killedModuleRef.createNestApplication();
    configureApp(killedApp);
    await killedApp.init();

    const onModuleRef = await overrideCheckRunner(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(FeatureFlagsService)
        .useValue(fixedFlags({ checks: true, chat: true, paywall: true }))
        .overrideProvider(ENTITLEMENT_RESOLVER)
        .useValue({ resolve: async () => ({ tier: "PREMIUM", bypassQuota: true }) })
        .overrideProvider(CHAT_TEXT_PROVIDER)
        .useValue(new FakeTextProvider({ streamChunks: ["All good. "] })),
    ).compile();
    onApp = onModuleRef.createNestApplication();
    configureApp(onApp);
    await onApp.init();

    prisma = new PrismaClient();
    jwtService = resolveJwtService(killedApp);
    checksQueue = killedApp.get(getQueueToken(CHECKS_QUEUE));
  });

  afterAll(async () => {
    await cleanupUsers(prisma, userIds);
    await checksQueue.obliterate({ force: true });
    await checksQueue.close();
    await prisma.$disconnect();
    await killedApp.close();
    await onApp.close();
  });

  const owner = (app: INestApplication): Promise<AuthedContext> =>
    createOwnerContext(app, prisma, jwtService, userIds);

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

  describe("checks killed", () => {
    it("POST /v1/pets/:petId/checks -> 503 FEATURE_DISABLED with a requestId", async () => {
      const ctx = await owner(killedApp);
      const petRes = await ctx.authedAgent("post", "/v1/pets").send({ species: "DOG", name: "Fido" });
      const petId = petRes.body.id as string;

      const res = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });

      expect(res.status).toBe(503);
      const parsed = errorResponseSchema.parse(res.body);
      expect(parsed.error.code).toBe("FEATURE_DISABLED");
      expect(parsed.error.requestId.length).toBeGreaterThan(0);
    });

    it("GET /v1/checks/:id still returns 200 with its redFlag payload intact (D9)", async () => {
      // Seed the red-flag check via the flags-on app (checks must be
      // enabled to CREATE it), then read it back via the killed app.
      const seedCtx = await owner(onApp);
      const petRes = await seedCtx.authedAgent("post", "/v1/pets").send({ species: "DOG", name: "Rex" });
      const petId = petRes.body.id as string;
      const created = await seedCtx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: redFlagIntake() });
      expect(created.status).toBe(201);

      const token = jwtService.sign({ sub: seedCtx.user.id });
      const res = await request(killedApp.getHttpServer())
        .get(`/v1/checks/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.redFlag.ruleId).toBeTruthy();
      expect(res.body.redFlag.payloadKey).toBeTruthy();
    });

    it("POST /v1/checks/:id/followup still escalates while checks are killed (D9)", async () => {
      const seedCtx = await owner(onApp);
      const petRes = await seedCtx.authedAgent("post", "/v1/pets").send({ species: "DOG", name: "Milo" });
      const petId = petRes.body.id as string;
      const created = await seedCtx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });
      expect(created.status).toBe(201);
      const checkId = created.body.id as string;

      await prisma.symptomCheck.update({ where: { id: checkId }, data: { status: "DONE" } });
      await prisma.triageResult.create({
        data: {
          checkId,
          urgency: "MONITOR",
          confidence: "high",
          resultJson: {
            urgency: "MONITOR",
            confidence: "high",
            summary: "General guidance based on the information provided.",
            possibleCauses: [{ name: "Mild issue", whyItFits: "Fits the reported symptoms." }],
            redFlagsToWatch: ["Worsening symptoms"],
            homeCare: ["Offer small amounts of water"],
            doNot: ["Do not give human medications without veterinary guidance."],
            vetQuestions: ["How long has this been going on?"],
            followUpHours: 24,
          },
          modelId: "test-model",
          promptVersion: "v1",
        },
      });

      const token = jwtService.sign({ sub: seedCtx.user.id });
      const res = await request(killedApp.getHttpServer())
        .post(`/v1/checks/${checkId}/followup`)
        .set("Authorization", `Bearer ${token}`)
        .send({ response: "worse" });

      expect(res.status).toBe(200);
      expect(res.body.followUp.response).toBe("worse");
      expect(res.body.followUp.escalatedTier).toBe("VET_SOON");
    });
  });

  describe("chat killed", () => {
    it("POST /v1/chat/threads -> 503 FEATURE_DISABLED", async () => {
      const ctx = await owner(killedApp);
      const petRes = await ctx.authedAgent("post", "/v1/pets").send({ species: "DOG", name: "Fido" });
      const petId = petRes.body.id as string;

      const res = await ctx.authedAgent("post", "/v1/chat/threads").send({ petId });

      expect(res.status).toBe(503);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("FEATURE_DISABLED");
    });

    it("POST /v1/chat/threads/:id/messages -> JSON error envelope (not a partial SSE stream) with FEATURE_DISABLED", async () => {
      const ctx = await owner(killedApp);
      const pet = await createPet(prisma, ctx.household.id);
      const thread = await createChatThread(prisma, { petId: pet.id, createdById: ctx.user.id });

      const res = await ctx.authedAgent("post", `/v1/chat/threads/${thread.id}/messages`).send({ content: "hello" });

      expect(res.status).toBe(503);
      expect(res.headers["content-type"]).toMatch(/json/);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("FEATURE_DISABLED");
    });
  });

  describe("both flags on (non-vacuity — same routes behave exactly as before)", () => {
    it("POST /v1/pets/:petId/checks -> 201", async () => {
      const ctx = await owner(onApp);
      const petRes = await ctx.authedAgent("post", "/v1/pets").send({ species: "DOG", name: "Fido" });
      const petId = petRes.body.id as string;

      const res = await ctx.authedAgent("post", `/v1/pets/${petId}/checks`).send({ intake: benignIntake() });

      expect(res.status).toBe(201);
    });

    it("POST /v1/chat/threads and the first message stream both succeed", async () => {
      const ctx = await owner(onApp);
      const pet = await createPet(prisma, ctx.household.id);

      const threadRes = await ctx.authedAgent("post", "/v1/chat/threads").send({ petId: pet.id });
      expect(threadRes.status).toBe(201);

      const res = await ctx
        .authedAgent("post", `/v1/chat/threads/${threadRes.body.id}/messages`)
        .send({ content: "Just a general question." });
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/^text\/event-stream/);
    });
  });
});
