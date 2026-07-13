import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from "@nestjs/common";
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

  @Get("checks/:id")
  @ApiOkResponse({ description: "The requested symptom check, including its result once terminal." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller, or the check does not exist in it." })
  findOne(@CurrentHousehold() scope: HouseholdScope, @Param("id") id: string): Promise<CheckResponse> {
    return this.checksService.findOne(scope.householdId, id);
  }

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
