import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { PetsModule } from "../pets/pets.module";
import { StorageModule } from "../storage/storage.module";
import { IMAGES_QUEUE } from "../workers/images.contract";
import { PhotosController } from "./photos.controller";
import { PhotosService } from "./photos.service";

@Module({
  imports: [PetsModule, StorageModule, BullModule.registerQueue({ name: IMAGES_QUEUE })],
  controllers: [PhotosController],
  providers: [PhotosService],
})
export class PhotosModule {}
