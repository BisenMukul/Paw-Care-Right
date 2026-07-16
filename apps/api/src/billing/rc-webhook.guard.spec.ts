import type { ExecutionContext } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";

import type { AppConfigService } from "../config/app-config.service";
import { RcWebhookGuard } from "./rc-webhook.guard";

const TOKEN = "correct-rc-webhook-token";

function buildContext(headerValue: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: headerValue } }),
    }),
  } as unknown as ExecutionContext;
}

function buildGuard(token = TOKEN): RcWebhookGuard {
  return new RcWebhookGuard({ rcWebhookAuthToken: token } as unknown as AppConfigService);
}

describe("RcWebhookGuard — table-driven auth cases", () => {
  it("allows the correct token", () => {
    const guard = buildGuard();
    expect(guard.canActivate(buildContext(TOKEN))).toBe(true);
  });

  it("rejects a wrong token", () => {
    const guard = buildGuard();
    expect(() => guard.canActivate(buildContext("wrong-token"))).toThrow(UnauthorizedException);
  });

  it("rejects a missing header", () => {
    const guard = buildGuard();
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(UnauthorizedException);
  });

  it("rejects an empty header", () => {
    const guard = buildGuard();
    expect(() => guard.canActivate(buildContext(""))).toThrow(UnauthorizedException);
  });

  it("rejects a different-length header without throwing from timingSafeEqual itself", () => {
    const guard = buildGuard();
    expect(() => guard.canActivate(buildContext("short"))).toThrow(UnauthorizedException);
  });

  it("rejects a header that is a case-sensitive near-match", () => {
    const guard = buildGuard();
    expect(() => guard.canActivate(buildContext(TOKEN.toUpperCase()))).toThrow(UnauthorizedException);
  });
});
