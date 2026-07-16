import type { ExecutionContext } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";

import type { RequestWithUser } from "../common/authenticated-request";
import { OptionalJwtAuthGuard } from "./optional-jwt-auth.guard";

function buildContext(request: Partial<RequestWithUser>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe("OptionalJwtAuthGuard", () => {
  function buildGuard(verifyAsync?: jest.Mock) {
    const jwtService = { verifyAsync: verifyAsync ?? jest.fn() } as unknown as JwtService;
    return { guard: new OptionalJwtAuthGuard(jwtService), jwtService };
  }

  it("returns true and leaves req.user undefined when the Authorization header is missing", async () => {
    const { guard } = buildGuard();
    const request: Partial<RequestWithUser> = { headers: {} };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it("returns true and leaves req.user undefined for a malformed scheme (not 'Bearer ')", async () => {
    const { guard } = buildGuard();
    const request: Partial<RequestWithUser> = { headers: { authorization: "Token abc123" } };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it("returns true and leaves req.user undefined for an empty Bearer token", async () => {
    const { guard } = buildGuard();
    const request: Partial<RequestWithUser> = { headers: { authorization: "Bearer " } };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it("returns true and leaves req.user undefined when verifyAsync rejects (invalid/expired token)", async () => {
    const verifyAsync = jest.fn().mockRejectedValue(new Error("jwt expired"));
    const { guard } = buildGuard(verifyAsync);
    const request: Partial<RequestWithUser> = { headers: { authorization: "Bearer bad-token" } };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it("returns true and leaves req.user undefined when the payload has no string sub", async () => {
    const verifyAsync = jest.fn().mockResolvedValue({});
    const { guard } = buildGuard(verifyAsync);
    const request: Partial<RequestWithUser> = { headers: { authorization: "Bearer no-sub" } };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it("sets req.user.userId from a valid token's sub claim and returns true", async () => {
    const verifyAsync = jest.fn().mockResolvedValue({ sub: "user-123" });
    const { guard } = buildGuard(verifyAsync);
    const request: Partial<RequestWithUser> = { headers: { authorization: "Bearer good-token" } };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(request.user).toEqual({ userId: "user-123" });
    expect(verifyAsync).toHaveBeenCalledWith("good-token");
  });

  it("never throws even when verifyAsync throws synchronously", async () => {
    const verifyAsync = jest.fn().mockImplementation(() => {
      throw new Error("boom");
    });
    const { guard } = buildGuard(verifyAsync);
    const request: Partial<RequestWithUser> = { headers: { authorization: "Bearer sync-throw" } };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });
});
