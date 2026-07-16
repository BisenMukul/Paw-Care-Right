import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { QuotaModule } from "../quota/quota.module";
import { HouseholdsController } from "./households.controller";
import { HouseholdsService } from "./households.service";

@Module({
  imports: [PrismaModule, QuotaModule],
  controllers: [HouseholdsController],
  providers: [HouseholdsService],
  exports: [HouseholdsService],
})
export class HouseholdsModule {}
