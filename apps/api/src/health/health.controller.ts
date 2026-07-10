import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

import { HealthService, type HealthStatus } from "./health.service";

// No auth guard exists yet at T006 (no auth module), so this route is
// implicitly public — there is nothing to guard against. Do not add
// `@Public()` until an auth module + global guard exist.
@ApiTags("meta")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({
    description: "Reports service health, including Postgres and Redis connectivity.",
  })
  check(): Promise<HealthStatus> {
    return this.healthService.check();
  }
}
