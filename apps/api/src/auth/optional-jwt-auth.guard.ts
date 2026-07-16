import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import type { RequestWithUser } from "../common/authenticated-request";

const BEARER_PREFIX = "Bearer ";

interface AccessTokenPayload {
  sub?: unknown;
}

/**
 * Best-effort, NEVER-throwing companion to `JwtAuthGuard` (T079 plan
 * decision 2). Used on `@Public()` routes that want to know the caller's
 * identity WHEN available, without requiring one: a missing/malformed/
 * invalid/expired Bearer token is treated as anonymous (`req.user` stays
 * undefined) rather than a 401. Reuses the SAME secret-configured
 * `JwtService` as `JwtAuthGuard` (both resolve from `AuthModule`'s
 * `JwtModule`), so a token valid for the rest of the API is valid here too.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractToken(request);

    if (token === null) {
      return true;
    }

    const userId = await this.verifyToken(token);

    if (userId !== null) {
      request.user = { userId };
    }

    return true;
  }

  private extractToken(request: RequestWithUser): string | null {
    const header = request.headers.authorization;

    if (!header || !header.startsWith(BEARER_PREFIX)) {
      return null;
    }

    const token = header.slice(BEARER_PREFIX.length).trim();

    return token.length === 0 ? null : token;
  }

  private async verifyToken(token: string): Promise<string | null> {
    let payload: AccessTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      return null;
    }

    return typeof payload.sub === "string" && payload.sub.length > 0 ? payload.sub : null;
  }
}
