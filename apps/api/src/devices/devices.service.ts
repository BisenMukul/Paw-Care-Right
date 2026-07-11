import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

export interface RegisteredDevice {
  id: string;
  expoPushToken: string;
  platform: string;
  lastSeenAt: Date;
}

/**
 * Device registration for push notifications. `register()` upserts a
 * `Device` row keyed by the unique `expoPushToken`: a token already owned
 * by another user is reassigned to the caller (a push token is
 * device-bound, so on hand-off/re-login it must follow the new account —
 * see the plan's Risk §A). In the same transaction, any other tokens the
 * caller previously registered for the same platform are pruned, keeping
 * at most one live token per (user, platform).
 */
@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async register(
    userId: string,
    input: { expoPushToken: string; platform: string },
  ): Promise<RegisteredDevice> {
    try {
      return await this.upsertAndPrune(userId, input.expoPushToken, input.platform);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // Parallel callers raced the create path on the unique
        // expoPushToken constraint; the row now exists, so a retry takes
        // the update path and succeeds. Any further failure propagates.
        return this.upsertAndPrune(userId, input.expoPushToken, input.platform);
      }
      throw err;
    }
  }

  private async upsertAndPrune(
    userId: string,
    expoPushToken: string,
    platform: string,
  ): Promise<RegisteredDevice> {
    const [device] = await this.prisma.$transaction([
      this.prisma.device.upsert({
        where: { expoPushToken },
        create: { userId, expoPushToken, platform },
        update: { userId, platform, lastSeenAt: new Date() },
      }),
      this.prisma.device.deleteMany({
        where: { userId, platform, expoPushToken: { not: expoPushToken } },
      }),
    ]);

    return {
      id: device.id,
      expoPushToken: device.expoPushToken,
      platform: device.platform,
      lastSeenAt: device.lastSeenAt,
    };
  }
}
