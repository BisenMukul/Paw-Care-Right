import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { AdminAuditPage, AdminKpisResponse, AdminUserSummary } from "@bombaypetcompany/types";

import { Public } from "../auth/auth.decorators";
import { ADMIN_TOKEN_HEADER, AdminTokenGuard } from "../meta/admin-token.guard";
import { AdminAuditService } from "./admin-audit.service";
import { AdminKpisService } from "./admin-kpis.service";
import { AdminUsersService } from "./admin-users.service";
import { AdminAuditQueryDto } from "./dto/admin-audit-query.dto";
import { AdminKpisQueryDto } from "./dto/admin-kpis-query.dto";
import { AdminUserLookupQueryDto } from "./dto/admin-user-lookup-query.dto";

const DEFAULT_DAYS = 30;
const DEFAULT_LIMIT = 50;

/**
 * T111: `/v1/admin/*` mini-dashboard. READ-ONLY: no POST/PUT/PATCH/DELETE
 * handler exists anywhere in this module (proven by `admin-readonly.spec.ts`
 * and `test/admin-dashboard.e2e-spec.ts`'s per-endpoint mutation-verb
 * rejection). Reuses the T117 `AdminTokenGuard` shared-secret idiom
 * verbatim: `@Public()` bypasses the global JWT guard, `AdminTokenGuard` is
 * the actual gate, and it fails closed (401) when `ADMIN_API_TOKEN` is
 * itself unconfigured.
 */
@ApiTags("admin")
@Controller("admin")
export class AdminController {
  constructor(
    private readonly kpisService: AdminKpisService,
    private readonly usersService: AdminUsersService,
    private readonly auditService: AdminAuditService,
  ) {}

  @Public()
  @UseGuards(AdminTokenGuard)
  @Get("kpis")
  @ApiHeader({ name: ADMIN_TOKEN_HEADER, required: true, description: "Shared-secret admin token (ADMIN_API_TOKEN)." })
  @ApiOkResponse({
    description:
      "Daily KPIs (installs proxy, checks run, fallback rate, tier snapshot, RC webhook EVENT COUNTS -- never revenue) " +
      "over the last `days` days (default 30).",
  })
  @ApiUnauthorizedResponse({ description: "Missing/wrong x-admin-token, or ADMIN_API_TOKEN is unconfigured (empty = closed)." })
  @ApiBadRequestResponse({ description: "`days` must be an integer between 1 and 90." })
  getKpis(@Query() query: AdminKpisQueryDto): Promise<AdminKpisResponse> {
    return this.kpisService.getKpis(query.days ?? DEFAULT_DAYS);
  }

  @Public()
  @UseGuards(AdminTokenGuard)
  @Get("users/lookup")
  @ApiHeader({ name: ADMIN_TOKEN_HEADER, required: true, description: "Shared-secret admin token (ADMIN_API_TOKEN)." })
  @ApiOkResponse({ description: "A single user's entitlement + read-only counters (ids/codes/counts only, never content)." })
  @ApiUnauthorizedResponse({ description: "Missing/wrong x-admin-token, or ADMIN_API_TOKEN is unconfigured (empty = closed)." })
  @ApiBadRequestResponse({ description: "`email` is required." })
  @ApiNotFoundResponse({ description: "No user with that email." })
  getUserLookup(@Query() query: AdminUserLookupQueryDto): Promise<AdminUserSummary> {
    return this.usersService.lookupByEmail(query.email);
  }

  @Public()
  @UseGuards(AdminTokenGuard)
  @Get("ai-audit")
  @ApiHeader({ name: ADMIN_TOKEN_HEADER, required: true, description: "Shared-secret admin token (ADMIN_API_TOKEN)." })
  @ApiOkResponse({ description: "A cursor-paginated page of AiAuditLog rows (codes-only, never content)." })
  @ApiUnauthorizedResponse({ description: "Missing/wrong x-admin-token, or ADMIN_API_TOKEN is unconfigured (empty = closed)." })
  @ApiBadRequestResponse({ description: "`limit` must be 1-100, or `cursor` does not reference an existing row." })
  getAuditPage(@Query() query: AdminAuditQueryDto): Promise<AdminAuditPage> {
    return this.auditService.getPage(query.limit ?? DEFAULT_LIMIT, query.cursor);
  }
}
