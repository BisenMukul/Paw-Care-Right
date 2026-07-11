import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import type { HouseholdScope } from "../common/authenticated-request";
import {
  CurrentHousehold,
  HouseholdFromMembership,
  RequireRole,
} from "../common/household-scope.decorators";
import { CreatePetDto } from "./dto/create-pet.dto";
import { UpdatePetDto } from "./dto/update-pet.dto";
import { PetsService, type PetResponse } from "./pets.service";

/**
 * Flat `/v1/pets` routes, scoped to the caller's resolved household via
 * `@HouseholdFromMembership()` (v1 = one household/user; see
 * `HouseholdScopeGuard`'s from-membership mode). Not `@Public()` — the
 * global `JwtAuthGuard` applies.
 */
@ApiTags("pets")
@Controller("pets")
@HouseholdFromMembership()
@ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
@ApiNotFoundResponse({
  description: "No resolved household for the caller, or the pet does not exist in it.",
})
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @Get()
  @ApiOkResponse({ description: "All non-deleted pets in the caller's household." })
  findAll(@CurrentHousehold() scope: HouseholdScope): Promise<PetResponse[]> {
    return this.petsService.findAll(scope.householdId);
  }

  @Post()
  @ApiCreatedResponse({ description: "The created pet." })
  @ApiBadRequestResponse({ description: "Validation failed, e.g. both birthDate and ageEstimateMonths set." })
  create(
    @CurrentHousehold() scope: HouseholdScope,
    @Body() dto: CreatePetDto,
  ): Promise<PetResponse> {
    return this.petsService.create(scope.householdId, dto);
  }

  @Get(":id")
  @ApiOkResponse({ description: "The requested pet." })
  findOne(
    @CurrentHousehold() scope: HouseholdScope,
    @Param("id") id: string,
  ): Promise<PetResponse> {
    return this.petsService.findOne(scope.householdId, id);
  }

  @Patch(":id")
  @ApiOkResponse({ description: "The updated pet." })
  @ApiBadRequestResponse({ description: "Validation failed, e.g. both birthDate and ageEstimateMonths set." })
  update(
    @CurrentHousehold() scope: HouseholdScope,
    @Param("id") id: string,
    @Body() dto: UpdatePetDto,
  ): Promise<PetResponse> {
    return this.petsService.update(scope.householdId, id, dto);
  }

  @Delete(":id")
  @HttpCode(200)
  @RequireRole("OWNER")
  @ApiOkResponse({ description: "The soft-deleted pet." })
  @ApiForbiddenResponse({ description: "Caller's role in the household is not OWNER." })
  remove(
    @CurrentHousehold() scope: HouseholdScope,
    @Param("id") id: string,
  ): Promise<PetResponse> {
    return this.petsService.remove(scope.householdId, id);
  }
}
