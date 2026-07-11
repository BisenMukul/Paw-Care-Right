import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { StorageModule } from "../storage/storage.module";
import { IMAGES_QUEUE } from "./images.contract";
import { ImagesProcessor } from "./images.processor";

@Module({
  imports: [StorageModule, PrismaModule, BullModule.registerQueue({ name: IMAGES_QUEUE })],
  providers: [ImagesProcessor],
})
export class WorkersModule {}
