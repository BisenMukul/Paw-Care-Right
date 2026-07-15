import { Module } from "@nestjs/common";

import { PetsModule } from "../pets/pets.module";
import { PrismaModule } from "../prisma/prisma.module";
import { HealthLogsController } from "./health-logs.controller";
import { HealthLogsService } from "./health-logs.service";

/** No BullMQ registration -- T064 ships no worker (reads/writes only). */
@Module({
  imports: [PrismaModule, PetsModule],
  controllers: [HealthLogsController],
  providers: [HealthLogsService],
})
export class HealthLogsModule {}
