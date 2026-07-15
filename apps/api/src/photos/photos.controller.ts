import { Body, Controller, HttpCode, Param, Post } from "@nestjs/common";
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
import { ConfirmPhotoUploadDto } from "./dto/confirm-photo-upload.dto";
import { CreatePhotoUploadUrlDto } from "./dto/create-photo-upload-url.dto";
import { PhotoViewUrlsDto } from "./dto/photo-view-urls.dto";
import type {
  ConfirmPhotoUploadResponse,
  PhotoUploadUrlResponse,
  PhotoViewUrlsResponse,
} from "./photos.service";
import { PhotosService } from "./photos.service";

/**
 * Household-scoped pet-photo upload endpoints, resolved via the caller's
 * membership (`@HouseholdFromMembership()`, same v1 posture as
 * `PetsController`). Not `@Public()` — the global `JwtAuthGuard` applies.
 */
@ApiTags("photos")
@Controller("pets")
@HouseholdFromMembership()
@ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
@ApiNotFoundResponse({
  description: "No resolved household for the caller, or the pet does not exist in it.",
})
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Post(":id/photo-upload-url")
  @HttpCode(200)
  @ApiOkResponse({ description: "A presigned PUT URL and the object key to upload to." })
  @ApiBadRequestResponse({ description: "Invalid content type or content length." })
  createUploadUrl(
    @CurrentHousehold() scope: HouseholdScope,
    @Param("id") petId: string,
    @Body() dto: CreatePhotoUploadUrlDto,
  ): Promise<PhotoUploadUrlResponse> {
    return this.photosService.createUploadUrl(scope.householdId, petId, dto);
  }

  @Post(":id/photo-upload-confirm")
  @HttpCode(202)
  @ApiCreatedResponse({ description: "The upload was accepted and a processing job was enqueued." })
  @ApiBadRequestResponse({ description: "Key is not under this pet's original-upload namespace." })
  @ApiNotFoundResponse({ description: "The pet does not exist in the caller's household, or the object was never uploaded." })
  confirmUpload(
    @CurrentHousehold() scope: HouseholdScope,
    @Param("id") petId: string,
    @Body() dto: ConfirmPhotoUploadDto,
  ): Promise<ConfirmPhotoUploadResponse> {
    return this.photosService.confirmUpload(scope.householdId, petId, dto);
  }

  @Post(":id/photo-view-urls")
  @HttpCode(200)
  @ApiOkResponse({ description: "Presigned thumb/main view URLs for each requested key." })
  @ApiBadRequestResponse({ description: "A requested key is not under this pet's original-upload namespace." })
  viewUrls(
    @CurrentHousehold() scope: HouseholdScope,
    @Param("id") petId: string,
    @Body() dto: PhotoViewUrlsDto,
  ): Promise<PhotoViewUrlsResponse> {
    return this.photosService.viewUrls(scope.householdId, petId, dto);
  }
}
