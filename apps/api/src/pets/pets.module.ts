import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { QuotaModule } from "../quota/quota.module";
import { PetsController } from "./pets.controller";
import { PetsService } from "./pets.service";

@Module({
  imports: [PrismaModule, QuotaModule],
  controllers: [PetsController],
  providers: [PetsService],
  exports: [PetsService],
})
export class PetsModule {}
