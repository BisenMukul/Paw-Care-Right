import { Module } from "@nestjs/common";

import { ConfigModule } from "../config/config.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminTokenGuard } from "./admin-token.guard";
import { ClientVersionsController } from "./client-versions.controller";
import { ClientVersionsService } from "./client-versions.service";

/** T117 step 19: hosts the admin-read `/v1/meta/client-versions` aggregate. */
@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [ClientVersionsController],
  providers: [ClientVersionsService, AdminTokenGuard],
})
export class MetaModule {}
