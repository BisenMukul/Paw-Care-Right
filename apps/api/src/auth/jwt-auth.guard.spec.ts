import type { ExecutionContext } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { JwtService } from "@nestjs/jwt";

import type { RequestWithUser } from "../common/authenticated-request";
import { JwtAuthGuard } from "./jwt-auth.guard";

function buildContext(request: Partial<RequestWithUser>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => (): void => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe("JwtAuthGuard", () => {
  function buildGuard(overrides: { getAllAndOverride?: jest.Mock; verifyAsync?: jest.Mock }) {
    const reflector = {
      getAllAndOverride: overrides.getAllAndOverride ?? jest.fn().mockReturnValue(false),
    } as unknown as Reflector;

    const jwtService = {
      verifyAsync: overrides.verifyAsync ?? jest.fn(),
    } as unknown as JwtService;

    return { guard: new JwtAuthGuard(jwtService, reflector), reflector, jwtService };
  }

  it("returns true without verifying a token on a @Public() route", async () => {
    const verifyAsync = jest.fn();
    const { guard } = buildGuard({
      getAllAndOverride: jest.fn().mockReturnValue(true),
      verifyAsync,
    });

    const request: Partial<RequestWithUser> = { headers: {} };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(verifyAsync).not.toHaveBeenCalled();
  });

  it("throws UnauthorizedException when the Authorization header is missing", async () => {
    const { guard } = buildGuard({});
    const request: Partial<RequestWithUser> = { headers: {} };

    await expect(guard.canActivate(buildContext(request))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws UnauthorizedException for a malformed scheme (not 'Bearer ')", async () => {
    const { guard } = buildGuard({});
    const request: Partial<RequestWithUser> = { headers: { authorization: "Token abc123" } };

    await expect(guard.canActivate(buildContext(request))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws UnauthorizedException for an empty Bearer token", async () => {
    const { guard } = buildGuard({});
    const request: Partial<RequestWithUser> = { headers: { authorization: "Bearer " } };

    await expect(guard.canActivate(buildContext(request))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws UnauthorizedException when verifyAsync rejects (invalid/expired token)", async () => {
    const verifyAsync = jest.fn().mockRejectedValue(new Error("jwt expired"));
    const { guard } = buildGuard({ verifyAsync });
    const request: Partial<RequestWithUser> = { headers: { authorization: "Bearer bad-token" } };

    await expect(guard.canActivate(buildContext(request))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws UnauthorizedException when the payload has no string sub", async () => {
    const verifyAsync = jest.fn().mockResolvedValue({});
    const { guard } = buildGuard({ verifyAsync });
    const request: Partial<RequestWithUser> = { headers: { authorization: "Bearer no-sub" } };

    await expect(guard.canActivate(buildContext(request))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("sets req.user.userId from a valid token's sub claim and returns true", async () => {
    const verifyAsync = jest.fn().mockResolvedValue({ sub: "user-123" });
    const { guard } = buildGuard({ verifyAsync });
    const request: Partial<RequestWithUser> = { headers: { authorization: "Bearer good-token" } };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(request.user).toEqual({ userId: "user-123" });
    expect(verifyAsync).toHaveBeenCalledWith("good-token");
  });
});
