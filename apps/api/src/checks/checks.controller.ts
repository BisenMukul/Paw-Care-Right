import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiPaymentRequiredResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import type { HouseholdScope } from "../common/authenticated-request";
import { CurrentUser } from "../auth/auth.decorators";
import { CurrentHousehold, HouseholdFromMembership } from "../common/household-scope.decorators";
import type { CheckListResponse, CheckResponse } from "./checks.service";
import { ChecksService } from "./checks.service";
import { CreateCheckDto } from "./dto/create-check.dto";
import { FollowUpDto } from "./dto/follow-up.dto";
import { ListChecksQueryDto } from "./dto/list-checks-query.dto";

/**
 * Household-scoped symptom-check endpoints (T042), resolved via the
 * caller's membership (`@HouseholdFromMembership()`, same posture as
 * `PetsController`/`PhotosController`). Routes carry explicit per-method
 * paths (no controller-level prefix) because `GET /checks/:id` is not
 * nested under `pets/:petId`. Not `@Public()` — the global `JwtAuthGuard`
 * applies.
 */
@ApiTags("checks")
@Controller()
@HouseholdFromMembership()
@ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
export class ChecksController {
  constructor(private readonly checksService: ChecksService) {}

  // T090 plan §5 (PRODUCT_SPEC §5 rule 3 -- mandatory-FAIL surface): this is
  // the ONLY producer of the Emergency-interstitial payload
  // (`CheckResponse.redFlag`, consumed by
  // `apps/mobile/src/checks/use-check-submission.ts`). `ThrottlerGuard` is
  // the FIRST global guard (`app.module.ts`), i.e. it runs before
  // `JwtAuthGuard`, before this controller, and therefore before
  // `evaluateRedFlags` in `ChecksService.create` step 4 -- a 429 here would
  // make a red-flag check unreachable. Compensating controls: authenticated
  // (`JwtAuthGuard`), per-user metered by `QuotaService` (402), and the
  // alert-only hourly anomaly counter (`AnomalyService`).
  @SkipThrottle()
  @Post("pets/:petId/checks")
  @ApiCreatedResponse({ description: "The created (or, on an idempotent replay, existing) symptom check." })
  @ApiBadRequestResponse({ description: "Invalid intake payload." })
  @ApiPaymentRequiredResponse({ description: "Free-tier symptom-check quota exceeded." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller, or the pet does not exist in it." })
  create(
    @CurrentHousehold() scope: HouseholdScope,
    @CurrentUser() user: { userId: string },
    @Param("petId") petId: string,
    @Body() dto: CreateCheckDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<CheckResponse> {
    return this.checksService.create(
      scope.householdId,
      user.userId,
      petId,
      dto,
      idempotencyKey && idempotencyKey.length > 0 ? idempotencyKey : null,
    );
  }

  // Deliberately NOT `@SkipThrottle()`d: a plain read with no escalation
  // semantics (unlike create/followup/findOne below) -- keeps
  // `THROTTLE_DEFAULT`.
  @Get("pets/:petId/checks")
  @ApiOkResponse({ description: "A cursor page of symptom checks for the pet, newest first." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller, or the pet does not exist in it." })
  list(
    @CurrentHousehold() scope: HouseholdScope,
    @Param("petId") petId: string,
    @Query() query: ListChecksQueryDto,
  ): Promise<CheckListResponse> {
    return this.checksService.list(scope.householdId, petId, query);
  }

  // §5: how the terminal `EMERGENCY_NOW`/`VET_24H` result is delivered.
  @SkipThrottle()
  @Get("checks/:id")
  @ApiOkResponse({ description: "The requested symptom check, including its result once terminal." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller, or the check does not exist in it." })
  findOne(@CurrentHousehold() scope: HouseholdScope, @Param("id") id: string): Promise<CheckResponse> {
    return this.checksService.findOne(scope.householdId, id);
  }

  // §5: can only ever RAISE urgency (`raiseUrgency`, never lowers) -- an
  // escalation surface.
  @SkipThrottle()
  @Post("checks/:id/followup")
  @HttpCode(200)
  @ApiOkResponse({ description: "The updated symptom check, carrying the follow-up (idempotent on replay)." })
  @ApiBadRequestResponse({ description: "Invalid `response` value." })
  @ApiConflictResponse({ description: "The check is not yet terminal, or has no schema-valid result." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller, or the check does not exist in it." })
  submitFollowUp(
    @CurrentHousehold() scope: HouseholdScope,
    @Param("id") id: string,
    @Body() dto: FollowUpDto,
  ): Promise<CheckResponse> {
    return this.checksService.submitFollowUp(scope.householdId, id, dto.response);
  }
}
