import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";

import { Public } from "../auth/auth.decorators";
import { RcWebhookGuard } from "./rc-webhook.guard";
import { RcWebhookService } from "./rc-webhook.service";

/**
 * `POST /billing/rc-webhook` (T073): RevenueCat's server-to-server webhook.
 * `@Public()` -- there is no end-user access token here, only the
 * `RcWebhookGuard` shared-secret check. No class-validator DTO is bound to
 * `@Body()` deliberately (plan decision 9) so the global pipe's
 * `forbidNonWhitelisted` never strips RC's payload before the service
 * validates + persists the raw body. Thin: delegates entirely to
 * `RcWebhookService`.
 */
@ApiTags("billing")
@Controller("billing")
export class RcWebhookController {
  constructor(private readonly rcWebhookService: RcWebhookService) {}

  @Public()
  @Post("rc-webhook")
  @HttpCode(200)
  @UseGuards(RcWebhookGuard)
  @ApiOkResponse({ description: "The event was accepted (processed, deduped, or safely skipped)." })
  @ApiUnauthorizedResponse({ description: "Missing or invalid RC webhook Authorization header." })
  handle(@Body() body: Record<string, unknown>): Promise<{ received: true }> {
    return this.rcWebhookService.handle(body);
  }
}
