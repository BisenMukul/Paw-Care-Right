import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import sharp from "sharp";

import { deriveMainKey, deriveThumbKey } from "../photos/photos.constants";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { IMAGES_QUEUE, type ImagesJobData } from "./images.contract";

const MAIN_MAX_DIMENSION = 1600;
const THUMB_MAX_DIMENSION = 320;

/**
 * Consumes `pawcareright-images` jobs: download the original -> sharp resize
 * (main 1600px, thumb 320px long edge, no enlargement) -> re-upload both
 * renditions -> household-scoped `Pet.photoKey` write. `.rotate()` bakes
 * EXIF orientation into the pixels before sharp's default (no
 * `.withMetadata()`) re-encode strips all metadata, including EXIF.
 * Idempotent: both output keys are deterministic from the original key, so a
 * re-run of the same job simply overwrites them. The original object is
 * kept (enables reprocessing; retention/lifecycle is a deploy-time concern).
 *
 * Registered in-process via `@Processor` (same Nest app as the API) — a
 * dedicated worker entrypoint is a later deploy concern, not this task's
 * scope.
 */
@Injectable()
@Processor(IMAGES_QUEUE)
export class ImagesProcessor extends WorkerHost {
  private readonly logger = new Logger(ImagesProcessor.name);

  constructor(
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<ImagesJobData>): Promise<void> {
    const { petId, householdId, key } = job.data;
    this.logger.log(`Processing image job ${job.id} for pet ${petId}`);

    const src = await this.storage.getObject(key);

    const main = await sharp(src)
      .rotate()
      .resize(MAIN_MAX_DIMENSION, MAIN_MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .jpeg()
      .toBuffer();

    const thumb = await sharp(src)
      .rotate()
      .resize(THUMB_MAX_DIMENSION, THUMB_MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .jpeg()
      .toBuffer();

    const mainKey = deriveMainKey(key);
    const thumbKey = deriveThumbKey(key);

    await this.storage.putObject(mainKey, main, "image/jpeg");
    await this.storage.putObject(thumbKey, thumb, "image/jpeg");

    // No moderation pre-check here: ARCHITECTURE §6 lists it for the images
    // queue, but this task's card scopes only resize/thumb/EXIF-strip. // T-later
    await this.prisma.pet.updateMany({
      where: { id: petId, householdId },
      data: { photoKey: mainKey },
    });
  }
}
