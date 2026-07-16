import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { billingEntitlementSchema, errorResponseSchema, FAMILY_PLAN_PRODUCT_ID } from "@pawcareright/types";
import { PrismaClient } from "@prisma/client";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { RC_WEBHOOK_STATUS } from "../src/billing/rc-webhook.state";
import {
  cleanupUsers,
  createMemberContext,
  createOwnerContext,
  createSubscription,
  overrideCheckRunner,
  resolveJwtService,
  type AuthedContext,
} from "./factories";

/**
 * Real Postgres round-trip for `GET /billing/entitlement` (T072).
 * `cleanupUsers` cascade-deletes `Subscription` rows through
 * `household.deleteMany` (`Subscription` -> `Household` is
 * `onDelete: Cascade`), so no direct `prisma.subscription` cleanup is
 * needed. This GET carries no request body/query, so there is no
 * validation-failure case to test -- auth (401) + happy-path (200) cover
 * §6's endpoint matrix.
 */
describe("Billing — entitlement (e2e)", () => {
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

  it("no sub -> 200 { entitled:false, source:'none' }", async () => {
    const ctx = await owner();

    const res = await ctx.authedAgent("get", "/v1/billing/entitlement");

    expect(res.status).toBe(200);
    const body = billingEntitlementSchema.parse(res.body);
    expect(body).toEqual({ entitled: false, source: "none", plan: null, expiresAt: null, billingIssue: false });
  });

  it("an active own sub -> 200 { entitled:true, source:'own' }", async () => {
    const ctx = await owner();
    const expiresAt = new Date(Date.now() + 60_000);
    await createSubscription(prisma, {
      rcAppUserId: ctx.user.id,
      householdId: ctx.household.id,
      entitlement: "PREMIUM",
      plan: "pawcareright_monthly",
      expiresAt,
    });

    const res = await ctx.authedAgent("get", "/v1/billing/entitlement");

    expect(res.status).toBe(200);
    const body = billingEntitlementSchema.parse(res.body);
    expect(body.entitled).toBe(true);
    expect(body.source).toBe("own");
    expect(body.expiresAt).toBe(expiresAt.toISOString());
  });

  it("an own sub in billing_issue status -> 200 { entitled:true, source:'own', billingIssue:true }", async () => {
    const ctx = await owner();
    const expiresAt = new Date(Date.now() + 60_000);
    await createSubscription(prisma, {
      rcAppUserId: ctx.user.id,
      householdId: ctx.household.id,
      entitlement: "PREMIUM",
      plan: "pawcareright_monthly",
      status: RC_WEBHOOK_STATUS.BILLING_ISSUE,
      expiresAt,
    });

    const res = await ctx.authedAgent("get", "/v1/billing/entitlement");

    expect(res.status).toBe(200);
    const body = billingEntitlementSchema.parse(res.body);
    expect(body.entitled).toBe(true);
    expect(body.source).toBe("own");
    expect(body.billingIssue).toBe(true);
  });

  it("a household member resolves entitled/family from the owner's active family sub", async () => {
    const ctx = await member();
    const expiresAt = new Date(Date.now() + 60_000);
    await createSubscription(prisma, {
      rcAppUserId: ctx.household.ownerId,
      householdId: ctx.household.id,
      entitlement: "PREMIUM",
      plan: FAMILY_PLAN_PRODUCT_ID,
      expiresAt,
    });

    const res = await ctx.authedAgent("get", "/v1/billing/entitlement");

    expect(res.status).toBe(200);
    const body = billingEntitlementSchema.parse(res.body);
    expect(body.entitled).toBe(true);
    expect(body.source).toBe("family");
  });

  it("no token -> 401 UNAUTHORIZED", async () => {
    const res = await request(app.getHttpServer()).get("/v1/billing/entitlement");

    expect(res.status).toBe(401);
    expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
  });
});
