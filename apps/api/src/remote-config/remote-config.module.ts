import { Module } from "@nestjs/common";

import { RemoteConfigController } from "./remote-config.controller";
import { RemoteConfigService } from "./remote-config.service";

// `ConfigModule` is `@Global()` (see `../config/config.module.ts`), so
// `AppConfigService` needs no explicit import here. Named `remote-config`
// (not `config`) to avoid colliding with the existing env `ConfigModule`
// (plan Risk 8).
@Module({
  controllers: [RemoteConfigController],
  providers: [RemoteConfigService],
})
export class RemoteConfigModule {}
