import { randomUUID } from "node:crypto";

import { InjectQueue } from "@nestjs/bullmq";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Queue } from "bullmq";

import { PetsService } from "../pets/pets.service";
import { StorageService } from "../storage/storage.service";
import type { ImagesJobData } from "../workers/images.contract";
import { IMAGES_QUEUE } from "../workers/images.contract";
import type { ConfirmPhotoUploadDto } from "./dto/confirm-photo-upload.dto";
import type { CreatePhotoUploadUrlDto } from "./dto/create-photo-upload-url.dto";
import { buildOriginalKey, contentTypeToExt, originalKeyPrefix } from "./photos.constants";

export interface PhotoUploadUrlResponse {
  uploadUrl: string;
  key: string;
}

export interface ConfirmPhotoUploadResponse {
  queued: true;
  jobId: string;
}

const JOB_NAME = "process";
const JOB_ATTEMPTS = 3;
const JOB_BACKOFF_DELAY_MS = 2000;
const COMPLETED_JOB_RETENTION_SECONDS = 3600;
const COMPLETED_JOB_RETENTION_COUNT = 1000;

/**
 * Presign + confirm business logic for the pet-photo upload pipeline.
 * `petsService.findOne` throughout enforces household scoping (404, never a
 * leak-revealing 403, for a pet outside the caller's household).
 */
@Injectable()
export class PhotosService {
  constructor(
    private readonly petsService: PetsService,
    private readonly storage: StorageService,
    @InjectQueue(IMAGES_QUEUE) private readonly queue: Queue<ImagesJobData>,
  ) {}

  async createUploadUrl(
    householdId: string,
    petId: string,
    dto: CreatePhotoUploadUrlDto,
  ): Promise<PhotoUploadUrlResponse> {
    await this.petsService.findOne(householdId, petId);

    const ext = contentTypeToExt[dto.contentType];
    const key = buildOriginalKey(petId, randomUUID(), ext);
    const uploadUrl = await this.storage.getPresignedPutUrl({ key, contentType: dto.contentType });

    return { uploadUrl, key };
  }

  async confirmUpload(
    householdId: string,
    petId: string,
    dto: ConfirmPhotoUploadDto,
  ): Promise<ConfirmPhotoUploadResponse> {
    await this.petsService.findOne(householdId, petId);

    if (!dto.key.startsWith(originalKeyPrefix(petId))) {
      throw new BadRequestException("key does not belong to this pet's original-upload namespace");
    }

    const exists = await this.storage.objectExists(dto.key);
    if (!exists) {
      throw new NotFoundException("uploaded object not found");
    }

    const jobId = dto.key;
    await this.queue.add(
      JOB_NAME,
      { petId, householdId, key: dto.key },
      {
        jobId,
        attempts: JOB_ATTEMPTS,
        backoff: { type: "exponential", delay: JOB_BACKOFF_DELAY_MS },
        removeOnComplete: {
          age: COMPLETED_JOB_RETENTION_SECONDS,
          count: COMPLETED_JOB_RETENTION_COUNT,
        },
        removeOnFail: false,
      },
    );

    return { queued: true, jobId };
  }
}
