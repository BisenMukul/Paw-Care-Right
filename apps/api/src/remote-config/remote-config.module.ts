import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { RemoteConfigController } from "./remote-config.controller";
import { RemoteConfigService } from "./remote-config.service";

// `ConfigModule` is `@Global()` (see `../config/config.module.ts`), so
// `AppConfigService` needs no explicit import here. Named `remote-config`
// (not `config`) to avoid colliding with the existing env `ConfigModule`
// (plan Risk 8/T074). `AuthModule` is imported (T079 plan decision 2) so
// `OptionalJwtAuthGuard`'s `JwtService` resolves -- the SAME secret-
// configured instance used everywhere else in the API.
@Module({
  imports: [AuthModule],
  controllers: [RemoteConfigController],
  providers: [RemoteConfigService],
})
export class RemoteConfigModule {}
