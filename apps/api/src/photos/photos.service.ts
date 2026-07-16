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
import type { PhotoViewUrlsDto } from "./dto/photo-view-urls.dto";
import {
  buildOriginalKey,
  contentTypeToExt,
  deriveMainKey,
  deriveThumbKey,
  isKeyInPetNamespace,
} from "./photos.constants";

export interface PhotoUploadUrlResponse {
  uploadUrl: string;
  key: string;
}

export interface ConfirmPhotoUploadResponse {
  queued: true;
  jobId: string;
}

export interface PhotoViewUrlsResponse {
  items: Array<{ key: string; thumbUrl: string; mainUrl: string }>;
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

    if (!isKeyInPetNamespace(petId, dto.key)) {
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

  /**
   * Presigns GET (view) URLs for both the thumb and main renditions of each
   * requested key, household- and namespace-scoped exactly like
   * `confirmUpload` (plan decision 3): `findOne` 404s a pet outside the
   * caller's household, and every key must live under this pet's
   * original-upload namespace or the request is rejected — the client never
   * learns the rendition key scheme, only the signed URLs.
   */
  async viewUrls(
    householdId: string,
    petId: string,
    dto: PhotoViewUrlsDto,
  ): Promise<PhotoViewUrlsResponse> {
    await this.petsService.findOne(householdId, petId);

    for (const key of dto.keys) {
      if (!isKeyInPetNamespace(petId, key)) {
        throw new BadRequestException("key does not belong to this pet's original-upload namespace");
      }
    }

    const items = await Promise.all(
      dto.keys.map(async (key) => {
        const [thumbUrl, mainUrl] = await Promise.all([
          this.storage.getPresignedGetUrl({ key: deriveThumbKey(key) }),
          this.storage.getPresignedGetUrl({ key: deriveMainKey(key) }),
        ]);
        return { key, thumbUrl, mainUrl };
      }),
    );

    return { items };
  }
}
