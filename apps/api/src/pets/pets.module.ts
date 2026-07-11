import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { PetsController } from "./pets.controller";
import { PetsService } from "./pets.service";

@Module({
  imports: [PrismaModule],
  controllers: [PetsController],
  providers: [PetsService],
})
export class PetsModule {}
