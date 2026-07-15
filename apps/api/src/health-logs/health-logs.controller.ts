import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import type { HouseholdScope } from "../common/authenticated-request";
import { CurrentHousehold, HouseholdFromMembership } from "../common/household-scope.decorators";
import { CreateLogDto } from "./dto/create-log.dto";
import { ListLogsQueryDto } from "./dto/list-logs-query.dto";
import { WeightSeriesQueryDto } from "./dto/weight-series-query.dto";
import type {
  HealthLogResponse,
  TimelineListResponse,
  VetSummaryResponse,
  WeightSeriesResponse,
} from "./health-logs.service";
import { HealthLogsService } from "./health-logs.service";

/**
 * Household-scoped health-timeline endpoints (T064), resolved via the
 * caller's membership (`@HouseholdFromMembership()`, same posture as
 * `ChecksController`/`RemindersController`). Not `@Public()` -- the global
 * `JwtAuthGuard` applies.
 */
@ApiTags("health-logs")
@Controller()
@HouseholdFromMembership()
@ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
export class HealthLogsController {
  constructor(private readonly healthLogsService: HealthLogsService) {}

  @Post("pets/:petId/logs")
  @ApiCreatedResponse({ description: "The created health-log entry." })
  @ApiBadRequestResponse({ description: "Invalid kind, occurredAt, value, or photoKeys." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller, or the pet does not exist in it." })
  create(
    @CurrentHousehold() scope: HouseholdScope,
    @Param("petId") petId: string,
    @Body() dto: CreateLogDto,
  ): Promise<HealthLogResponse> {
    return this.healthLogsService.create(scope.householdId, petId, dto);
  }

  @Get("pets/:petId/logs")
  @ApiOkResponse({ description: "A cursor page of the pet's health timeline, merged across kinds, newest first." })
  @ApiBadRequestResponse({ description: "Malformed cursor, or an out-of-range limit." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller, or the pet does not exist in it." })
  list(
    @CurrentHousehold() scope: HouseholdScope,
    @Param("petId") petId: string,
    @Query() query: ListLogsQueryDto,
  ): Promise<TimelineListResponse> {
    return this.healthLogsService.list(scope.householdId, petId, query);
  }

  @Get("pets/:petId/weight-series")
  @ApiOkResponse({ description: "The pet's weight history, ascending, downsampled to at most 200 points." })
  @ApiBadRequestResponse({ description: "Invalid from/to." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller, or the pet does not exist in it." })
  weightSeries(
    @CurrentHousehold() scope: HouseholdScope,
    @Param("petId") petId: string,
    @Query() query: WeightSeriesQueryDto,
  ): Promise<WeightSeriesResponse> {
    return this.healthLogsService.weightSeries(scope.householdId, petId, query);
  }

  @Get("pets/:petId/vet-summary")
  @ApiOkResponse({
    description:
      "A plain-text, disclaimer-terminated record digest of the pet's last 90 days (weight trend, symptom checks, medications given, notes), capped at 2,500 characters.",
  })
  @ApiNotFoundResponse({ description: "No resolved household for the caller, or the pet does not exist in it." })
  vetSummary(
    @CurrentHousehold() scope: HouseholdScope,
    @Param("petId") petId: string,
  ): Promise<VetSummaryResponse> {
    return this.healthLogsService.vetSummary(scope.householdId, petId);
  }
}
