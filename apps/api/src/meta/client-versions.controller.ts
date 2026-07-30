import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { ClientVersionsResponse } from "@bombaypetcompany/types";

import { Public } from "../auth/auth.decorators";
import { ADMIN_TOKEN_HEADER, AdminTokenGuard } from "./admin-token.guard";
import { ClientVersionsService } from "./client-versions.service";
import { ClientVersionsQueryDto } from "./dto/client-versions-query.dto";

const DEFAULT_DAYS = 30;

/**
 * T117 step 19: `/v1/meta/client-versions` — admin-read, READ-ONLY. No
 * POST/PUT/PATCH/DELETE handler exists anywhere in this module (proven by
 * `apps/api/test/meta-client-versions.e2e-spec.ts`'s read-only assertions).
 * `@Public()` bypasses the global JWT guard (mirrors `HealthController`'s
 * meta-route idiom); `AdminTokenGuard` is the actual gate.
 */
@ApiTags("meta")
@Controller("meta")
export class ClientVersionsController {
  constructor(private readonly clientVersionsService: ClientVersionsService) {}

  @Public()
  @UseGuards(AdminTokenGuard)
  @Get("client-versions")
  @ApiHeader({ name: ADMIN_TOKEN_HEADER, required: true, description: "Shared-secret admin token (ADMIN_API_TOKEN)." })
  @ApiOkResponse({
    description:
      "Admin-read, READ-ONLY aggregate of reported {appVersion, otaUpdateId} pairs per day, over Device rows seen within `days` (default 30). " +
      "D5 freshness limitation: a device's reported pair is only as fresh as its last JIT push registration (POST /v1/devices), not a per-launch report — " +
      "PostHog `ota_applied` (docs/OTA_UPDATES.md §7) is the authoritative adoption curve; this endpoint is a coarse cross-check over push-registered devices only.",
  })
  @ApiUnauthorizedResponse({ description: "Missing/wrong x-admin-token, or ADMIN_API_TOKEN is unconfigured (empty = closed)." })
  @ApiBadRequestResponse({ description: "`days` must be an integer between 1 and 90." })
  get(@Query() query: ClientVersionsQueryDto): Promise<ClientVersionsResponse> {
    return this.clientVersionsService.aggregate(query.days ?? DEFAULT_DAYS);
  }
}
