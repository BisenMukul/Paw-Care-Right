import { createHash, timingSafeEqual } from "node:crypto";

import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

import { AppConfigService } from "../config/app-config.service";

/**
 * T073 plan decision 1: RevenueCat webhooks authenticate via a fixed,
 * operator-configured `Authorization` header value (no request-body
 * signature is offered) -- so this guard is a shared-secret compare, not
 * HMAC. Both sides are SHA-256 hashed before `timingSafeEqual` so that
 * unequal-length inputs (including a missing/empty header) never cause
 * `timingSafeEqual` itself to throw on a length mismatch, and the compare
 * time doesn't leak the header's length to a timing attacker.
 */
@Injectable()
export class RcWebhookGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;

    if (typeof header !== "string" || header.length === 0) {
      throw new UnauthorizedException();
    }

    const expected = this.config.rcWebhookAuthToken;
    const incomingHash = createHash("sha256").update(header).digest();
    const expectedHash = createHash("sha256").update(expected).digest();

    if (!timingSafeEqual(incomingHash, expectedHash)) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
