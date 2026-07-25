import { Body, Controller, Param, Post, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiPaymentRequiredResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Response } from "express";

import { CurrentUser } from "../auth/auth.decorators";
import type { HouseholdScope } from "../common/authenticated-request";
import { CurrentHousehold, HouseholdFromMembership } from "../common/household-scope.decorators";
import { THROTTLE_AI_WRITE } from "../common/throttle.config";
import { ChatService, type ChatThreadResponse } from "./chat.service";
import { CreateThreadDto } from "./dto/create-thread.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { SseWriter } from "./sse-writer";

/**
 * Household-scoped chat endpoints (T081 — F7 "Ask Paw Care Right +"),
 * resolved via the caller's membership (same posture as `ChecksController`/
 * `PetsController`). The message-send route is `@Res()`-based SSE (plan
 * decision D2) — thin: every rejection is thrown by the service BEFORE any
 * SSE header is written, so `AllExceptionsFilter` still produces the
 * standard JSON error envelope for those; the controller never returns a
 * value on that route.
 */
@ApiTags("chat")
@Controller("chat")
@HouseholdFromMembership()
@ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post("threads")
  @Throttle(THROTTLE_AI_WRITE)
  @ApiCreatedResponse({ description: "The created chat thread." })
  @ApiPaymentRequiredResponse({ description: "Ask Paw Care Right + chat is a premium feature." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller, or the pet does not exist in it." })
  @ApiTooManyRequestsResponse({ description: "Rate limit exceeded (20/min/IP)." })
  createThread(
    @CurrentHousehold() scope: HouseholdScope,
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateThreadDto,
  ): Promise<ChatThreadResponse> {
    return this.chatService.createThread(scope.householdId, user.userId, dto);
  }

  @Post("threads/:id/messages")
  @Throttle(THROTTLE_AI_WRITE)
  @ApiOkResponse({ description: "SSE stream of the assistant answer (text/event-stream)." })
  @ApiPaymentRequiredResponse({ description: "Chat is premium-only, or the monthly fair-use quota is exhausted." })
  @ApiNotFoundResponse({ description: "No resolved household for the caller, or the thread does not exist in it." })
  @ApiBadRequestResponse({ description: "Invalid message payload." })
  @ApiTooManyRequestsResponse({ description: "Rate limit exceeded (20/min/IP)." })
  async sendMessage(
    @CurrentHousehold() scope: HouseholdScope,
    @CurrentUser() user: { userId: string },
    @Param("id") id: string,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    const sse = new SseWriter(res);
    await this.chatService.streamMessage(scope.householdId, user.userId, id, dto, sse);
  }
}
