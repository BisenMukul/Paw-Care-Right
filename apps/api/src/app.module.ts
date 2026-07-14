import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { BreedsModule } from "./breeds/breeds.module";
import { ChecksModule } from "./checks/checks.module";
import { HouseholdScopeGuard } from "./common/household-scope.guard";
import { RolesGuard } from "./common/roles.guard";
import { THROTTLE_DEFAULT } from "./common/throttle.config";
import { ConfigModule } from "./config/config.module";
import { DevicesModule } from "./devices/devices.module";
import { HealthModule } from "./health/health.module";
import { HouseholdsModule } from "./households/households.module";
import { NotificationPrefsModule } from "./notifications/notification-prefs.module";
import { PetsModule } from "./pets/pets.module";
import { PhotosModule } from "./photos/photos.module";
import { PrismaModule } from "./prisma/prisma.module";
import { QueueModule } from "./queue/queue.module";
import { QuotaModule } from "./quota/quota.module";
import { RedisModule } from "./redis/redis.module";
import { RemindersModule } from "./reminders/reminders.module";
import { WorkersModule } from "./workers/workers.module";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    DevicesModule,
    HouseholdsModule,
    PetsModule,
    BreedsModule,
    QueueModule,
    PhotosModule,
    QuotaModule,
    ChecksModule,
    RemindersModule,
    NotificationPrefsModule,
    WorkersModule,
    ThrottlerModule.forRoot([{ name: "default", ...THROTTLE_DEFAULT }]),
  ],
  // Four global guards, registered in this fixed order:
  //   1. ThrottlerGuard — the global rate limiter (100 req/60 s per IP,
  //      "default" named throttler). Runs FIRST: it is metadata-independent
  //      (throttles @Public() routes too), cheaper than auth, and protects
  //      token verification from abuse. Ordering only ever adds a 429
  //      earlier; it cannot wrongly grant access.
  //   2. JwtAuthGuard — authenticates the caller (honors @Public()).
  //   3. HouseholdScopeGuard — resolves membership on @HouseholdScoped()
  //      routes (no-op otherwise).
  //   4. RolesGuard — enforces @RequireRole() against the resolved scope
  //      (no-op otherwise; fails closed to 403 if no scope was resolved).
  // Nest executes multiple APP_GUARD providers in array order. A mis-order
  // can only ever wrongly reject (RolesGuard fail-closes without a scope),
  // never wrongly grant access.
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: HouseholdScopeGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
