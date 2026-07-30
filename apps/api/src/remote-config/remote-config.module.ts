import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { RedisModule } from "../redis/redis.module";
import { FeatureFlagGuard } from "./feature-flag.guard";
import { FeatureFlagsService } from "./feature-flags.service";
import { RemoteConfigController } from "./remote-config.controller";
import { RemoteConfigService } from "./remote-config.service";

// `ConfigModule` is `@Global()` (see `../config/config.module.ts`), so
// `AppConfigService` needs no explicit import here. Named `remote-config`
// (not `config`) to avoid colliding with the existing env `ConfigModule`
// (plan Risk 8/T074). `AuthModule` is imported (T079 plan decision 2) so
// `OptionalJwtAuthGuard`'s `JwtService` resolves -- the SAME secret-
// configured instance used everywhere else in the API. `RedisModule` is
// NOT `@Global()` (see `../redis/redis.module.ts`), so it is imported
// explicitly here (T106) so `FeatureFlagsService`'s `RedisService`
// resolves. `FeatureFlagsService`/`FeatureFlagGuard` are exported so
// `ChecksModule`/`ChatModule` can import this module and gate their
// controllers (T106 D5).
@Module({
  imports: [AuthModule, RedisModule],
  controllers: [RemoteConfigController],
  providers: [RemoteConfigService, FeatureFlagsService, FeatureFlagGuard],
  exports: [FeatureFlagsService, FeatureFlagGuard],
})
export class RemoteConfigModule {}
