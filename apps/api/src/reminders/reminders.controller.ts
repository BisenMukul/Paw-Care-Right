import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { CareTemplateSuggestions, MedicationCourseResponse } from "@pawcareright/types";

import type { HouseholdScope } from "../common/authenticated-request";
import { CurrentHousehold, HouseholdFromMembership } from "../common/household-scope.decorators";
import { AgendaQueryDto } from "./dto/agenda-query.dto";
import { CompleteOccurrenceDto } from "./dto/complete-occurrence.dto";
import { CreateMedicationCourseDto } from "./dto/create-medication-course.dto";
import { CreateReminderDto } from "./dto/create-reminder.dto";
import { InstantiateTemplateDto } from "./dto/instantiate-template.dto";
import { ListRemindersQueryDto } from "./dto/list-reminders-query.dto";
import { SnoozeOccurrenceDto } from "./dto/snooze-occurrence.dto";
import { TemplateSuggestionsQueryDto } from "./dto/template-suggestions-query.dto";
import { UpdateReminderDto } from "./dto/update-reminder.dto";
import type {
  AgendaEntry,
  AgendaResponse,
  InstantiateTemplateResponse,
  ReminderListResponse,
  ReminderResponse,
} from "./reminders.service";
import { RemindersService } from "./reminders.service";

/**
 * Household-scoped reminder endpoints (T055), resolved via the caller's
 * membership (`@HouseholdFromMembership()`, same posture as
 * `ChecksController`/`PetsController`). Routes carry explicit per-method
 * paths (no controller-level prefix) since `GET /agenda` and
 * `GET/PATCH/DELETE /reminders/:id` are not nested under `pets/:petId`. Not
 * `@Public()` -- the global `JwtAuthGuard` applies.
 */
@ApiTags("reminders")
@Controller()
@HouseholdFromMembership()
@ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post("pets/:petId/reminders")
  @ApiCreatedResponse({ description: "The created reminder." })
  @ApiBadRequestResponse({ description: "Invalid rrule/timezone/type, or the rule has no occurrence at or after startAt." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller, or the pet does not exist in it." })
  create(
    @CurrentHousehold() scope: HouseholdScope,
    @Param("petId") petId: string,
    @Body() dto: CreateReminderDto,
  ): Promise<ReminderResponse> {
    return this.remindersService.create(scope.householdId, petId, dto);
  }

  @Get("pets/:petId/reminders")
  @ApiOkResponse({ description: "A cursor page of reminders for the pet, newest first." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller, or the pet does not exist in it." })
  list(
    @CurrentHousehold() scope: HouseholdScope,
    @Param("petId") petId: string,
    @Query() query: ListRemindersQueryDto,
  ): Promise<ReminderListResponse> {
    return this.remindersService.list(scope.householdId, petId, query);
  }

  @Post("pets/:petId/reminders/medication-course")
  @ApiCreatedResponse({ description: "The created medication course (courseId + reminderCount)." })
  @ApiBadRequestResponse({ description: "Invalid dose times, course length, or timezone." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller, or the pet does not exist in it." })
  createMedicationCourse(
    @CurrentHousehold() scope: HouseholdScope,
    @Param("petId") petId: string,
    @Body() dto: CreateMedicationCourseDto,
  ): Promise<MedicationCourseResponse> {
    return this.remindersService.createMedicationCourse(scope.householdId, petId, dto);
  }

  @Get("pets/:petId/reminders/template-suggestions")
  @ApiOkResponse({ description: "The resolved care-template pack, projected as a reviewable suggestion list (read-only)." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller, or the pet does not exist in it." })
  templateSuggestions(
    @CurrentHousehold() scope: HouseholdScope,
    @Param("petId") petId: string,
    @Query() query: TemplateSuggestionsQueryDto,
  ): Promise<CareTemplateSuggestions> {
    return this.remindersService.templateSuggestions(scope.householdId, petId, query);
  }

  @Post("pets/:petId/reminders/from-template")
  @ApiCreatedResponse({ description: "Reminders created from the resolved care-template pack (idempotent on replay)." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller, or the pet does not exist in it." })
  instantiateFromTemplate(
    @CurrentHousehold() scope: HouseholdScope,
    @Param("petId") petId: string,
    @Body() dto: InstantiateTemplateDto,
  ): Promise<InstantiateTemplateResponse> {
    return this.remindersService.instantiateFromTemplate(scope.householdId, petId, dto);
  }

  @Get("agenda")
  @ApiOkResponse({ description: "Household-wide agenda: reminder occurrences merged with materialized events over [from,to]." })
  @ApiBadRequestResponse({ description: "Missing/invalid from/to, to<=from, or a window exceeding 92 days." })
  agenda(
    @CurrentHousehold() scope: HouseholdScope,
    @Query() query: AgendaQueryDto,
  ): Promise<AgendaResponse> {
    return this.remindersService.agenda(scope.householdId, query);
  }

  @Get("reminders/:id")
  @ApiOkResponse({ description: "The requested reminder." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller, or the reminder does not exist in it." })
  findOne(@CurrentHousehold() scope: HouseholdScope, @Param("id") id: string): Promise<ReminderResponse> {
    return this.remindersService.findOne(scope.householdId, id);
  }

  @Post("reminders/:reminderId/complete")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: "The completed occurrence, as an AgendaEntry (status: DONE)." })
  @ApiBadRequestResponse({ description: "dueAt is not ISO-8601, or is not a genuine occurrence of this reminder." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller, or the reminder does not exist in it." })
  completeOccurrence(
    @CurrentHousehold() scope: HouseholdScope,
    @Param("reminderId") reminderId: string,
    @Body() dto: CompleteOccurrenceDto,
  ): Promise<AgendaEntry> {
    return this.remindersService.completeOccurrence(scope.householdId, reminderId, dto);
  }

  @Post("reminders/:reminderId/snooze")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: "The snoozed occurrence, as an AgendaEntry (status: SNOOZED)." })
  @ApiBadRequestResponse({
    description: "dueAt/snoozeUntil is not ISO-8601, snoozeUntil is not in the future, or dueAt is not a genuine occurrence.",
  })
  @ApiNotFoundResponse({ description: "No resolved household for the caller, or the reminder does not exist in it." })
  snoozeOccurrence(
    @CurrentHousehold() scope: HouseholdScope,
    @Param("reminderId") reminderId: string,
    @Body() dto: SnoozeOccurrenceDto,
  ): Promise<AgendaEntry> {
    return this.remindersService.snoozeOccurrence(scope.householdId, reminderId, dto);
  }

  @Patch("reminders/:id")
  @ApiOkResponse({ description: "The updated reminder." })
  @ApiBadRequestResponse({ description: "Invalid rrule/timezone, or the effective rule has no occurrence at or after startAt." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller, or the reminder does not exist in it." })
  update(
    @CurrentHousehold() scope: HouseholdScope,
    @Param("id") id: string,
    @Body() dto: UpdateReminderDto,
  ): Promise<ReminderResponse> {
    return this.remindersService.update(scope.householdId, id, dto);
  }

  @Delete("reminders/:id")
  @ApiOkResponse({ description: "The deleted reminder." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller, or the reminder does not exist in it." })
  remove(@CurrentHousehold() scope: HouseholdScope, @Param("id") id: string): Promise<ReminderResponse> {
    return this.remindersService.remove(scope.householdId, id);
  }
}
