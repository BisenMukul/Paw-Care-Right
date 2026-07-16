import { FAMILY_PLAN_PRODUCT_ID } from "@pawcareright/types";

import type { PrismaService } from "../prisma/prisma.service";
import { BillingService } from "./billing.service";
import type { SubscriptionRow } from "./entitlement.util";

describe("BillingService", () => {
  const userId = "user-1";
  const householdId = "household-1";

  function buildRow(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
    return {
      rcAppUserId: userId,
      householdId,
      entitlement: "PREMIUM",
      plan: "pawcareright_monthly",
      expiresAt: new Date(Date.now() + 60_000),
      ...overrides,
    };
  }

  function buildPrisma(overrides: {
    findUnique?: jest.Mock;
    findMany?: jest.Mock;
  }): PrismaService {
    return {
      subscription: {
        findUnique: overrides.findUnique ?? jest.fn().mockResolvedValue(null),
        findMany: overrides.findMany ?? jest.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService;
  }

  describe("getEntitlement", () => {
    it("resolves FREE/none when the caller has no subscriptions", async () => {
      const findUnique = jest.fn().mockResolvedValue(null);
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new BillingService(buildPrisma({ findUnique, findMany }));

      const result = await service.getEntitlement(userId, householdId);

      expect(result).toEqual({ entitled: false, source: "none", plan: null, expiresAt: null });
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
        plan: "pawcareright_monthly",
        expiresAt: expiresAt.toISOString(),
      });
    });

    it("treats an own PREMIUM sub past expiresAt as not entitled", async () => {
      const expiresAt = new Date(Date.now() - 60_000);
      const findUnique = jest.fn().mockResolvedValue(buildRow({ expiresAt }));
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new BillingService(buildPrisma({ findUnique, findMany }));

      const result = await service.getEntitlement(userId, householdId);

      expect(result).toEqual({ entitled: false, source: "none", plan: null, expiresAt: null });
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
      });
    });

    it("does NOT entitle from another member's active NON-family sub", async () => {
      const findUnique = jest.fn().mockResolvedValue(null);
      const findMany = jest.fn().mockResolvedValue([
        buildRow({ rcAppUserId: "other-member", plan: "pawcareright_monthly" }),
      ]);
      const service = new BillingService(buildPrisma({ findUnique, findMany }));

      const result = await service.getEntitlement(userId, householdId);

      expect(result).toEqual({ entitled: false, source: "none", plan: null, expiresAt: null });
    });

    it("does NOT entitle from an expired family sub", async () => {
      const expiresAt = new Date(Date.now() - 60_000);
      const findUnique = jest.fn().mockResolvedValue(null);
      const findMany = jest.fn().mockResolvedValue([
        buildRow({ rcAppUserId: "other-member", plan: FAMILY_PLAN_PRODUCT_ID, expiresAt }),
      ]);
      const service = new BillingService(buildPrisma({ findUnique, findMany }));

      const result = await service.getEntitlement(userId, householdId);

      expect(result).toEqual({ entitled: false, source: "none", plan: null, expiresAt: null });
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

    it("issues exactly one findUnique(rcAppUserId) and one findMany(householdId) -- no N+1", async () => {
      const findUnique = jest.fn().mockResolvedValue(null);
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new BillingService(buildPrisma({ findUnique, findMany }));

      await service.getEntitlement(userId, householdId);

      expect(findUnique).toHaveBeenCalledTimes(1);
      expect(findUnique).toHaveBeenCalledWith({ where: { rcAppUserId: userId } });
      expect(findMany).toHaveBeenCalledTimes(1);
      expect(findMany).toHaveBeenCalledWith({ where: { householdId } });
    });
  });
});
