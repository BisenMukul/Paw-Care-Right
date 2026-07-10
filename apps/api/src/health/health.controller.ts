import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

import { Public } from "../auth/auth.decorators";
import { HealthService, type HealthStatus } from "./health.service";

// A global JWT guard now exists (T015). Health checks must remain
// reachable without a token (load balancers, uptime monitors), so this
// route is explicitly `@Public()`.
@ApiTags("meta")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOkResponse({
    description: "Reports service health, including Postgres and Redis connectivity.",
  })
  check(): Promise<HealthStatus> {
    return this.healthService.check();
  }
}
