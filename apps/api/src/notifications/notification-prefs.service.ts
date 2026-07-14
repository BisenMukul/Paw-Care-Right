import { Injectable, Logger } from "@nestjs/common";
import type { NotificationPrefs, UpdateNotificationPrefsInput } from "@pawcareright/types";

import { PrismaService } from "../prisma/prisma.service";

interface PrefsRow {
  disabledTypes: string[];
  quietStart: string | null;
  quietEnd: string | null;
  timezone: string | null;
}

/**
 * `NotificationPrefsService` (T058 plan decision 1 & 4): a missing
 * `UserNotificationPrefs` row means "all defaults" (every type on, no quiet
 * window) -- no backfill needed for existing users. `update` upserts the
 * flat DB columns from the nested `quietHours` client shape; `quietHours`
 * absent/`null` clears all three columns.
 */
@Injectable()
export class NotificationPrefsService {
  private readonly logger = new Logger(NotificationPrefsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<NotificationPrefs> {
    const row = await this.prisma.userNotificationPrefs.findUnique({ where: { userId } });
    return this.toPrefs(row);
  }

  async update(userId: string, input: UpdateNotificationPrefsInput): Promise<NotificationPrefs> {
    const quietHours = input.quietHours ?? null;

    const row = await this.prisma.userNotificationPrefs.upsert({
      where: { userId },
      create: {
        userId,
        disabledTypes: input.disabledTypes,
        quietStart: quietHours?.start ?? null,
        quietEnd: quietHours?.end ?? null,
        timezone: quietHours?.timezone ?? null,
      },
      update: {
        disabledTypes: input.disabledTypes,
        quietStart: quietHours?.start ?? null,
        quietEnd: quietHours?.end ?? null,
        timezone: quietHours?.timezone ?? null,
      },
    });

    this.logger.log({ event: "notification_prefs_updated", userId });
    return this.toPrefs(row);
  }

  private toPrefs(row: PrefsRow | null): NotificationPrefs {
    if (row === null) {
      return { disabledTypes: [], quietHours: null };
    }

    const { quietStart, quietEnd, timezone } = row;
    const hasQuietWindow = quietStart !== null && quietEnd !== null && timezone !== null;

    return {
      disabledTypes: row.disabledTypes as NotificationPrefs["disabledTypes"],
      quietHours: hasQuietWindow ? { start: quietStart, end: quietEnd, timezone } : null,
    };
  }
}
