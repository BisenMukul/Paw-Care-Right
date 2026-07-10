import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

import type { RequestWithHouseholdScope } from "./authenticated-request";
import { RolesGuard } from "./roles.guard";

function buildContext(request: Partial<RequestWithHouseholdScope>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => (): void => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  function buildGuard(getAllAndOverride?: jest.Mock) {
    const reflector = {
      getAllAndOverride: getAllAndOverride ?? jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;

    return { guard: new RolesGuard(reflector), reflector };
  }

  it("no @RequireRole metadata → returns true", () => {
    const { guard } = buildGuard();
    const request: Partial<RequestWithHouseholdScope> = {};

    expect(guard.canActivate(buildContext(request))).toBe(true);
  });

  it("missing req.householdScope → throws ForbiddenException (fail closed)", () => {
    const { guard } = buildGuard(jest.fn().mockReturnValue("OWNER"));
    const request: Partial<RequestWithHouseholdScope> = {};

    expect(() => guard.canActivate(buildContext(request))).toThrow(ForbiddenException);
  });

  it("scope role OWNER vs required OWNER → returns true", () => {
    const { guard } = buildGuard(jest.fn().mockReturnValue("OWNER"));
    const request: Partial<RequestWithHouseholdScope> = {
      householdScope: { householdId: "h1", role: "OWNER" },
    };

    expect(guard.canActivate(buildContext(request))).toBe(true);
  });

  it("scope role MEMBER vs required OWNER → throws ForbiddenException", () => {
    const { guard } = buildGuard(jest.fn().mockReturnValue("OWNER"));
    const request: Partial<RequestWithHouseholdScope> = {
      householdScope: { householdId: "h1", role: "MEMBER" },
    };

    expect(() => guard.canActivate(buildContext(request))).toThrow(ForbiddenException);
  });
});
