import { Injectable, ServiceUnavailableException } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

export interface HealthStatus {
  status: "ok";
  db: "ok";
  redis: "ok";
  buildId: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly appConfig: AppConfigService,
  ) {}

  async check(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.redis.ping();
    } catch {
      throw new ServiceUnavailableException("Dependency health check failed.");
    }

    // T116 (OTA_UPDATES §5.3): buildId feeds the production OTA publish
    // job's pre-flight check that the API has already deployed the commit
    // the mobile update expects. `ConfigModule` is `@Global()`, so no
    // module wiring change is needed to inject `AppConfigService` here.
    return { status: "ok", db: "ok", redis: "ok", buildId: this.appConfig.gitSha };
  }
}
