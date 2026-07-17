import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { errorResponseSchema, VET_SUMMARY_DISCLAIMER, VET_SUMMARY_MAX_CHARS } from "@pawcareright/types";
import { PrismaClient } from "@prisma/client";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { encodeCursor } from "../src/health-logs/timeline-cursor";
import {
  cleanupUsers,
  createHealthLog,
  createOwnerContext,
  createPet,
  logValue,
  overrideCheckRunner,
  resolveJwtService,
  seedCompletedMedication,
  type AuthedContext,
} from "./factories";

/**
 * Real Postgres round-trip for the T064 health-timeline API. `cleanupUsers`
 * cascade-deletes pets/health-logs/reminders/events through
 * `household.deleteMany` (Pet -> Household is `onDelete: Cascade`,
 * HealthLog/Reminder/ReminderEvent -> Pet/Reminder are `onDelete: Cascade`),
 * so no direct `prisma.healthLog` cleanup is needed.
 */
describe("Health logs (e2e)", () => {
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

  function validLogBody(overrides: Record<string, unknown> = {}) {
    return {
      kind: "NOTE",
      occurredAt: "2026-07-15T09:00:00.000Z",
      value: { text: "Ate a full bowl." },
      ...overrides,
    };
  }

  async function createLog(
    ctx: AuthedContext,
    petId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; occurredAt: string }> {
    const res = await ctx.authedAgent("post", `/v1/pets/${petId}/logs`).send(validLogBody(overrides));
    expect(res.status).toBe(201);
    return { id: res.body.id as string, occurredAt: res.body.occurredAt as string };
  }

  describe("create (happy + validation)", () => {
    it("POST creates a NOTE log -> 201 with the stored record", async () => {
      const ctx = await owner();
      const pet = await createPet(prisma, ctx.household.id);

      const res = await ctx.authedAgent("post", `/v1/pets/${pet.id}/logs`).send(validLogBody());

      expect(res.status).toBe(201);
      expect(res.body.kind).toBe("NOTE");
      expect(res.body.value).toEqual({ text: "Ate a full bowl." });
      expect(res.body.photoKeys).toEqual([]);
    });

    it("MED_GIVEN in the body -> 400 VALIDATION_FAILED (system/projection kind rejected)", async () => {
      const ctx = await owner();
      const pet = await createPet(prisma, ctx.household.id);

      const res = await ctx
        .authedAgent("post", `/v1/pets/${pet.id}/logs`)
        .send(validLogBody({ kind: "MED_GIVEN", value: { reminderEventId: "x" } }));

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("CHECK_REF in the body -> 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();
      const pet = await createPet(prisma, ctx.household.id);

      const res = await ctx
        .authedAgent("post", `/v1/pets/${pet.id}/logs`)
        .send(validLogBody({ kind: "CHECK_REF", value: { checkId: "8400e29b-9c1d-4c1a-9e1a-6b6b6b6b6b6b" } }));

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("invalid value for the kind (WEIGHT missing weightGrams) -> 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();
      const pet = await createPet(prisma, ctx.household.id);

      const res = await ctx
        .authedAgent("post", `/v1/pets/${pet.id}/logs`)
        .send(validLogBody({ kind: "WEIGHT", value: {} }));

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("POST creates an ACTIVITY log -> 201 with the stored record, and it round-trips through GET list", async () => {
      const ctx = await owner();
      const pet = await createPet(prisma, ctx.household.id);

      const res = await ctx.authedAgent("post", `/v1/pets/${pet.id}/logs`).send(
        validLogBody({ kind: "ACTIVITY", value: { activityType: "FOOD", quantity: 2, unit: "meals" } }),
      );

      expect(res.status).toBe(201);
      expect(res.body.kind).toBe("ACTIVITY");
      expect(res.body.value).toEqual({ activityType: "FOOD", quantity: 2, unit: "meals" });

      const list = await ctx.authedAgent("get", `/v1/pets/${pet.id}/logs?kind=ACTIVITY`);
      expect(list.status).toBe(200);
      expect(list.body.items).toHaveLength(1);
      expect(list.body.items[0].value).toEqual({ activityType: "FOOD", quantity: 2, unit: "meals" });
    });

    it("ACTIVITY with a unit invalid for its activityType (unit<->type refine) -> 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();
      const pet = await createPet(prisma, ctx.household.id);

      const res = await ctx
        .authedAgent("post", `/v1/pets/${pet.id}/logs`)
        .send(validLogBody({ kind: "ACTIVITY", value: { activityType: "POTTY", unit: "grams" } }));

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("more than 6 photoKeys -> 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();
      const pet = await createPet(prisma, ctx.household.id);

      const res = await ctx.authedAgent("post", `/v1/pets/${pet.id}/logs`).send(
        validLogBody({ photoKeys: ["1", "2", "3", "4", "5", "6", "7"] }),
      );

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("no token -> 401 UNAUTHORIZED", async () => {
      const res = await request(app.getHttpServer()).post("/v1/pets/some-pet-id/logs").send(validLogBody());

      expect(res.status).toBe(401);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
    });

    it("pet in another household -> 404 NOT_FOUND (no leak)", async () => {
      const ownerA = await owner();
      const ownerB = await owner();
      const pet = await createPet(prisma, ownerA.household.id);

      const res = await ownerB.authedAgent("post", `/v1/pets/${pet.id}/logs`).send(validLogBody());

      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });
  });

  describe("list (happy + validation)", () => {
    it("GET returns a page containing a just-created log -> 200", async () => {
      const ctx = await owner();
      const pet = await createPet(prisma, ctx.household.id);
      const created = await createLog(ctx, pet.id);

      const res = await ctx.authedAgent("get", `/v1/pets/${pet.id}/logs`);

      expect(res.status).toBe(200);
      expect(res.body.items.map((i: { id: string }) => i.id)).toContain(created.id);
    });

    it("bad cursor -> 400 VALIDATION_FAILED, not a 500", async () => {
      const ctx = await owner();
      const pet = await createPet(prisma, ctx.household.id);

      const res = await ctx.authedAgent("get", `/v1/pets/${pet.id}/logs?cursor=not-a-real-cursor!!`);

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("out-of-range limit -> 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();
      const pet = await createPet(prisma, ctx.household.id);

      const res = await ctx.authedAgent("get", `/v1/pets/${pet.id}/logs?limit=101`);

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("no token -> 401 UNAUTHORIZED", async () => {
      const res = await request(app.getHttpServer()).get("/v1/pets/some-pet-id/logs");

      expect(res.status).toBe(401);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
    });

    it("pet in another household -> 404 NOT_FOUND (no leak)", async () => {
      const ownerA = await owner();
      const ownerB = await owner();
      const pet = await createPet(prisma, ownerA.household.id);

      const res = await ownerB.authedAgent("get", `/v1/pets/${pet.id}/logs`);

      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });
  });

  describe("pagination_stability_under_insert", () => {
    it("inserting an older row after page 1 shows up cleanly on page 2; a later newer insert doesn't corrupt the already-issued cursor", async () => {
      const ctx = await owner();
      const pet = await createPet(prisma, ctx.household.id);

      const a = await createLog(ctx, pet.id, { occurredAt: "2026-07-15T12:00:00.000Z", value: { text: "A" } });
      const b = await createLog(ctx, pet.id, { occurredAt: "2026-07-15T10:00:00.000Z", value: { text: "B" } });
      const c = await createLog(ctx, pet.id, { occurredAt: "2026-07-15T08:00:00.000Z", value: { text: "C" } });

      const page1 = await ctx.authedAgent("get", `/v1/pets/${pet.id}/logs?limit=2`);
      expect(page1.status).toBe(200);
      expect(page1.body.items.map((i: { id: string }) => i.id)).toEqual([a.id, b.id]);
      const cursorAfterPage1 = page1.body.nextCursor as string;
      expect(cursorAfterPage1).toBeTruthy();

      // Insert a row OLDER than the page-1 cursor (between B and C).
      const d = await createLog(ctx, pet.id, { occurredAt: "2026-07-15T09:00:00.000Z", value: { text: "D" } });

      const page2 = await ctx.authedAgent("get", `/v1/pets/${pet.id}/logs?limit=2&cursor=${cursorAfterPage1}`);
      expect(page2.status).toBe(200);
      expect(page2.body.items.map((i: { id: string }) => i.id)).toEqual([d.id, c.id]);

      // Insert a row NEWER than everything already returned.
      await createLog(ctx, pet.id, { occurredAt: "2026-07-15T13:00:00.000Z", value: { text: "E" } });

      // Re-using the ORIGINAL page-1 cursor still yields exactly [D, C] --
      // unaffected by the newer insert, no duplicate, no skipped row.
      const page2Again = await ctx.authedAgent("get", `/v1/pets/${pet.id}/logs?limit=2&cursor=${cursorAfterPage1}`);
      expect(page2Again.status).toBe(200);
      expect(page2Again.body.items.map((i: { id: string }) => i.id)).toEqual([d.id, c.id]);
    });
  });

  describe("pagination_equal_occurredAt", () => {
    it("several logs sharing one occurredAt paginate cleanly via the id tiebreak with no dup/skip", async () => {
      const ctx = await owner();
      const pet = await createPet(prisma, ctx.household.id);
      const sameInstant = "2026-07-15T11:00:00.000Z";

      const created = await Promise.all(
        ["W", "X", "Y", "Z"].map((label) => createLog(ctx, pet.id, { occurredAt: sameInstant, value: { text: label } })),
      );
      const createdIds = new Set(created.map((c) => c.id));

      const seenIds: string[] = [];
      let cursor: string | undefined;
      for (let i = 0; i < 10 && seenIds.length < createdIds.size; i += 1) {
        const path = cursor
          ? `/v1/pets/${pet.id}/logs?limit=2&cursor=${cursor}`
          : `/v1/pets/${pet.id}/logs?limit=2`;
        const res = await ctx.authedAgent("get", path);
        expect(res.status).toBe(200);
        for (const item of res.body.items as Array<{ id: string }>) {
          expect(seenIds).not.toContain(item.id);
          seenIds.push(item.id);
        }
        cursor = res.body.nextCursor ?? undefined;
        if (!cursor) {
          break;
        }
      }

      expect(new Set(seenIds)).toEqual(createdIds);
    });
  });

  describe("filter_by_each_kind", () => {
    it("each kind filter returns only that kind", async () => {
      const ctx = await owner();
      const pet = await createPet(prisma, ctx.household.id);

      await createLog(ctx, pet.id, { kind: "WEIGHT", occurredAt: "2026-07-15T09:00:00.000Z", value: { weightGrams: 12_000 } });
      await createLog(ctx, pet.id, { kind: "MEAL", occurredAt: "2026-07-15T09:00:00.000Z", value: { note: "kibble" } });
      await createLog(ctx, pet.id, { kind: "NOTE", occurredAt: "2026-07-15T09:00:00.000Z", value: { text: "note" } });
      await createLog(ctx, pet.id, {
        kind: "VET_VISIT",
        occurredAt: "2026-07-15T09:00:00.000Z",
        value: { reason: "checkup" },
      });
      await createLog(ctx, pet.id, {
        kind: "ACTIVITY",
        occurredAt: "2026-07-15T09:00:00.000Z",
        value: { activityType: "WALK", quantity: 20, unit: "min" },
      });

      // CHECK_REF: no source writes it via the public API -- seed directly (R3: rendered without a join).
      await createHealthLog(prisma, pet.id, {
        kind: "CHECK_REF",
        valueJson: logValue.checkRef("8400e29b-9c1d-4c1a-9e1a-6b6b6b6b6b6b"),
        occurredAt: "2026-07-15T09:00:00.000Z",
      });

      // MED_GIVEN: a read-time projection of a completed MEDICATION ReminderEvent.
      await seedCompletedMedication(prisma, pet.id, {
        at: "2026-07-15T09:00:00.000Z",
        medNameAsEntered: "As prescribed",
      });

      for (const kind of ["WEIGHT", "MEAL", "NOTE", "VET_VISIT", "MED_GIVEN", "CHECK_REF", "ACTIVITY"]) {
        const res = await ctx.authedAgent("get", `/v1/pets/${pet.id}/logs?kind=${kind}`);
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBeGreaterThanOrEqual(1);
        for (const item of res.body.items as Array<{ kind: string }>) {
          expect(item.kind).toBe(kind);
        }
      }
    });
  });

  describe("empty_and_terminal_cursor", () => {
    it("a pet with no logs -> {items:[], nextCursor:null}", async () => {
      const ctx = await owner();
      const pet = await createPet(prisma, ctx.household.id);

      const res = await ctx.authedAgent("get", `/v1/pets/${pet.id}/logs`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ items: [], nextCursor: null });
    });

    it("a cursor placed past the very last row -> [], never an error", async () => {
      const ctx = await owner();
      const pet = await createPet(prisma, ctx.household.id);
      await createLog(ctx, pet.id, { occurredAt: "2026-07-15T09:00:00.000Z" });

      const pastEndCursor = encodeCursor({
        o: "2000-01-01T00:00:00.000Z",
        s: 0,
        i: "00000000-0000-0000-0000-000000000000",
      });

      const res = await ctx.authedAgent("get", `/v1/pets/${pet.id}/logs?cursor=${pastEndCursor}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ items: [], nextCursor: null });
    });
  });

  describe("weight-series (happy + validation)", () => {
    it("returns an ascending series of grams for created WEIGHT logs", async () => {
      const ctx = await owner();
      const pet = await createPet(prisma, ctx.household.id);
      await createLog(ctx, pet.id, {
        kind: "WEIGHT",
        occurredAt: "2026-07-14T09:00:00.000Z",
        value: { weightGrams: 10_000 },
      });
      await createLog(ctx, pet.id, {
        kind: "WEIGHT",
        occurredAt: "2026-07-15T09:00:00.000Z",
        value: { weightGrams: 10_200 },
      });

      const res = await ctx.authedAgent("get", `/v1/pets/${pet.id}/weight-series`);

      expect(res.status).toBe(200);
      expect(res.body.sampled).toBe(false);
      expect(res.body.points).toEqual([
        { t: "2026-07-14T09:00:00.000Z", grams: 10_000 },
        { t: "2026-07-15T09:00:00.000Z", grams: 10_200 },
      ]);
    });

    it("downsamples to <=200 points when more than 200 WEIGHT logs exist", async () => {
      const ctx = await owner();
      const pet = await createPet(prisma, ctx.household.id);

      const rows = Array.from({ length: 205 }, (_, i) => ({
        petId: pet.id,
        kind: "WEIGHT" as const,
        valueJson: { weightGrams: 10_000 + i },
        occurredAt: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000),
      }));
      await prisma.healthLog.createMany({ data: rows });

      const res = await ctx.authedAgent("get", `/v1/pets/${pet.id}/weight-series`);

      expect(res.status).toBe(200);
      expect(res.body.sampled).toBe(true);
      expect(res.body.points.length).toBeLessThanOrEqual(200);
    });

    it("invalid from -> 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();
      const pet = await createPet(prisma, ctx.household.id);

      const res = await ctx.authedAgent("get", `/v1/pets/${pet.id}/weight-series?from=not-a-date`);

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("no token -> 401 UNAUTHORIZED", async () => {
      const res = await request(app.getHttpServer()).get("/v1/pets/some-pet-id/weight-series");

      expect(res.status).toBe(401);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
    });

    it("pet in another household -> 404 NOT_FOUND (no leak)", async () => {
      const ownerA = await owner();
      const ownerB = await owner();
      const pet = await createPet(prisma, ownerA.household.id);

      const res = await ownerB.authedAgent("get", `/v1/pets/${pet.id}/weight-series`);

      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });
  });

  describe("vet-summary (happy + auth)", () => {
    it("GET returns a 200 with a disclaimer-terminated, <=2500-char summary", async () => {
      const ctx = await owner();
      const pet = await createPet(prisma, ctx.household.id);
      const recent = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

      await createLog(ctx, pet.id, { kind: "WEIGHT", occurredAt: recent(10), value: { weightGrams: 12_000 } });
      await createLog(ctx, pet.id, { kind: "NOTE", occurredAt: recent(2), value: { text: "Ate normally today." } });

      // A completed MEDICATION ReminderEvent -- read-time MED_GIVEN projection (reused pattern from filter_by_each_kind).
      await seedCompletedMedication(prisma, pet.id, {
        at: recent(5),
        medNameAsEntered: "Amoxicillin",
        medDoseAsEntered: "As prescribed",
      });

      // A terminal SymptomCheck + TriageResult -- seeded directly (no queue/AI provider round-trip in this suite).
      const check = await prisma.symptomCheck.create({
        data: {
          petId: pet.id,
          createdById: ctx.user.id,
          status: "DONE",
          category: "digestive",
          intakeJson: { category: "digestive" },
          createdAt: new Date(recent(3)),
        },
      });
      await prisma.triageResult.create({
        data: {
          checkId: check.id,
          urgency: "VET_SOON",
          confidence: "medium",
          resultJson: {
            urgency: "VET_SOON",
            confidence: "medium",
            summary: "A minor issue that should be checked.",
            possibleCauses: [],
            redFlagsToWatch: [],
            homeCare: [],
            doNot: [],
            vetQuestions: [],
            followUpHours: 24,
          },
          modelId: "test-model",
          promptVersion: "v1",
        },
      });

      const res = await ctx.authedAgent("get", `/v1/pets/${pet.id}/vet-summary`);

      expect(res.status).toBe(200);
      expect(typeof res.body.summary).toBe("string");
      expect((res.body.summary as string).endsWith(VET_SUMMARY_DISCLAIMER)).toBe(true);
      expect((res.body.summary as string).length).toBeLessThanOrEqual(VET_SUMMARY_MAX_CHARS);
    });

    // Non-vacuity mutation-proof #2 (real-DB half -- see also the
    // HealthLogsService.vetSummary unit test "only ever queries ... WEIGHT
    // or NOTE" for the service-level half). ACTIVITY entries are kept OUT of
    // the vet-summary digest for now (they'd flood it) -- adding several
    // ACTIVITY rows inside the 90-day window must not change the summary at
    // all versus the baseline computed without them.
    it("ACTIVITY entries do not appear in or affect the vet summary (kept OUT of the digest)", async () => {
      const ctx = await owner();
      const pet = await createPet(prisma, ctx.household.id);
      const recent = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

      await createLog(ctx, pet.id, { kind: "WEIGHT", occurredAt: recent(10), value: { weightGrams: 12_000 } });
      await createLog(ctx, pet.id, { kind: "NOTE", occurredAt: recent(2), value: { text: "Ate normally today." } });

      const baseline = await ctx.authedAgent("get", `/v1/pets/${pet.id}/vet-summary`);
      expect(baseline.status).toBe(200);

      await createLog(ctx, pet.id, {
        kind: "ACTIVITY",
        occurredAt: recent(1),
        value: { activityType: "FOOD", quantity: 2, unit: "meals" },
      });
      await createLog(ctx, pet.id, {
        kind: "ACTIVITY",
        occurredAt: recent(1),
        value: { activityType: "WALK", quantity: 20, unit: "min" },
      });

      const withActivity = await ctx.authedAgent("get", `/v1/pets/${pet.id}/vet-summary`);

      expect(withActivity.status).toBe(200);
      expect(withActivity.body.summary).toEqual(baseline.body.summary);
      expect(withActivity.body.summary as string).not.toContain("FOOD");
      expect(withActivity.body.summary as string).not.toContain("WALK");
    });

    it("no token -> 401 UNAUTHORIZED", async () => {
      const res = await request(app.getHttpServer()).get("/v1/pets/some-pet-id/vet-summary");

      expect(res.status).toBe(401);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
    });

    it("pet in another household -> 404 NOT_FOUND (no leak)", async () => {
      const ownerA = await owner();
      const ownerB = await owner();
      const pet = await createPet(prisma, ownerA.household.id);

      const res = await ownerB.authedAgent("get", `/v1/pets/${pet.id}/vet-summary`);

      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });
  });
});
