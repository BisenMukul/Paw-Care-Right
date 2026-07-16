import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { errorResponseSchema } from "@pawcareright/types";
import { PrismaClient } from "@prisma/client";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { AppConfigService } from "../src/config/app-config.service";
import { cleanupUsers, createOwnerContext, overrideCheckRunner, resolveJwtService, type AuthedContext } from "./factories";

/**
 * Real Postgres round-trip for `POST /billing/rc-webhook` (T073). Fully
 * self-contained: builds RC event payloads inline, cleans its own
 * `ProcessedWebhookEvent` rows by `eventId` in `afterAll`, and reuses the
 * shared user/household factories for cleanup via `cleanupUsers`.
 */
describe("Billing — RC webhook (e2e)", () => {
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

  function envelope(overrides: {
    id: string;
    type: string;
    app_user_id?: string;
    product_id?: string;
    expiration_at_ms?: number;
    event_timestamp_ms?: number;
  }): { event: Record<string, unknown> } {
    return {
      event: {
        id: overrides.id,
        type: overrides.type,
        app_user_id: overrides.app_user_id,
        product_id: overrides.product_id ?? "pawcareright_monthly",
        expiration_at_ms: overrides.expiration_at_ms ?? Date.parse("2026-08-16T12:00:00.000Z"),
        event_timestamp_ms: overrides.event_timestamp_ms ?? Date.parse("2026-07-16T12:00:00.000Z"),
        environment: "SANDBOX",
        store: "APP_STORE",
      },
    };
  }

  // `token` uses `null` (never `undefined`) to mean "omit the header" -- a
  // default parameter only kicks in for an `undefined` argument, so an
  // explicit `undefined` here would silently fall back to `authToken`.
  function post(body: unknown, token: string | null = authToken): request.Test {
    const req = request(app.getHttpServer()).post("/v1/billing/rc-webhook");
    if (token !== null) {
      req.set("Authorization", token);
    }
    return req.send(body as object);
  }

  it("auth'd INITIAL_PURCHASE -> 200 and the Subscription row reflects PREMIUM/active", async () => {
    const ctx = await owner();
    const eventId = trackEventId(randomUUID());

    const res = await post(
      envelope({ id: eventId, type: "INITIAL_PURCHASE", app_user_id: ctx.user.id }),
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });

    const row = await prisma.subscription.findUnique({ where: { rcAppUserId: ctx.user.id } });
    expect(row?.entitlement).toBe("PREMIUM");
    expect(row?.status).toBe("active");
    expect(row?.householdId).toBe(ctx.household.id);
  });

  it("wrong Authorization header -> 401 UNAUTHORIZED", async () => {
    const eventId = trackEventId(randomUUID());

    const res = await post(envelope({ id: eventId, type: "RENEWAL", app_user_id: randomUUID() }), "wrong-token");

    expect(res.status).toBe(401);
    expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
  });

  it("missing Authorization header -> 401 UNAUTHORIZED", async () => {
    const eventId = trackEventId(randomUUID());

    const res = await post(envelope({ id: eventId, type: "RENEWAL", app_user_id: randomUUID() }), null);

    expect(res.status).toBe(401);
    expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
  });

  it("replay-safe: the same eventId POSTed twice -> both 200, exactly one ProcessedWebhookEvent row", async () => {
    const ctx = await owner();
    const eventId = trackEventId(randomUUID());
    const body = envelope({ id: eventId, type: "INITIAL_PURCHASE", app_user_id: ctx.user.id });

    const first = await post(body);
    const second = await post(body);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const rows = await prisma.processedWebhookEvent.findMany({ where: { eventId } });
    expect(rows).toHaveLength(1);

    const row = await prisma.subscription.findUnique({ where: { rcAppUserId: ctx.user.id } });
    expect(row?.entitlement).toBe("PREMIUM");
  });

  it("out-of-order: RENEWAL then an older-ts EXPIRATION -> final row stays PREMIUM", async () => {
    const ctx = await owner();
    const renewalEventId = trackEventId(randomUUID());
    const expirationEventId = trackEventId(randomUUID());

    const renewalRes = await post(
      envelope({
        id: renewalEventId,
        type: "RENEWAL",
        app_user_id: ctx.user.id,
        event_timestamp_ms: Date.parse("2026-07-16T12:00:00.000Z"),
      }),
    );
    expect(renewalRes.status).toBe(200);

    const olderExpirationRes = await post(
      envelope({
        id: expirationEventId,
        type: "EXPIRATION",
        app_user_id: ctx.user.id,
        event_timestamp_ms: Date.parse("2026-07-16T09:00:00.000Z"),
      }),
    );
    expect(olderExpirationRes.status).toBe(200);

    const row = await prisma.subscription.findUnique({ where: { rcAppUserId: ctx.user.id } });
    expect(row?.entitlement).toBe("PREMIUM");
    expect(row?.status).toBe("active");
  });

  it("out-of-order: EXPIRATION then an older-ts RENEWAL -> final row stays FREE/expired", async () => {
    const ctx = await owner();
    const expirationEventId = trackEventId(randomUUID());
    const renewalEventId = trackEventId(randomUUID());

    const expirationRes = await post(
      envelope({
        id: expirationEventId,
        type: "EXPIRATION",
        app_user_id: ctx.user.id,
        event_timestamp_ms: Date.parse("2026-07-16T12:00:00.000Z"),
      }),
    );
    expect(expirationRes.status).toBe(200);

    const olderRenewalRes = await post(
      envelope({
        id: renewalEventId,
        type: "RENEWAL",
        app_user_id: ctx.user.id,
        event_timestamp_ms: Date.parse("2026-07-16T09:00:00.000Z"),
      }),
    );
    expect(olderRenewalRes.status).toBe(200);

    const row = await prisma.subscription.findUnique({ where: { rcAppUserId: ctx.user.id } });
    expect(row?.entitlement).toBe("FREE");
    expect(row?.status).toBe("expired");
  });

  it("unknown/anonymous app_user_id -> 200, no Subscription row created", async () => {
    const eventId = trackEventId(randomUUID());
    const anonId = `$RCAnonymousID:${randomUUID()}`;

    const res = await post(envelope({ id: eventId, type: "INITIAL_PURCHASE", app_user_id: anonId }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });

    const row = await prisma.subscription.findUnique({ where: { rcAppUserId: anonId } });
    expect(row).toBeNull();
  });

  it("unknown event type -> 200, dedupe row present, no Subscription write", async () => {
    const ctx = await owner();
    const eventId = trackEventId(randomUUID());

    const res = await post(envelope({ id: eventId, type: "TRANSFER", app_user_id: ctx.user.id }));

    expect(res.status).toBe(200);

    const dedupeRow = await prisma.processedWebhookEvent.findUnique({ where: { eventId } });
    expect(dedupeRow).not.toBeNull();

    const row = await prisma.subscription.findUnique({ where: { rcAppUserId: ctx.user.id } });
    expect(row).toBeNull();
  });
});
