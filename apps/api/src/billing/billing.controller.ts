import { Controller, Get } from "@nestjs/common";
import { ApiNotFoundResponse, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";
import type { BillingEntitlement } from "@pawcareright/types";

import { CurrentUser } from "../auth/auth.decorators";
import type { HouseholdScope } from "../common/authenticated-request";
import { CurrentHousehold, HouseholdFromMembership } from "../common/household-scope.decorators";
import { BillingService } from "./billing.service";

/**
 * Household-scoped billing endpoint (T072), resolved via the caller's
 * membership (`@HouseholdFromMembership()`, same posture as
 * `ChecksController`/`HealthLogsController`). Not `@Public()` -- the global
 * `JwtAuthGuard` applies.
 */
@ApiTags("billing")
@Controller("billing")
@ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get("entitlement")
  @HouseholdFromMembership()
  @ApiOkResponse({ description: "The caller's resolved billing entitlement (own sub, or a household family sub)." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller." })
  getEntitlement(
    @CurrentUser() user: { userId: string },
    @CurrentHousehold() scope: HouseholdScope,
  ): Promise<BillingEntitlement> {
    return this.billingService.getEntitlement(user.userId, scope.householdId);
  }
}
