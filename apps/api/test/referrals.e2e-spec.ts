import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { billingEntitlementSchema, errorResponseSchema } from "@bombaypetcompany/types";
import { PrismaClient } from "@prisma/client";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { REFERRAL_GRANT_DAYS, REFERRAL_GRANT_MAX_PER_USER } from "../src/billing/referral.constants";
import {
  cleanupUsers,
  createOwnerContext,
  createReferralGrant,
  createSubscription,
  overrideCheckRunner,
  resolveJwtService,
  type AuthedContext,
} from "./factories";

const REFERRAL_GRANT_MS = REFERRAL_GRANT_DAYS * 24 * 60 * 60 * 1000;
const DAY_TOLERANCE_MS = 5000;

/**
 * T108 real Postgres round-trip: household invite accept -> `ReferralGrant`
 * issuance -> `GET /billing/entitlement` reading the grant back. Modelled on
 * `households.e2e-spec.ts` (invite lifecycle helpers) and
 * `billing.e2e-spec.ts` (entitlement read). T107 lesson: entitlement is
 * asserted by re-reading through the real `GET /v1/billing/entitlement`
 * endpoint, never only against seeded rows.
 */
describe("Referral grants (e2e)", () => {
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

  describe("AC2: +14 days both sides on accept", () => {
    it("POST /v1/households/invites/accept -> 200 and creates exactly 2 ReferralGrant rows (joiner + inviter), each ~14 days, each naming the other as counterparty", async () => {
      const inviterCtx = await owner();
      const joinerCtx = await owner();

      const invite = await mintInvite(inviterCtx);
      const before = Date.now();

      const acceptRes = await joinerCtx
        .authedAgent("post", "/v1/households/invites/accept")
        .send({ code: invite.code });
      expect(acceptRes.status).toBe(200);

      const joinerGrants = await prisma.referralGrant.findMany({ where: { userId: joinerCtx.user.id } });
      const inviterGrants = await prisma.referralGrant.findMany({ where: { userId: inviterCtx.user.id } });

      expect(joinerGrants).toHaveLength(1);
      expect(inviterGrants).toHaveLength(1);

      const joinerGrant = joinerGrants[0]!;
      const inviterGrant = inviterGrants[0]!;

      expect(joinerGrant.counterpartyUserId).toBe(inviterCtx.user.id);
      expect(inviterGrant.counterpartyUserId).toBe(joinerCtx.user.id);

      for (const grant of [joinerGrant, inviterGrant]) {
        const durationMs = grant.expiresAt.getTime() - grant.startsAt.getTime();
        expect(durationMs).toBe(REFERRAL_GRANT_MS);
        expect(grant.startsAt.getTime()).toBeGreaterThanOrEqual(before - DAY_TOLERANCE_MS);
      }
    });
  });

  describe("AC3: grant surfaces in the entitlement read path", () => {
    it("GET /v1/billing/entitlement for the joiner returns { entitled: true, source: 'grant' } and parses against billingEntitlementSchema", async () => {
      const inviterCtx = await owner();
      const joinerCtx = await owner();

      const invite = await mintInvite(inviterCtx);
      const acceptRes = await joinerCtx
        .authedAgent("post", "/v1/households/invites/accept")
        .send({ code: invite.code });
      expect(acceptRes.status).toBe(200);

      const entitlementRes = await joinerCtx.authedAgent("get", "/v1/billing/entitlement");
      expect(entitlementRes.status).toBe(200);

      const parsed = billingEntitlementSchema.parse(entitlementRes.body);
      expect(parsed.entitled).toBe(true);
      expect(parsed.source).toBe("grant");
      expect(parsed.plan).toBeNull();
    });
  });

  describe("AC1b: stacking cap enforced end-to-end", () => {
    it("a 4th accepted invite creates no additional grant row for a capped joiner (still exactly 3) and the join still returns 200", async () => {
      const cappedJoinerCtx = await owner();
      // Pre-seed the joiner at the lifetime cap via direct grants (not through
      // real invites -- isolates the cap assertion from invite plumbing).
      const now = new Date();
      for (let i = 0; i < REFERRAL_GRANT_MAX_PER_USER; i += 1) {
        const startsAt = new Date(now.getTime() + i * REFERRAL_GRANT_MS);
        await createReferralGrant(prisma, {
          userId: cappedJoinerCtx.user.id,
          startsAt,
          expiresAt: new Date(startsAt.getTime() + REFERRAL_GRANT_MS),
        });
      }

      const inviterCtx = await owner();
      const invite = await mintInvite(inviterCtx);

      const acceptRes = await cappedJoinerCtx
        .authedAgent("post", "/v1/households/invites/accept")
        .send({ code: invite.code });

      expect(acceptRes.status).toBe(200);

      const joinerGrants = await prisma.referralGrant.findMany({ where: { userId: cappedJoinerCtx.user.id } });
      expect(joinerGrants).toHaveLength(REFERRAL_GRANT_MAX_PER_USER);

      // The (uncapped) inviter still receives their own grant.
      const inviterGrants = await prisma.referralGrant.findMany({ where: { userId: inviterCtx.user.id } });
      expect(inviterGrants).toHaveLength(1);
    });
  });

  describe("F2 fix round: concurrent accepts crediting the same recipient never race (real Postgres, no mocked tx)", () => {
    it("two invites accepted concurrently, both crediting the same inviter: exactly 2 grant rows for the inviter, chained (non-overlapping) windows -- never both starting 'now'", async () => {
      // One inviter mints TWO invites; two different joiners accept them
      // CONCURRENTLY (Promise.all, real HTTP requests against the same app
      // instance, real Postgres connections -- no mocked transaction client
      // anywhere). Both accepts credit the SAME recipient (the inviter) as
      // their `inviterUserId` side. Without the F2 per-recipient advisory
      // lock, both concurrent `issueForAcceptedInvite` calls could read the
      // inviter's grant history as empty, both pass the cap check, and both
      // insert a window starting at "now" -- an over-credit AND a lost chain
      // (both windows overlapping instead of stacking). With the lock, one
      // accept's grant-issuance transaction is fully serialized before the
      // other's begins, so the second reads the first's already-committed
      // row and chains onto it.
      const inviterCtx = await owner();
      await grantPremium(inviterCtx);

      const invite1Res = await inviterCtx.authedAgent("post", "/v1/households/invites");
      expect(invite1Res.status).toBe(201);
      const invite2Res = await inviterCtx.authedAgent("post", "/v1/households/invites");
      expect(invite2Res.status).toBe(201);

      const joinerA = await owner();
      const joinerB = await owner();

      const [resA, resB] = await Promise.all([
        joinerA.authedAgent("post", "/v1/households/invites/accept").send({ code: invite1Res.body.code }),
        joinerB.authedAgent("post", "/v1/households/invites/accept").send({ code: invite2Res.body.code }),
      ]);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      const inviterGrants = await prisma.referralGrant.findMany({
        where: { userId: inviterCtx.user.id },
        orderBy: { startsAt: "asc" },
      });

      // Cap integrity: exactly 2 rows -- not 2-with-a-lost-race, not more.
      expect(inviterGrants).toHaveLength(2);
      const [first, second] = inviterGrants as [
        { startsAt: Date; expiresAt: Date },
        { startsAt: Date; expiresAt: Date },
      ];

      // Chain-tip integrity: the second window starts EXACTLY where the
      // first ends -- no overlap (which a lost race would produce: both
      // windows starting at the same "now") and no gap.
      expect(second.startsAt.getTime()).toBe(first.expiresAt.getTime());
      expect(second.expiresAt.getTime() - first.startsAt.getTime()).toBe(REFERRAL_GRANT_MS * 2);

      // Each joiner's OWN grant is unaffected by the race on the shared
      // recipient (their own history is empty going in, no contention).
      expect(await prisma.referralGrant.count({ where: { userId: joinerA.user.id } })).toBe(1);
      expect(await prisma.referralGrant.count({ where: { userId: joinerB.user.id } })).toBe(1);
    }, 20000);
  });

  describe("AC5: idempotency / no double-grant", () => {
    it("re-POSTing the same code -> 404 and creates no further grant rows", async () => {
      const inviterCtx = await owner();
      const joinerCtx = await owner();
      const invite = await mintInvite(inviterCtx);

      const firstRes = await joinerCtx
        .authedAgent("post", "/v1/households/invites/accept")
        .send({ code: invite.code });
      expect(firstRes.status).toBe(200);

      const grantCountAfterFirst = await prisma.referralGrant.count({
        where: { OR: [{ userId: joinerCtx.user.id }, { userId: inviterCtx.user.id }] },
      });
      expect(grantCountAfterFirst).toBe(2);

      const anotherJoinerCtx = await owner();
      const secondRes = await anotherJoinerCtx
        .authedAgent("post", "/v1/households/invites/accept")
        .send({ code: invite.code });
      expect(secondRes.status).toBe(404);

      const grantCountAfterSecond = await prisma.referralGrant.count({
        where: { OR: [{ userId: joinerCtx.user.id }, { userId: inviterCtx.user.id }] },
      });
      expect(grantCountAfterSecond).toBe(2);
      expect(await prisma.referralGrant.count({ where: { userId: anotherJoinerCtx.user.id } })).toBe(0);
    });

    it("an expired/unknown code -> 404 with zero grant rows", async () => {
      const joinerCtx = await owner();

      const res = await joinerCtx
        .authedAgent("post", "/v1/households/invites/accept")
        .send({ code: "ZZZZZZZZ" });

      expect(res.status).toBe(404);
      expect(await prisma.referralGrant.count({ where: { userId: joinerCtx.user.id } })).toBe(0);
    });

    it("accepting an invite for a household the caller already belongs to -> 409 with zero grant rows", async () => {
      const ownerCtx = await owner();
      const invite = await mintInvite(ownerCtx);

      const res = await ownerCtx
        .authedAgent("post", "/v1/households/invites/accept")
        .send({ code: invite.code });

      expect(res.status).toBe(409);
      expect(await prisma.referralGrant.count({ where: { userId: ownerCtx.user.id } })).toBe(0);
    });
  });

  describe("AC6: RC entitlement unaffected (server-side grace only)", () => {
    it("accepting an invite leaves the inviter's (target household's) Subscription row byte-identical", async () => {
      // The joiner's own solo household is deleted by the PRE-EXISTING (T026)
      // JOIN-REPLACES mechanic whenever the joiner is an OWNER with no pets
      // -- unrelated to T108 and orthogonal to this AC. The inviter's
      // household is the one being JOINED (never deleted here), so its
      // `Subscription` row is the clean byte-identical probe for "the grant
      // path never touches RC state".
      const inviterCtx = await owner();
      const joinerCtx = await owner();
      const invite = await mintInvite(inviterCtx);

      const beforeInviter = await prisma.subscription.findUnique({ where: { rcAppUserId: inviterCtx.user.id } });

      const acceptRes = await joinerCtx
        .authedAgent("post", "/v1/households/invites/accept")
        .send({ code: invite.code });
      expect(acceptRes.status).toBe(200);

      const afterInviter = await prisma.subscription.findUnique({ where: { rcAppUserId: inviterCtx.user.id } });

      expect(afterInviter).toEqual(beforeInviter);
    });

    it("a joiner with no Subscription row still has none after the accept", async () => {
      const inviterCtx = await owner();
      const joinerCtx = await owner();
      const invite = await mintInvite(inviterCtx);

      expect(await prisma.subscription.findUnique({ where: { rcAppUserId: joinerCtx.user.id } })).toBeNull();

      const acceptRes = await joinerCtx
        .authedAgent("post", "/v1/households/invites/accept")
        .send({ code: invite.code });
      expect(acceptRes.status).toBe(200);

      expect(await prisma.subscription.findUnique({ where: { rcAppUserId: joinerCtx.user.id } })).toBeNull();
    });
  });

  describe("AC7: auth + validation coverage", () => {
    it("accept with no token -> 401 UNAUTHORIZED (no grant rows)", async () => {
      const res = await request(app.getHttpServer())
        .post("/v1/households/invites/accept")
        .send({ code: "AB3DEFGH" });

      expect(res.status).toBe(401);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
    });

    it("accept with a malformed body -> 400 VALIDATION_FAILED (no grant rows)", async () => {
      const ctx = await owner();

      const res = await ctx.authedAgent("post", "/v1/households/invites/accept").send({ code: "not-a-code!" });

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
      expect(await prisma.referralGrant.count({ where: { userId: ctx.user.id } })).toBe(0);
    });
  });
});
