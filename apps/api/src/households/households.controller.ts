import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { CurrentUser } from "../auth/auth.decorators";
import type { HouseholdScope } from "../common/authenticated-request";
import { CurrentHousehold, HouseholdFromMembership, RequireRole } from "../common/household-scope.decorators";
import { AcceptInviteDto } from "./dto/accept-invite.dto";
import {
  type AcceptInviteResult,
  type CreateInviteResult,
  HouseholdsService,
  type HouseholdMeResult,
} from "./households.service";

/**
 * Decorators are applied PER METHOD (not class-level): `invites/accept`
 * must stay unscoped (any authenticated caller, regardless of their current
 * household, needs to be able to accept an invite into a DIFFERENT
 * household — see plan's JOIN-REPLACES). Not `@Public()` anywhere — the
 * global `JwtAuthGuard` applies to all three routes.
 */
@ApiTags("households")
@Controller("households")
@ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
export class HouseholdsController {
  constructor(private readonly householdsService: HouseholdsService) {}

  @Post("invites")
  @HouseholdFromMembership()
  @RequireRole("OWNER")
  @ApiCreatedResponse({ description: "A freshly minted invite code + deep link, expiring in 7 days." })
  @ApiForbiddenResponse({ description: "Caller's role in the resolved household is not OWNER." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller." })
  createInvite(
    @CurrentHousehold() scope: HouseholdScope,
    @CurrentUser() user: { userId: string },
  ): Promise<CreateInviteResult> {
    return this.householdsService.createInvite(scope.householdId, user.userId);
  }

  @Post("invites/accept")
  @HttpCode(200)
  @ApiOkResponse({ description: "Joins the caller into the inviting household as MEMBER." })
  @ApiNotFoundResponse({
    description: "Invalid, expired, or already-used invite code (uniform response — anti-probing).",
  })
  @ApiConflictResponse({
    description:
      "Caller is already a member of the inviting household, is in an unsupported membership state, or their current household still has pets.",
  })
  acceptInvite(
    @CurrentUser() user: { userId: string },
    @Body() dto: AcceptInviteDto,
  ): Promise<AcceptInviteResult> {
    return this.householdsService.acceptInvite(user.userId, dto.code);
  }

  @Get("me")
  @HouseholdFromMembership()
  @ApiOkResponse({ description: "The caller's household and its members." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller." })
  getMe(@CurrentHousehold() scope: HouseholdScope): Promise<HouseholdMeResult> {
    return this.householdsService.getHouseholdMe(scope.householdId);
  }
}
