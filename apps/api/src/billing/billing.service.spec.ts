import { FAMILY_PLAN_PRODUCT_ID } from "@bombaypetcompany/types";

import type { PrismaService } from "../prisma/prisma.service";
import { BillingService } from "./billing.service";
import type { SubscriptionRow } from "./entitlement.util";
import { RC_WEBHOOK_STATUS } from "./rc-webhook.state";
import { REFERRAL_GRANT_MS } from "./referral.constants";

describe("BillingService", () => {
  const userId = "user-1";
  const householdId = "household-1";

  function buildRow(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
    return {
      rcAppUserId: userId,
      householdId,
      entitlement: "PREMIUM",
      plan: "bombaypetcompany_monthly",
      expiresAt: new Date(Date.now() + 60_000),
      status: RC_WEBHOOK_STATUS.ACTIVE,
      ...overrides,
    };
  }

  function buildPrisma(overrides: {
    findUnique?: jest.Mock;
    findMany?: jest.Mock;
    grantFindMany?: jest.Mock;
  }): PrismaService {
    return {
      subscription: {
        findUnique: overrides.findUnique ?? jest.fn().mockResolvedValue(null),
        findMany: overrides.findMany ?? jest.fn().mockResolvedValue([]),
      },
      referralGrant: {
        findMany: overrides.grantFindMany ?? jest.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService;
  }

  describe("getEntitlement", () => {
    it("resolves FREE/none when the caller has no subscriptions", async () => {
      const findUnique = jest.fn().mockResolvedValue(null);
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new BillingService(buildPrisma({ findUnique, findMany }));

      const result = await service.getEntitlement(userId, householdId);

      expect(result).toEqual({ entitled: false, source: "none", plan: null, expiresAt: null, billingIssue: false });
    });

    it("resolves entitled/own for the caller's own active PREMIUM sub", async () => {
      const expiresAt = new Date(Date.now() + 60_000);
      const findUnique = jest.fn().mockResolvedValue(buildRow({ expiresAt }));
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new BillingService(buildPrisma({ findUnique, findMany }));

      const result = await service.getEntitlement(userId, householdId);

      expect(result).toEqual({
        entitled: true,
        source: "own",
        plan: "bombaypetcompany_monthly",
        expiresAt: expiresAt.toISOString(),
        billingIssue: false,
      });
    });

    it("treats an own PREMIUM sub past expiresAt as not entitled", async () => {
      const expiresAt = new Date(Date.now() - 60_000);
      const findUnique = jest.fn().mockResolvedValue(buildRow({ expiresAt }));
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new BillingService(buildPrisma({ findUnique, findMany }));

      const result = await service.getEntitlement(userId, householdId);

      expect(result).toEqual({ entitled: false, source: "none", plan: null, expiresAt: null, billingIssue: false });
    });

    it("resolves entitled/family from another member's active family sub", async () => {
      const expiresAt = new Date(Date.now() + 60_000);
      const findUnique = jest.fn().mockResolvedValue(null);
      const findMany = jest.fn().mockResolvedValue([
        buildRow({ rcAppUserId: "other-member", plan: FAMILY_PLAN_PRODUCT_ID, expiresAt }),
      ]);
      const service = new BillingService(buildPrisma({ findUnique, findMany }));

      const result = await service.getEntitlement(userId, householdId);

      expect(result).toEqual({
        entitled: true,
        source: "family",
        plan: FAMILY_PLAN_PRODUCT_ID,
        expiresAt: expiresAt.toISOString(),
        billingIssue: false,
      });
    });

    it("does NOT entitle from another member's active NON-family sub", async () => {
      const findUnique = jest.fn().mockResolvedValue(null);
      const findMany = jest.fn().mockResolvedValue([
        buildRow({ rcAppUserId: "other-member", plan: "bombaypetcompany_monthly" }),
      ]);
      const service = new BillingService(buildPrisma({ findUnique, findMany }));

      const result = await service.getEntitlement(userId, householdId);

      expect(result).toEqual({ entitled: false, source: "none", plan: null, expiresAt: null, billingIssue: false });
    });

    it("does NOT entitle from an expired family sub", async () => {
      const expiresAt = new Date(Date.now() - 60_000);
      const findUnique = jest.fn().mockResolvedValue(null);
      const findMany = jest.fn().mockResolvedValue([
        buildRow({ rcAppUserId: "other-member", plan: FAMILY_PLAN_PRODUCT_ID, expiresAt }),
      ]);
      const service = new BillingService(buildPrisma({ findUnique, findMany }));

      const result = await service.getEntitlement(userId, householdId);

      expect(result).toEqual({ entitled: false, source: "none", plan: null, expiresAt: null, billingIssue: false });
    });

    it("marks billingIssue true for the caller's own PREMIUM sub in billing_issue status", async () => {
      const expiresAt = new Date(Date.now() + 60_000);
      const findUnique = jest
        .fn()
        .mockResolvedValue(buildRow({ expiresAt, status: RC_WEBHOOK_STATUS.BILLING_ISSUE }));
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new BillingService(buildPrisma({ findUnique, findMany }));

      const result = await service.getEntitlement(userId, householdId);

      expect(result).toEqual({
        entitled: true,
        source: "own",
        plan: "bombaypetcompany_monthly",
        expiresAt: expiresAt.toISOString(),
        billingIssue: true,
      });
    });

    it("own active sub takes precedence over a covering family sub (strongest pick)", async () => {
      const ownExpiresAt = new Date(Date.now() + 30_000);
      const familyExpiresAt = new Date(Date.now() + 90_000);
      const findUnique = jest.fn().mockResolvedValue(buildRow({ expiresAt: ownExpiresAt }));
      const findMany = jest.fn().mockResolvedValue([
        buildRow({ rcAppUserId: "other-member", plan: FAMILY_PLAN_PRODUCT_ID, expiresAt: familyExpiresAt }),
      ]);
      const service = new BillingService(buildPrisma({ findUnique, findMany }));

      const result = await service.getEntitlement(userId, householdId);

      expect(result.source).toBe("own");
      expect(result.expiresAt).toBe(ownExpiresAt.toISOString());
    });

    it("picks the family row with the latest expiresAt among multiple", async () => {
      const earlier = new Date(Date.now() + 30_000);
      const later = new Date(Date.now() + 90_000);
      const findUnique = jest.fn().mockResolvedValue(null);
      const findMany = jest.fn().mockResolvedValue([
        buildRow({ rcAppUserId: "member-a", plan: FAMILY_PLAN_PRODUCT_ID, expiresAt: later }),
        buildRow({ rcAppUserId: "member-b", plan: FAMILY_PLAN_PRODUCT_ID, expiresAt: earlier }),
      ]);
      const service = new BillingService(buildPrisma({ findUnique, findMany }));

      const result = await service.getEntitlement(userId, householdId);

      expect(result.expiresAt).toBe(later.toISOString());
    });

    it("issues exactly one findUnique(rcAppUserId), one findMany(householdId), and one referralGrant.findMany -- no N+1", async () => {
      const findUnique = jest.fn().mockResolvedValue(null);
      const findMany = jest.fn().mockResolvedValue([]);
      const grantFindMany = jest.fn().mockResolvedValue([]);
      const service = new BillingService(buildPrisma({ findUnique, findMany, grantFindMany }));

      await service.getEntitlement(userId, householdId);

      expect(findUnique).toHaveBeenCalledTimes(1);
      expect(findUnique).toHaveBeenCalledWith({ where: { rcAppUserId: userId } });
      expect(findMany).toHaveBeenCalledTimes(1);
      expect(findMany).toHaveBeenCalledWith({ where: { householdId } });
      expect(grantFindMany).toHaveBeenCalledTimes(1);
      const call = grantFindMany.mock.calls[0][0] as { where: { userId: string; expiresAt: { gt: Date } } };
      expect(call.where.userId).toBe(userId);
      expect(call.where.expiresAt.gt).toBeInstanceOf(Date);
    });

    // T108: the grant read path (D1/D2) -- a THIRD, RC-independent input.
    describe("referral grant source (T108)", () => {
      it("resolves entitled/grant from an active referral grant when there is no subscription", async () => {
        const now = Date.now();
        const grantFindMany = jest
          .fn()
          .mockResolvedValue([{ startsAt: new Date(now), expiresAt: new Date(now + REFERRAL_GRANT_MS) }]);
        const service = new BillingService(buildPrisma({ grantFindMany }));

        const result = await service.getEntitlement(userId, householdId);

        expect(result.entitled).toBe(true);
        expect(result.source).toBe("grant");
        expect(result.plan).toBeNull();
        expect(result.billingIssue).toBe(false);
      });

      it("an own active sub takes precedence over an active grant (source own, RC expiresAt reported)", async () => {
        const ownExpiresAt = new Date(Date.now() + 30_000);
        const findUnique = jest.fn().mockResolvedValue(buildRow({ expiresAt: ownExpiresAt }));
        const grantFindMany = jest
          .fn()
          .mockResolvedValue([{ startsAt: new Date(), expiresAt: new Date(Date.now() + REFERRAL_GRANT_MS) }]);
        const service = new BillingService(buildPrisma({ findUnique, grantFindMany }));

        const result = await service.getEntitlement(userId, householdId);

        expect(result.source).toBe("own");
        expect(result.expiresAt).toBe(ownExpiresAt.toISOString());
      });

      it("a family sub takes precedence over a grant", async () => {
        const familyExpiresAt = new Date(Date.now() + 30_000);
        const findMany = jest
          .fn()
          .mockResolvedValue([
            { rcAppUserId: "other-member", householdId, entitlement: "PREMIUM", plan: FAMILY_PLAN_PRODUCT_ID, expiresAt: familyExpiresAt, status: RC_WEBHOOK_STATUS.ACTIVE },
          ]);
        const grantFindMany = jest
          .fn()
          .mockResolvedValue([{ startsAt: new Date(), expiresAt: new Date(Date.now() + REFERRAL_GRANT_MS) }]);
        const service = new BillingService(buildPrisma({ findMany, grantFindMany }));

        const result = await service.getEntitlement(userId, householdId);

        expect(result.source).toBe("family");
      });

      it("an expired grant does not entitle", async () => {
        const grantFindMany = jest
          .fn()
          .mockResolvedValue([{ startsAt: new Date(Date.now() - 2000), expiresAt: new Date(Date.now() - 1000) }]);
        const service = new BillingService(buildPrisma({ grantFindMany }));

        const result = await service.getEntitlement(userId, householdId);

        expect(result).toEqual({ entitled: false, source: "none", plan: null, expiresAt: null, billingIssue: false });
      });

      it("reports the chained tip (+42d) for 3 stacked grants", async () => {
        const now = Date.now();
        const g1 = { startsAt: new Date(now), expiresAt: new Date(now + REFERRAL_GRANT_MS) };
        const g2 = { startsAt: g1.expiresAt, expiresAt: new Date(g1.expiresAt.getTime() + REFERRAL_GRANT_MS) };
        const g3 = { startsAt: g2.expiresAt, expiresAt: new Date(g2.expiresAt.getTime() + REFERRAL_GRANT_MS) };
        const grantFindMany = jest.fn().mockResolvedValue([g1, g2, g3]);
        const service = new BillingService(buildPrisma({ grantFindMany }));

        const result = await service.getEntitlement(userId, householdId);

        expect(result.source).toBe("grant");
        expect(result.expiresAt).toBe(g3.expiresAt.toISOString());
      });
    });
  });
});
