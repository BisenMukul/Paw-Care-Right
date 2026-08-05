import type { ExecutionContext } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";

import type { AppConfigService } from "../config/app-config.service";
import { ADMIN_TOKEN_HEADER, AdminTokenGuard } from "./admin-token.guard";

const TOKEN = "correct-admin-token";

function buildContext(headerValue: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { [ADMIN_TOKEN_HEADER]: headerValue } }),
    }),
  } as unknown as ExecutionContext;
}

function buildGuard(configuredToken: string): AdminTokenGuard {
  return new AdminTokenGuard({ adminApiToken: configuredToken } as unknown as AppConfigService);
}

describe("AdminTokenGuard — table-driven auth cases (T117 D6)", () => {
  it("allows the correct token when configured", () => {
    const guard = buildGuard(TOKEN);
    expect(guard.canActivate(buildContext(TOKEN))).toBe(true);
  });

  it("rejects a wrong token", () => {
    const guard = buildGuard(TOKEN);
    expect(() => guard.canActivate(buildContext("wrong-token"))).toThrow(UnauthorizedException);
  });

  it("rejects a missing header", () => {
    const guard = buildGuard(TOKEN);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(UnauthorizedException);
  });

  it("rejects an empty header", () => {
    const guard = buildGuard(TOKEN);
    expect(() => guard.canActivate(buildContext(""))).toThrow(UnauthorizedException);
  });

  it("rejects a different-length header without throwing from timingSafeEqual itself", () => {
    const guard = buildGuard(TOKEN);
    expect(() => guard.canActivate(buildContext("short"))).toThrow(UnauthorizedException);
  });

  it("rejects a case-sensitive near-match", () => {
    const guard = buildGuard(TOKEN);
    expect(() => guard.canActivate(buildContext(TOKEN.toUpperCase()))).toThrow(UnauthorizedException);
  });

  // D6's distinguishing behavior vs. RcWebhookGuard: fail closed when the
  // configured secret ITSELF is empty, regardless of what header arrives.
  it("rejects even the (empty) 'correct' token when ADMIN_API_TOKEN is unconfigured", () => {
    const guard = buildGuard("");
    expect(() => guard.canActivate(buildContext(""))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(buildContext("anything"))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(UnauthorizedException);
  });
});
