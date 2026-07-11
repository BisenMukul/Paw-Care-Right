import { Injectable, Logger, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

import { PrismaService } from "../prisma/prisma.service";

export const DEVICE_TOKEN_HEADER = "x-device-token";

/**
 * Fire-and-forget `lastSeenAt` touch, bound to every route ahead of the
 * global guard chain (see `DevicesModule.configure()`). Runs before guards,
 * so `req.user` is not available — resolution is by the `x-device-token`
 * header only (see the plan's Risk §C). Never blocks or throws: `next()`
 * always runs synchronously, and the update's rejection (e.g. an unknown
 * token, which `updateMany` resolves as a 0-row no-op rather than
 * throwing) is swallowed.
 */
@Injectable()
export class LastSeenMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LastSeenMiddleware.name);

  constructor(private readonly prisma: PrismaService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const token = req.header(DEVICE_TOKEN_HEADER);

    if (typeof token === "string" && token.length > 0) {
      void this.prisma.device
        .updateMany({ where: { expoPushToken: token }, data: { lastSeenAt: new Date() } })
        .catch((err: unknown) => {
          this.logger.warn(`lastSeen touch failed: ${err instanceof Error ? err.message : String(err)}`);
        });
    }

    next();
  }
}
