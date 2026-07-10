import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import type { Request, Response } from "express";

import { RedisService } from "../redis/redis.service";
import { RATE_LIMIT_KEY_PREFIX, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS } from "./auth.constants";

/**
 * Per-route Redis fixed-window rate limiter for `POST /auth/otp/request`.
 * The global throttler lands in T017; this guard is the only rate limiter
 * this module owns. Runs before the ValidationPipe, so malformed request
 * bodies still count toward the limit.
 */
@Injectable()
export class OtpRateLimitGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    const key = `${RATE_LIMIT_KEY_PREFIX}${request.ip ?? "unknown"}`;

    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    }

    if (count > RATE_LIMIT_MAX) {
      response.setHeader("Retry-After", String(RATE_LIMIT_WINDOW_SECONDS));
      throw new HttpException("Too many requests.", HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
