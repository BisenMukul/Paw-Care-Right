import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { FeedbackReportCreated } from "@bombaypetcompany/types";

import { CurrentUser } from "../auth/auth.decorators";
import { ScreenshotUploadUrlDto } from "./dto/screenshot-upload-url.dto";
import { SubmitFeedbackDto } from "./dto/submit-feedback.dto";
import type { FeedbackScreenshotUploadUrlResponse } from "./feedback.service";
import { FeedbackService } from "./feedback.service";

/**
 * In-app feedback + bug report (T104 plan D4/step 9). User-scoped (mirrors
 * `PrivacyController`) -- not `@Public()`, the global `JwtAuthGuard`
 * applies; thin delegation only.
 */
@ApiTags("feedback")
@Controller("feedback")
@ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post("screenshot-upload-url")
  @HttpCode(200)
  @ApiOkResponse({ description: "A presigned PUT URL and the object key to upload a feedback screenshot to." })
  createScreenshotUploadUrl(
    @CurrentUser() user: { userId: string },
    @Body() dto: ScreenshotUploadUrlDto,
  ): Promise<FeedbackScreenshotUploadUrlResponse> {
    return this.feedbackService.createScreenshotUploadUrl(user.userId, dto);
  }

  @Post()
  @HttpCode(201)
  @ApiCreatedResponse({ description: "The feedback report was stored." })
  @ApiBadRequestResponse({ description: "Validation failed, logs attached without consent, or screenshotKey is outside the caller's namespace." })
  @ApiNotFoundResponse({ description: "screenshotKey was never uploaded." })
  submit(
    @CurrentUser() user: { userId: string },
    @Body() dto: SubmitFeedbackDto,
  ): Promise<FeedbackReportCreated> {
    return this.feedbackService.submit(user.userId, dto);
  }
}
