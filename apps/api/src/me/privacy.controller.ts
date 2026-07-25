import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Put } from "@nestjs/common";
import {
  ApiConflictResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type {
  AccountDeletionStatus,
  AccountExportRequest,
  AccountPrivacySettings,
  UpdateAccountPrivacySettingsInput,
} from "@pawcareright/types";

import { CurrentUser } from "../auth/auth.decorators";
import { UpdatePrivacySettingsDto } from "./dto/update-privacy-settings.dto";
import { PrivacyService } from "./privacy.service";

/**
 * Privacy: consent, export & deletion (T091 plan step 29). Not `@Public()`
 * -- the global `JwtAuthGuard` applies; every route is per-user, so no
 * `@HouseholdScoped()` decorator either (mirrors
 * `notifications/notification-prefs.controller.ts`).
 */
@ApiTags("privacy")
@Controller("me")
@ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  @Get("privacy")
  @ApiOkResponse({ description: "The caller's privacy settings + any pending deletion." })
  getSettings(@CurrentUser() user: { userId: string }): Promise<AccountPrivacySettings> {
    return this.privacyService.getSettings(user.userId);
  }

  @Put("privacy")
  @ApiOkResponse({ description: "Updates and returns the caller's privacy settings." })
  updateSettings(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdatePrivacySettingsDto,
  ): Promise<AccountPrivacySettings> {
    const input: UpdateAccountPrivacySettingsInput = { analyticsOptOut: dto.analyticsOptOut };
    return this.privacyService.updateSettings(user.userId, input.analyticsOptOut);
  }

  @Post("export")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ description: "Requests (or returns the existing pending) full-data export." })
  requestExport(@CurrentUser() user: { userId: string }): Promise<AccountExportRequest> {
    return this.privacyService.requestExport(user.userId);
  }

  @Delete()
  @ApiOkResponse({ description: "Schedules the caller's account for hard deletion after the grace period." })
  @ApiConflictResponse({
    description: "The caller owns a shared household with other members and must be handled manually.",
  })
  requestDeletion(@CurrentUser() user: { userId: string }): Promise<AccountDeletionStatus> {
    return this.privacyService.requestDeletion(user.userId);
  }
}
