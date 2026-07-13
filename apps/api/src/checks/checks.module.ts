import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { PetsModule } from "../pets/pets.module";
import { PrismaModule } from "../prisma/prisma.module";
import { QuotaModule } from "../quota/quota.module";
import { CHECKS_QUEUE } from "./checks.contract";
import { ChecksController } from "./checks.controller";
import { ChecksService } from "./checks.service";

@Module({
  imports: [PrismaModule, PetsModule, QuotaModule, BullModule.registerQueue({ name: CHECKS_QUEUE })],
  controllers: [ChecksController],
  providers: [ChecksService],
})
export class ChecksModule {}
