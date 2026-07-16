import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AppConfigResponse } from "@pawcareright/types";

import { CurrentUser, Public } from "../auth/auth.decorators";
import { OptionalJwtAuthGuard } from "../auth/optional-jwt-auth.guard";
import { RemoteConfigService } from "./remote-config.service";

/**
 * `GET /v1/config` (T074 plan decision 4; grown by T079 plan). `@Public()`
 * -- no route-level auth is REQUIRED, so the global `JwtAuthGuard` is
 * explicitly bypassed (mirrors `HealthController`). `OptionalJwtAuthGuard`
 * (T079 plan decision 2) then runs best-effort: it sets `req.user` when a
 * valid Bearer token is present (so the paywall variant hashes the real
 * userId) and otherwise leaves it undefined -- NEVER a 401 on this public
 * route. Thin: delegates entirely to `RemoteConfigService`.
 */
@ApiTags("config")
@Controller("config")
@UseGuards(OptionalJwtAuthGuard)
export class RemoteConfigController {
  constructor(private readonly remoteConfigService: RemoteConfigService) {}

  @Public()
  @Get()
  @ApiOkResponse({
    description:
      "Remote client config: paywall A/B variant, min-supported-version gate, hotline pack version.",
  })
  getConfig(@CurrentUser() user?: { userId: string }): AppConfigResponse {
    return this.remoteConfigService.getConfig(user?.userId);
  }
}
