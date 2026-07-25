import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { AppConfigService } from "../src/config/app-config.service";
import { cleanupUsers, createOwnerContext, overrideCheckRunner, resolveJwtService, type AuthedContext } from "./factories";
import { FUZZ_SEED, hostileWebhookBodies, mulberry32 } from "./fuzz/seeded-corpus";

/**
 * T096 Phase D: webhook fuzz-ish suite, structurally modelled on
 * `billing-webhook.e2e-spec.ts` (same bootstrap + teardown idiom). New
 * coverage only -- does not duplicate the six existing cases there.
 *
 * D5 (plan): the malformed-JSON case asserts status only, never the
 * `{error:{code,message,requestId}}` envelope -- body-parser's SyntaxError
 * is raised in Express middleware before Nest's router, so
 * `AllExceptionsFilter` never sees it. If any case here ever observes a
 * `5xx`, that is a real finding (honesty ledger 4): STOP, do not soften the
 * assertion, write `loop/plans/T096.blocked.md`.
 */
describe("Billing — RC webhook fuzz (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;
  let authToken: string;

  const userIds: string[] = [];
  const eventIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await overrideCheckRunner(Test.createTestingModule({ imports: [AppModule] })).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = new PrismaClient();
    jwtService = resolveJwtService(app);
    authToken = app.get(AppConfigService).rcWebhookAuthToken;
  });

  afterAll(async () => {
    await prisma.processedWebhookEvent.deleteMany({ where: { eventId: { in: eventIds } } });
    await cleanupUsers(prisma, userIds);

    await prisma.$disconnect();
    await app.close();
  });

  const owner = (): Promise<AuthedContext> => createOwnerContext(app, prisma, jwtService, userIds);

  function trackEventId(id: string): string {
    eventIds.push(id);
    return id;
  }

  async function countRows(): Promise<{ processed: number; subscriptions: number }> {
    const [processed, subscriptions] = await Promise.all([
      prisma.processedWebhookEvent.count(),
      prisma.subscription.count(),
    ]);
    return { processed, subscriptions };
  }

  function postRaw(rawBody: string, token: string | null): request.Test {
    const req = request(app.getHttpServer())
      .post("/v1/billing/rc-webhook")
      .set("Content-Type", "application/json");
    if (token !== null) {
      req.set("Authorization", token);
    }
    return req.send(rawBody);
  }

  function postJson(body: unknown, token: string | null): request.Test {
    const req = request(app.getHttpServer()).post("/v1/billing/rc-webhook");
    if (token !== null) {
      req.set("Authorization", token);
    }
    return req.send(body as object);
  }

  it("malformed JSON body -> 4xx, never 5xx, never processed", async () => {
    const before = await countRows();

    const res = await postRaw('{"event":', authToken);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);

    const after = await countRows();
    expect(after).toEqual(before);
  });

  it("oversized body (2MB, over T017's 1MB limit) -> 413, not processed", async () => {
    const before = await countRows();
    const oversized = JSON.stringify({ event: { id: randomUUID(), type: "RENEWAL", padding: "x".repeat(2 * 1024 * 1024) } });

    const res = await postRaw(oversized, authToken);

    expect(res.status).toBe(413);

    const after = await countRows();
    expect(after).toEqual(before);
  });

  it("every JSON-valid corpus payload without a valid token -> 401 and zero state change", async () => {
    const rng = mulberry32(FUZZ_SEED);
    const corpus = hostileWebhookBodies(rng).filter((entry) => entry.body !== undefined);
    const before = await countRows();

    for (const entry of corpus) {
      const noHeader = await postJson(entry.body, null);
      expect(noHeader.status).toBe(401);

      const wrongToken = await postJson(entry.body, "wrong-token");
      expect(wrongToken.status).toBe(401);

      const emptyHeader = await postJson(entry.body, "");
      expect(emptyHeader.status).toBe(401);

      const hugeToken = await postJson(entry.body, "x".repeat(10_000));
      expect(hugeToken.status).toBe(401);
    }

    const after = await countRows();
    expect(after).toEqual(before);
  });

  it("type-confusion payloads are acked (200) without writing ProcessedWebhookEvent or Subscription rows", async () => {
    const rng = mulberry32(FUZZ_SEED);
    const corpus = hostileWebhookBodies(rng);
    const before = await countRows();

    for (const entry of corpus) {
      const res = entry.raw !== undefined ? await postRaw(entry.raw, authToken) : await postJson(entry.body, authToken);

      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      expect(res.status).not.toBe(500);
    }

    const after = await countRows();
    expect(after).toEqual(before);
  });

  it("a __proto__ payload does not pollute Object.prototype", async () => {
    const pollutionProbe = (): unknown => (({}) as Record<string, unknown>).pawcarePolluted;
    expect(pollutionProbe()).toBeUndefined();

    const res = await postRaw(
      `{"event":{"id":"${randomUUID()}","type":"RENEWAL","__proto__":{"pawcarePolluted":true}}}`,
      authToken,
    );

    expect(res.status).toBe(200);
    expect(pollutionProbe()).toBeUndefined();
  });

  it("replay with a mutated body is still a no-op: exactly one row, Subscription unchanged after the first call", async () => {
    const ctx = await owner();
    const eventId = trackEventId(randomUUID());

    const first = await postJson(
      {
        event: {
          id: eventId,
          type: "INITIAL_PURCHASE",
          app_user_id: ctx.user.id,
          product_id: "pawcareright_monthly",
          expiration_at_ms: Date.parse("2026-08-16T12:00:00.000Z"),
          event_timestamp_ms: Date.parse("2026-07-16T12:00:00.000Z"),
        },
      },
      authToken,
    );
    expect(first.status).toBe(200);

    const rowAfterFirst = await prisma.subscription.findUnique({ where: { rcAppUserId: ctx.user.id } });

    const second = await postJson(
      {
        event: {
          // Same eventId, different type/product/timestamp -- must be a no-op.
          id: eventId,
          type: "CANCELLATION",
          app_user_id: ctx.user.id,
          product_id: "some-other-product",
          expiration_at_ms: Date.parse("2020-01-01T00:00:00.000Z"),
          event_timestamp_ms: Date.parse("2020-01-01T00:00:00.000Z"),
        },
      },
      authToken,
    );
    expect(second.status).toBe(200);

    const rows = await prisma.processedWebhookEvent.findMany({ where: { eventId } });
    expect(rows).toHaveLength(1);

    const rowAfterSecond = await prisma.subscription.findUnique({ where: { rcAppUserId: ctx.user.id } });
    expect(rowAfterSecond).toEqual(rowAfterFirst);
  });

  it("interleaved replay storm keeps exactly-once semantics (no 5xx anywhere)", async () => {
    const ctx1 = await owner();
    const ctx2 = await owner();
    const ctx3 = await owner();

    const replayedId = trackEventId(randomUUID());
    const otherIds = [trackEventId(randomUUID()), trackEventId(randomUUID()), trackEventId(randomUUID())];
    const contexts = [ctx1, ctx2, ctx3];

    const replayedBody = {
      event: {
        id: replayedId,
        type: "RENEWAL",
        app_user_id: ctx1.user.id,
        event_timestamp_ms: Date.parse("2026-07-16T12:00:00.000Z"),
      },
    };

    const otherBodies = otherIds.map((id, i) => ({
      event: {
        id,
        type: "INITIAL_PURCHASE",
        app_user_id: contexts[i].user.id,
        event_timestamp_ms: Date.parse("2026-07-16T12:00:00.000Z"),
      },
    }));

    // Seeded interleaving: 5 replays of the same id, interleaved with the 3
    // other distinct ids, order fixed by the seed for reproducibility.
    const rng = mulberry32(FUZZ_SEED);
    const queue: unknown[] = [
      ...Array.from({ length: 5 }, () => replayedBody),
      ...otherBodies,
    ].sort(() => rng() - 0.5);

    const results = await Promise.all(queue.map((body) => postJson(body, authToken)));

    for (const res of results) {
      expect(res.status).toBeLessThan(500);
    }

    const replayedRows = await prisma.processedWebhookEvent.findMany({ where: { eventId: replayedId } });
    expect(replayedRows).toHaveLength(1);

    for (const id of otherIds) {
      const rows = await prisma.processedWebhookEvent.findMany({ where: { eventId: id } });
      expect(rows).toHaveLength(1);
    }
  });
});
