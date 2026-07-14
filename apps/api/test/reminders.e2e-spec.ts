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
  createOwnerContext,
  overrideCheckRunner,
  resolveJwtService,
  type AuthedContext,
} from "./factories";

/**
 * Real Postgres round-trip for the T055 reminders module (CRUD + agenda +
 * from-template). `cleanupUsers` cascade-deletes pets/reminders/events
 * through `household.deleteMany` (Pet -> Household is `onDelete: Cascade`,
 * Reminder/ReminderEvent -> Pet/Reminder are `onDelete: Cascade`), so no
 * direct `prisma.reminder`/`prisma.reminderEvent` cleanup is needed.
 */
describe("Reminders (e2e)", () => {
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

  async function createPet(ctx: AuthedContext, name = "Fido"): Promise<string> {
    const res = await ctx.authedAgent("post", "/v1/pets").send({ species: "DOG", name });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  function validReminderBody(overrides: Record<string, unknown> = {}) {
    return {
      type: "VACCINE",
      title: "Rabies booster",
      rrule: "FREQ=YEARLY",
      timezone: "Europe/Paris",
      startAt: "2026-08-01T09:00:00.000Z",
      ...overrides,
    };
  }

  describe("CRUD happy path", () => {
    it("create -> get -> list -> patch (rrule change updates nextFireAt) -> delete -> subsequent get 404", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);

      const created = await ctx.authedAgent("post", `/v1/pets/${petId}/reminders`).send(validReminderBody());
      expect(created.status).toBe(201);
      expect(created.body.nextFireAt).toBe("2026-08-01T09:00:00.000Z");
      const reminderId = created.body.id as string;

      const got = await ctx.authedAgent("get", `/v1/reminders/${reminderId}`);
      expect(got.status).toBe(200);
      expect(got.body.id).toBe(reminderId);

      const list = await ctx.authedAgent("get", `/v1/pets/${petId}/reminders`);
      expect(list.status).toBe(200);
      expect(list.body.items.map((item: { id: string }) => item.id)).toContain(reminderId);
      expect(list.body.nextCursor).toBeDefined();

      const patched = await ctx
        .authedAgent("patch", `/v1/reminders/${reminderId}`)
        .send({ rrule: "FREQ=DAILY", startAt: "2026-09-01T10:00:00.000Z" });
      expect(patched.status).toBe(200);
      expect(patched.body.rrule).toBe("FREQ=DAILY");
      expect(patched.body.nextFireAt).toBe("2026-09-01T10:00:00.000Z");

      const removed = await ctx.authedAgent("delete", `/v1/reminders/${reminderId}`);
      expect(removed.status).toBe(200);
      expect(removed.body.id).toBe(reminderId);

      const afterDelete = await ctx.authedAgent("get", `/v1/reminders/${reminderId}`);
      expect(afterDelete.status).toBe(404);
      expect(errorResponseSchema.parse(afterDelete.body).error.code).toBe("NOT_FOUND");
    });
  });

  describe("unauthenticated", () => {
    it("POST with no token -> 401 UNAUTHORIZED", async () => {
      const res = await request(app.getHttpServer())
        .post("/v1/pets/some-pet-id/reminders")
        .send(validReminderBody());

      expect(res.status).toBe(401);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
    });

    it("GET /v1/agenda with no token -> 401 UNAUTHORIZED", async () => {
      const res = await request(app.getHttpServer()).get(
        "/v1/agenda?from=2026-08-01T00:00:00.000Z&to=2026-08-02T00:00:00.000Z",
      );

      expect(res.status).toBe(401);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("validation", () => {
    it("malformed rrule -> 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);

      const res = await ctx
        .authedAgent("post", `/v1/pets/${petId}/reminders`)
        .send(validReminderBody({ rrule: "NOT_A_RRULE" }));

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("bad timezone -> 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);

      const res = await ctx
        .authedAgent("post", `/v1/pets/${petId}/reminders`)
        .send(validReminderBody({ timezone: "Not/A_Timezone" }));

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("out-of-set type -> 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);

      const res = await ctx
        .authedAgent("post", `/v1/pets/${petId}/reminders`)
        .send(validReminderBody({ type: "NOT_A_TYPE" }));

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("agenda missing from/to -> 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();

      const res = await ctx.authedAgent("get", "/v1/agenda");

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("agenda to<=from -> 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();

      const res = await ctx.authedAgent(
        "get",
        "/v1/agenda?from=2026-08-10T00:00:00.000Z&to=2026-08-01T00:00:00.000Z",
      );

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("agenda window > 92 days -> 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();

      const res = await ctx.authedAgent(
        "get",
        "/v1/agenda?from=2026-01-01T00:00:00.000Z&to=2026-06-01T00:00:00.000Z",
      );

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("cross-household scoping", () => {
    it("POST reminders on another household's pet -> 404 NOT_FOUND", async () => {
      const ownerA = await owner();
      const ownerB = await owner();
      const petId = await createPet(ownerA, "A's Dog");

      const res = await ownerB.authedAgent("post", `/v1/pets/${petId}/reminders`).send(validReminderBody());

      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });

    it("from-template on another household's pet -> 404 NOT_FOUND", async () => {
      const ownerA = await owner();
      const ownerB = await owner();
      const petId = await createPet(ownerA, "A's Dog");

      const res = await ownerB
        .authedAgent("post", `/v1/pets/${petId}/reminders/from-template`)
        .send({ timezone: "UTC" });

      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });

    it("GET/PATCH/DELETE another household's reminder -> 404 NOT_FOUND (no leak)", async () => {
      const ownerA = await owner();
      const ownerB = await owner();
      const petId = await createPet(ownerA, "A's Dog");
      const created = await ownerA.authedAgent("post", `/v1/pets/${petId}/reminders`).send(validReminderBody());
      expect(created.status).toBe(201);
      const reminderId = created.body.id as string;

      const getRes = await ownerB.authedAgent("get", `/v1/reminders/${reminderId}`);
      expect(getRes.status).toBe(404);
      expect(errorResponseSchema.parse(getRes.body).error.code).toBe("NOT_FOUND");

      const patchRes = await ownerB.authedAgent("patch", `/v1/reminders/${reminderId}`).send({ title: "Hijacked" });
      expect(patchRes.status).toBe(404);
      expect(errorResponseSchema.parse(patchRes.body).error.code).toBe("NOT_FOUND");

      const deleteRes = await ownerB.authedAgent("delete", `/v1/reminders/${reminderId}`);
      expect(deleteRes.status).toBe(404);
      expect(errorResponseSchema.parse(deleteRes.body).error.code).toBe("NOT_FOUND");

      // The reminder is untouched -- owner A still sees it.
      const stillThere = await ownerA.authedAgent("get", `/v1/reminders/${reminderId}`);
      expect(stillThere.status).toBe(200);
    });
  });

  describe("agenda merge (virtual + materialized)", () => {
    it("returns a virtual occurrence, then after a ReminderEvent is seeded in-window, that instant shows the event's status with an eventId", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);

      const created = await ctx.authedAgent("post", `/v1/pets/${petId}/reminders`).send(
        validReminderBody({ rrule: "FREQ=DAILY", timezone: "UTC", startAt: "2026-08-01T09:00:00.000Z" }),
      );
      expect(created.status).toBe(201);
      const reminderId = created.body.id as string;

      const beforeEvent = await ctx.authedAgent(
        "get",
        `/v1/agenda?from=2026-08-01T00:00:00.000Z&to=2026-08-01T23:59:59.000Z`,
      );
      expect(beforeEvent.status).toBe(200);
      const virtualEntry = beforeEvent.body.entries.find(
        (e: { reminderId: string; dueAt: string }) =>
          e.reminderId === reminderId && e.dueAt === "2026-08-01T09:00:00.000Z",
      );
      expect(virtualEntry).toBeDefined();
      expect(virtualEntry.virtual).toBe(true);
      expect(virtualEntry.status).toBe("SCHEDULED");
      expect(virtualEntry.eventId).toBeUndefined();

      const event = await prisma.reminderEvent.create({
        data: { reminderId, dueAt: new Date("2026-08-01T09:00:00.000Z"), status: "DONE" },
      });

      const afterEvent = await ctx.authedAgent(
        "get",
        `/v1/agenda?from=2026-08-01T00:00:00.000Z&to=2026-08-01T23:59:59.000Z`,
      );
      expect(afterEvent.status).toBe(200);
      const materializedEntry = afterEvent.body.entries.find(
        (e: { reminderId: string; dueAt: string }) =>
          e.reminderId === reminderId && e.dueAt === "2026-08-01T09:00:00.000Z",
      );
      expect(materializedEntry).toBeDefined();
      expect(materializedEntry.virtual).toBe(false);
      expect(materializedEntry.status).toBe("DONE");
      expect(materializedEntry.eventId).toBe(event.id);
    });

    it("petId filter -> 404 when the pet is outside the caller's household", async () => {
      const ownerA = await owner();
      const ownerB = await owner();
      const petId = await createPet(ownerA, "A's Dog");

      const res = await ownerB.authedAgent(
        "get",
        `/v1/agenda?from=2026-08-01T00:00:00.000Z&to=2026-08-02T00:00:00.000Z&petId=${petId}`,
      );

      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });
  });

  describe("template instantiation idempotency", () => {
    it("POST from-template twice -> GET /pets/:petId/reminders count is unchanged after the second call", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);

      const first = await ctx
        .authedAgent("post", `/v1/pets/${petId}/reminders/from-template`)
        .send({ timezone: "UTC" });
      expect(first.status).toBe(201);
      expect(first.body.created.length).toBeGreaterThan(0);
      expect(first.body.skipped).toBe(0);

      const afterFirst = await ctx.authedAgent("get", `/v1/pets/${petId}/reminders`);
      expect(afterFirst.status).toBe(200);
      const countAfterFirst = afterFirst.body.items.length;

      const second = await ctx
        .authedAgent("post", `/v1/pets/${petId}/reminders/from-template`)
        .send({ timezone: "UTC" });
      expect(second.status).toBe(201);
      expect(second.body.created).toEqual([]);
      expect(second.body.skipped).toBe(first.body.created.length);

      const afterSecond = await ctx.authedAgent("get", `/v1/pets/${petId}/reminders`);
      expect(afterSecond.status).toBe(200);
      expect(afterSecond.body.items.length).toBe(countAfterFirst);
    });
  });

  describe("template-suggestions (T059)", () => {
    it("GET returns 200 with noted items", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);

      const res = await ctx.authedAgent("get", `/v1/pets/${petId}/reminders/template-suggestions`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThan(0);
      for (const item of res.body.items as Array<{ note: string }>) {
        expect(item.note.length).toBeGreaterThan(0);
      }
    });

    it("GET with no token -> 401 UNAUTHORIZED", async () => {
      const res = await request(app.getHttpServer()).get(
        "/v1/pets/some-pet-id/reminders/template-suggestions",
      );

      expect(res.status).toBe(401);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
    });

    it("GET on another household's pet -> 404 NOT_FOUND", async () => {
      const ownerA = await owner();
      const ownerB = await owner();
      const petId = await createPet(ownerA, "A's Dog");

      const res = await ownerB.authedAgent("get", `/v1/pets/${petId}/reminders/template-suggestions`);

      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });

    it("POST with selections:[oneKey] creates one reminder; a repeat is idempotent (skipped)", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);

      const suggestions = await ctx.authedAgent("get", `/v1/pets/${petId}/reminders/template-suggestions`);
      expect(suggestions.status).toBe(200);
      const targetKey = suggestions.body.items[0].templateKey as string;

      const first = await ctx
        .authedAgent("post", `/v1/pets/${petId}/reminders/from-template`)
        .send({ timezone: "UTC", selections: [{ templateKey: targetKey, startAt: "2026-09-01T09:00:00.000Z" }] });
      expect(first.status).toBe(201);
      expect(first.body.created).toHaveLength(1);
      expect(first.body.created[0].templateKey).toBe(targetKey);

      const second = await ctx
        .authedAgent("post", `/v1/pets/${petId}/reminders/from-template`)
        .send({ timezone: "UTC", selections: [{ templateKey: targetKey, startAt: "2026-09-01T09:00:00.000Z" }] });
      expect(second.status).toBe(201);
      expect(second.body.created).toEqual([]);
      expect(second.body.skipped).toBe(1);
    });

    it("a bad selections[].startAt (non-ISO) -> 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);

      const res = await ctx
        .authedAgent("post", `/v1/pets/${petId}/reminders/from-template`)
        .send({ timezone: "UTC", selections: [{ templateKey: "rabies-core", startAt: "not-a-date" }] });

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });
  });
});
