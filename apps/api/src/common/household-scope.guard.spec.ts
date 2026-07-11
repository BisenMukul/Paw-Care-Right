import type { ExecutionContext } from "@nestjs/common";
import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

import type { PrismaService } from "../prisma/prisma.service";
import type { RequestWithHouseholdScope } from "./authenticated-request";
import { HouseholdScopeGuard } from "./household-scope.guard";

function buildContext(request: Partial<RequestWithHouseholdScope>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => (): void => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe("HouseholdScopeGuard", () => {
  function buildGuard(overrides: {
    getAllAndOverride?: jest.Mock;
    findUnique?: jest.Mock;
    findMany?: jest.Mock;
  }) {
    const reflector = {
      getAllAndOverride: overrides.getAllAndOverride ?? jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;

    const prisma = {
      membership: {
        findUnique: overrides.findUnique ?? jest.fn(),
        findMany: overrides.findMany ?? jest.fn(),
      },
    } as unknown as PrismaService;

    return { guard: new HouseholdScopeGuard(prisma, reflector), reflector, prisma };
  }

  /**
   * Mimics `Reflector.getAllAndOverride`'s real behavior across the two
   * independent metadata keys read by the guard: param-mode
   * (`HOUSEHOLD_SCOPE_PARAM_KEY`) returns `paramValue`, from-membership mode
   * (`HOUSEHOLD_SCOPE_FROM_MEMBERSHIP_KEY`) returns `fromMembershipValue`.
   */
  function reflectorFor(paramValue: string | undefined, fromMembershipValue: boolean | undefined) {
    return jest.fn((key: string) => {
      if (key === "householdScopeParam") {
        return paramValue;
      }
      if (key === "householdScopeFromMembership") {
        return fromMembershipValue;
      }
      return undefined;
    });
  }

  it("no @HouseholdScoped metadata → returns true without querying Prisma", async () => {
    const findUnique = jest.fn();
    const { guard } = buildGuard({ findUnique });
    const request: Partial<RequestWithHouseholdScope> = {
      user: { userId: "user-1" },
      params: {},
    };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("missing req.user → throws UnauthorizedException (fail closed)", async () => {
    const { guard } = buildGuard({
      getAllAndOverride: jest.fn().mockReturnValue("householdId"),
    });
    const request: Partial<RequestWithHouseholdScope> = { params: { householdId: "h1" } };

    await expect(guard.canActivate(buildContext(request))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("missing householdId route param → throws NotFoundException", async () => {
    const findUnique = jest.fn();
    const { guard } = buildGuard({
      getAllAndOverride: jest.fn().mockReturnValue("householdId"),
      findUnique,
    });
    const request: Partial<RequestWithHouseholdScope> = {
      user: { userId: "user-1" },
      params: {},
    };

    await expect(guard.canActivate(buildContext(request))).rejects.toBeInstanceOf(NotFoundException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("no membership row → throws NotFoundException (never a 403 leak)", async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const { guard } = buildGuard({
      getAllAndOverride: jest.fn().mockReturnValue("householdId"),
      findUnique,
    });
    const request: Partial<RequestWithHouseholdScope> = {
      user: { userId: "user-1" },
      params: { householdId: "h1" },
    };

    await expect(guard.canActivate(buildContext(request))).rejects.toBeInstanceOf(NotFoundException);
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId_householdId: { userId: "user-1", householdId: "h1" } },
    });
  });

  it("membership found → injects req.householdScope and returns true", async () => {
    const findUnique = jest.fn().mockResolvedValue({ householdId: "h1", role: "OWNER" });
    const { guard } = buildGuard({
      getAllAndOverride: jest.fn().mockReturnValue("householdId"),
      findUnique,
    });
    const request: Partial<RequestWithHouseholdScope> = {
      user: { userId: "user-1" },
      params: { householdId: "h1" },
    };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(request.householdScope).toEqual({ householdId: "h1", role: "OWNER" });
  });

  it("resolves the household id from a custom param name", async () => {
    const findUnique = jest.fn().mockResolvedValue({ householdId: "h2", role: "MEMBER" });
    const { guard } = buildGuard({
      getAllAndOverride: jest.fn().mockReturnValue("id"),
      findUnique,
    });
    const request: Partial<RequestWithHouseholdScope> = {
      user: { userId: "user-2" },
      params: { id: "h2" },
    };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId_householdId: { userId: "user-2", householdId: "h2" } },
    });
  });

  describe("resolve-from-membership mode (@HouseholdFromMembership)", () => {
    it("both metadata absent → returns true without querying Prisma (no-op non-regression)", async () => {
      const findMany = jest.fn();
      const { guard } = buildGuard({
        getAllAndOverride: reflectorFor(undefined, undefined),
        findMany,
      });
      const request: Partial<RequestWithHouseholdScope> = {
        user: { userId: "user-1" },
        params: {},
      };

      await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
      expect(findMany).not.toHaveBeenCalled();
    });

    it("missing req.user → throws UnauthorizedException", async () => {
      const findMany = jest.fn();
      const { guard } = buildGuard({
        getAllAndOverride: reflectorFor(undefined, true),
        findMany,
      });
      const request: Partial<RequestWithHouseholdScope> = { params: {} };

      await expect(guard.canActivate(buildContext(request))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(findMany).not.toHaveBeenCalled();
    });

    it("exactly one membership → injects req.householdScope and returns true", async () => {
      const findMany = jest.fn().mockResolvedValue([{ householdId: "h1", role: "OWNER" }]);
      const { guard } = buildGuard({
        getAllAndOverride: reflectorFor(undefined, true),
        findMany,
      });
      const request: Partial<RequestWithHouseholdScope> = {
        user: { userId: "user-1" },
        params: {},
      };

      await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
      expect(findMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
      expect(request.householdScope).toEqual({ householdId: "h1", role: "OWNER" });
    });

    it("zero memberships → throws NotFoundException", async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const { guard } = buildGuard({
        getAllAndOverride: reflectorFor(undefined, true),
        findMany,
      });
      const request: Partial<RequestWithHouseholdScope> = {
        user: { userId: "user-1" },
        params: {},
      };

      await expect(guard.canActivate(buildContext(request))).rejects.toBeInstanceOf(NotFoundException);
    });

    it("more than one membership → throws NotFoundException (v1 defer, documented in R2)", async () => {
      const findMany = jest.fn().mockResolvedValue([
        { householdId: "h1", role: "OWNER" },
        { householdId: "h2", role: "MEMBER" },
      ]);
      const { guard } = buildGuard({
        getAllAndOverride: reflectorFor(undefined, true),
        findMany,
      });
      const request: Partial<RequestWithHouseholdScope> = {
        user: { userId: "user-1" },
        params: {},
      };

      await expect(guard.canActivate(buildContext(request))).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
