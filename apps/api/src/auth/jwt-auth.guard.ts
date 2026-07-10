import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";

import type { RequestWithUser } from "../common/authenticated-request";
import { IS_PUBLIC_KEY } from "./auth.decorators";

const BEARER_PREFIX = "Bearer ";

interface AccessTokenPayload {
  sub?: unknown;
}

/**
 * Global access-JWT guard (registered as `APP_GUARD` in `AppModule`, first
 * in the chain). Every route requires a valid Bearer access token unless
 * decorated `@Public()` (checked on both the handler and the controller
 * class). Every failure mode — missing header, wrong scheme, malformed
 * token, invalid signature, expired token — collapses to a uniform 401 so
 * no internal detail leaks to the caller.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractToken(request);
    const payload = await this.verifyToken(token);

    request.user = { userId: payload.sub };

    return true;
  }

  private extractToken(request: RequestWithUser): string {
    const header = request.headers.authorization;

    if (!header || !header.startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedException();
    }

    const token = header.slice(BEARER_PREFIX.length).trim();

    if (token.length === 0) {
      throw new UnauthorizedException();
    }

    return token;
  }

  private async verifyToken(token: string): Promise<{ sub: string }> {
    let payload: AccessTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new UnauthorizedException();
    }

    return { sub: payload.sub };
  }
}
