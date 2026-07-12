import { Module } from "@nestjs/common";

import { StorageModule } from "../storage/storage.module";
import { LogOnlyUnsafeImageCheck } from "./unsafe-image-check";
import { VisionPrepService } from "./vision-prep.service";
import { UNSAFE_IMAGE_CHECK } from "./vision.types";

/**
 * Self-contained vision-input prep module (T034 plan R1). Not registered in
 * `AppModule`/`WorkersModule` here — T043's check-runner worker imports it.
 */
@Module({
  imports: [StorageModule],
  providers: [VisionPrepService, { provide: UNSAFE_IMAGE_CHECK, useClass: LogOnlyUnsafeImageCheck }],
  exports: [VisionPrepService],
})
export class VisionModule {}
