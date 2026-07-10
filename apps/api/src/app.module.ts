import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { HouseholdScopeGuard } from "./common/household-scope.guard";
import { RolesGuard } from "./common/roles.guard";
import { ConfigModule } from "./config/config.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";

@Module({
  imports: [ConfigModule, PrismaModule, RedisModule, HealthModule, AuthModule],
  // Three global guards, registered in this fixed order:
  //   1. JwtAuthGuard — authenticates the caller (honors @Public()).
  //   2. HouseholdScopeGuard — resolves membership on @HouseholdScoped()
  //      routes (no-op otherwise).
  //   3. RolesGuard — enforces @RequireRole() against the resolved scope
  //      (no-op otherwise; fails closed to 403 if no scope was resolved).
  // Nest executes multiple APP_GUARD providers in array order. A mis-order
  // can only ever wrongly reject (RolesGuard fail-closes without a scope),
  // never wrongly grant access.
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: HouseholdScopeGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
