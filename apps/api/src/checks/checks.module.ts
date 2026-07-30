import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AbuseModule } from "../abuse/abuse.module";
import { PetsModule } from "../pets/pets.module";
import { PrismaModule } from "../prisma/prisma.module";
import { QuotaModule } from "../quota/quota.module";
import { RemoteConfigModule } from "../remote-config/remote-config.module";
import { CHECKS_QUEUE } from "./checks.contract";
import { ChecksController } from "./checks.controller";
import { ChecksService } from "./checks.service";

// `RemoteConfigModule` (T106) is imported so `FeatureFlagGuard`'s
// `FeatureFlagsService` resolves for `ChecksController`.
@Module({
  imports: [
    PrismaModule,
    PetsModule,
    QuotaModule,
    AbuseModule,
    RemoteConfigModule,
    BullModule.registerQueue({ name: CHECKS_QUEUE }),
  ],
  controllers: [ChecksController],
  providers: [ChecksService],
})
export class ChecksModule {}
