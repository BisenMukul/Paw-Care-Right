import { Body, Controller, Get, Put } from "@nestjs/common";
import { ApiBadRequestResponse, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";
import type { NotificationPrefs, UpdateNotificationPrefsInput } from "@pawcareright/types";

import { CurrentUser } from "../auth/auth.decorators";
import { UpdateNotificationPrefsDto } from "./dto/update-notification-prefs.dto";
import { NotificationPrefsService } from "./notification-prefs.service";

// Not @Public() — the global JwtAuthGuard applies; prefs are per-user (no
// household scope), so no @HouseholdScoped() decorator either (T058 plan
// decision 4).
@ApiTags("notifications")
@Controller("me")
@ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
export class NotificationPrefsController {
  constructor(private readonly notificationPrefsService: NotificationPrefsService) {}

  @Get("notification-prefs")
  @ApiOkResponse({ description: "The caller's notification preferences (defaults if never set)." })
  get(@CurrentUser() user: { userId: string }): Promise<NotificationPrefs> {
    return this.notificationPrefsService.get(user.userId);
  }

  @Put("notification-prefs")
  @ApiOkResponse({ description: "Upserts and returns the caller's notification preferences." })
  @ApiBadRequestResponse({ description: "Bad HH:mm time, unknown reminder type, or malformed quietHours." })
  update(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateNotificationPrefsDto,
  ): Promise<NotificationPrefs> {
    // `dto.disabledTypes` is a validated `string[]` (class-validator
    // `@IsIn(REMINDER_TYPES, { each: true })` already rejects anything
    // outside `ReminderType` before the handler runs -- see
    // `Reminder.type`'s String-not-enum precedent, `reminders.service.ts`),
    // so the narrowing cast to the shared Zod-inferred input shape is safe.
    const input: UpdateNotificationPrefsInput = {
      disabledTypes: dto.disabledTypes as UpdateNotificationPrefsInput["disabledTypes"],
      quietHours: dto.quietHours ?? null,
    };
    return this.notificationPrefsService.update(user.userId, input);
  }
}
