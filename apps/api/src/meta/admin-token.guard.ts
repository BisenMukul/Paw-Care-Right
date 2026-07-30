import { createHash, timingSafeEqual } from "node:crypto";

import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

import { AppConfigService } from "../config/app-config.service";

export const ADMIN_TOKEN_HEADER = "x-admin-token";

/**
 * T117 D6: fail-closed shared-secret guard for the `/v1/meta/client-versions`
 * admin-read aggregate. Mirrors `RcWebhookGuard` (`apps/api/src/billing/
 * rc-webhook.guard.ts`) — both sides SHA-256 hashed before `timingSafeEqual`
 * so unequal-length inputs (including a missing/empty header) never throw
 * from `timingSafeEqual` itself and the compare time doesn't leak length.
 * UNLIKE `RcWebhookGuard`, this guard ALSO rejects when the configured
 * `ADMIN_API_TOKEN` is itself empty (the default) — so an unconfigured
 * deployment exposes nothing, ever, regardless of what header a caller
 * sends (D6 "fail closed").
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.adminApiToken;

    if (expected === "") {
      throw new UnauthorizedException();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers[ADMIN_TOKEN_HEADER];
    const headerValue = Array.isArray(header) ? header[0] : header;

    if (typeof headerValue !== "string" || headerValue.length === 0) {
      throw new UnauthorizedException();
    }

    const incomingHash = createHash("sha256").update(headerValue).digest();
    const expectedHash = createHash("sha256").update(expected).digest();

    if (!timingSafeEqual(incomingHash, expectedHash)) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
