import { Module } from "@nestjs/common";

import { PetsModule } from "../pets/pets.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RemindersController } from "./reminders.controller";
import { RemindersService } from "./reminders.service";

/** No BullMQ registration -- T055 ships no scheduler/worker (that's T056). */
@Module({
  imports: [PrismaModule, PetsModule],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
