import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AppConfigResponse } from "@pawcareright/types";

import { Public } from "../auth/auth.decorators";
import { RemoteConfigService } from "./remote-config.service";

/**
 * `GET /v1/config` (T074 plan decision 4): a minimal public remote-config
 * endpoint. `@Public()` -- there is no per-user data here, only the
 * paywall A/B variant, so the global `JwtAuthGuard` is explicitly bypassed
 * (mirrors `HealthController`). Thin: delegates entirely to
 * `RemoteConfigService`.
 */
@ApiTags("config")
@Controller("config")
export class RemoteConfigController {
  constructor(private readonly remoteConfigService: RemoteConfigService) {}

  @Public()
  @Get()
  @ApiOkResponse({ description: "Remote client config (currently: the paywall A/B variant)." })
  getConfig(): AppConfigResponse {
    return this.remoteConfigService.getConfig();
  }
}
