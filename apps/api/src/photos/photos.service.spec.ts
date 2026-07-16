import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { Queue } from "bullmq";

import type { PetResponse } from "../pets/pets.service";
import type { PetsService } from "../pets/pets.service";
import type { StorageService } from "../storage/storage.service";
import type { ImagesJobData } from "../workers/images.contract";
import type { ConfirmPhotoUploadDto } from "./dto/confirm-photo-upload.dto";
import type { CreatePhotoUploadUrlDto } from "./dto/create-photo-upload-url.dto";
import type { PhotoViewUrlsDto } from "./dto/photo-view-urls.dto";
import { deriveMainKey, deriveThumbKey } from "./photos.constants";
import { PhotosService } from "./photos.service";

describe("PhotosService", () => {
  const householdId = "household-1";
  const petId = "pet-1";

  function buildPetResponse(): PetResponse {
    return {
      id: petId,
      householdId,
      species: "DOG",
      sex: "UNKNOWN",
      name: "Fido",
      neutered: false,
      breedSlug: null,
      birthDate: null,
      ageEstimateMonths: null,
      weightGrams: null,
      photoKey: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    };
  }

  function buildDeps(overrides: {
    findOne?: jest.Mock;
    getPresignedPutUrl?: jest.Mock;
    getPresignedGetUrl?: jest.Mock;
    objectExists?: jest.Mock;
    add?: jest.Mock;
  }) {
    const petsService = {
      findOne: overrides.findOne ?? jest.fn().mockResolvedValue(buildPetResponse()),
    } as unknown as PetsService;

    const storage = {
      getPresignedPutUrl: overrides.getPresignedPutUrl ?? jest.fn().mockResolvedValue("https://signed.example/put"),
      getPresignedGetUrl:
        overrides.getPresignedGetUrl ??
        jest.fn(({ key }: { key: string }) => Promise.resolve(`https://signed.example/get?key=${key}`)),
      objectExists: overrides.objectExists ?? jest.fn().mockResolvedValue(true),
    } as unknown as StorageService;

    const queue = {
      add: overrides.add ?? jest.fn().mockResolvedValue(undefined),
    } as unknown as Queue<ImagesJobData>;

    return { petsService, storage, queue };
  }

  describe("createUploadUrl", () => {
    it("resolves the pet in the household, builds a namespaced key, and signs it with the content type", async () => {
      const findOne = jest.fn().mockResolvedValue(buildPetResponse());
      const getPresignedPutUrl = jest.fn().mockResolvedValue("https://signed.example/put");
      const { petsService, storage, queue } = buildDeps({ findOne, getPresignedPutUrl });
      const service = new PhotosService(petsService, storage, queue);
      const dto: CreatePhotoUploadUrlDto = { contentType: "image/jpeg", contentLength: 1000 };

      const result = await service.createUploadUrl(householdId, petId, dto);

      expect(findOne).toHaveBeenCalledWith(householdId, petId);
      expect(result.key).toMatch(new RegExp(`^pets/${petId}/original/[0-9a-f-]+\\.jpg$`));
      expect(getPresignedPutUrl).toHaveBeenCalledWith({ key: result.key, contentType: "image/jpeg" });
      expect(result.uploadUrl).toBe("https://signed.example/put");
    });

    it("propagates NotFoundException from a pet outside the caller's household (no signing attempted)", async () => {
      const findOne = jest.fn().mockRejectedValue(new NotFoundException());
      const getPresignedPutUrl = jest.fn();
      const { petsService, storage, queue } = buildDeps({ findOne, getPresignedPutUrl });
      const service = new PhotosService(petsService, storage, queue);
      const dto: CreatePhotoUploadUrlDto = { contentType: "image/png", contentLength: 500 };

      await expect(service.createUploadUrl("other-household", petId, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(getPresignedPutUrl).not.toHaveBeenCalled();
    });
  });

  describe("confirmUpload", () => {
    it("throws BadRequestException when the key is outside this pet's original-upload namespace, no queue.add call", async () => {
      const objectExists = jest.fn();
      const add = jest.fn();
      const { petsService, storage, queue } = buildDeps({ objectExists, add });
      const service = new PhotosService(petsService, storage, queue);
      const dto: ConfirmPhotoUploadDto = { key: `pets/other-pet/original/abc.jpg` };

      await expect(service.confirmUpload(householdId, petId, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(objectExists).not.toHaveBeenCalled();
      expect(add).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the object was never uploaded, no queue.add call", async () => {
      const objectExists = jest.fn().mockResolvedValue(false);
      const add = jest.fn();
      const { petsService, storage, queue } = buildDeps({ objectExists, add });
      const service = new PhotosService(petsService, storage, queue);
      const dto: ConfirmPhotoUploadDto = { key: `pets/${petId}/original/abc.jpg` };

      await expect(service.confirmUpload(householdId, petId, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(add).not.toHaveBeenCalled();
    });

    it("rejects a path-traversal key (400), no objectExists/queue.add", async () => {
      const objectExists = jest.fn();
      const add = jest.fn();
      const { petsService, storage, queue } = buildDeps({ objectExists, add });
      const service = new PhotosService(petsService, storage, queue);
      const dto: ConfirmPhotoUploadDto = { key: `pets/${petId}/original/../../other-pet/main/x.jpg` };

      await expect(service.confirmUpload(householdId, petId, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(objectExists).not.toHaveBeenCalled();
      expect(add).not.toHaveBeenCalled();
    });

    it("on success, enqueues { petId, householdId, key } with jobId === key and returns { queued: true, jobId }", async () => {
      const objectExists = jest.fn().mockResolvedValue(true);
      const add = jest.fn().mockResolvedValue(undefined);
      const { petsService, storage, queue } = buildDeps({ objectExists, add });
      const service = new PhotosService(petsService, storage, queue);
      const key = `pets/${petId}/original/abc.jpg`;
      const dto: ConfirmPhotoUploadDto = { key };

      const result = await service.confirmUpload(householdId, petId, dto);

      expect(add).toHaveBeenCalledWith(
        "process",
        { petId, householdId, key },
        expect.objectContaining({ jobId: key, attempts: 3, removeOnFail: false }),
      );
      expect(result).toEqual({ queued: true, jobId: key });
    });
  });

  describe("viewUrls", () => {
    it("resolves the pet in the household (scope), then presigns thumb+main for each key", async () => {
      const findOne = jest.fn().mockResolvedValue(buildPetResponse());
      const getPresignedGetUrl = jest.fn(({ key }: { key: string }) =>
        Promise.resolve(`https://signed.example/get?key=${key}`),
      );
      const { petsService, storage, queue } = buildDeps({ findOne, getPresignedGetUrl });
      const service = new PhotosService(petsService, storage, queue);
      const key = `pets/${petId}/original/abc.jpg`;
      const dto: PhotoViewUrlsDto = { keys: [key] };

      const result = await service.viewUrls(householdId, petId, dto);

      expect(findOne).toHaveBeenCalledWith(householdId, petId);
      expect(getPresignedGetUrl).toHaveBeenCalledWith({ key: deriveThumbKey(key) });
      expect(getPresignedGetUrl).toHaveBeenCalledWith({ key: deriveMainKey(key) });
      expect(result).toEqual({
        items: [
          {
            key,
            thumbUrl: `https://signed.example/get?key=${deriveThumbKey(key)}`,
            mainUrl: `https://signed.example/get?key=${deriveMainKey(key)}`,
          },
        ],
      });
    });

    it("presigns every key in a multi-key request, preserving order", async () => {
      const getPresignedGetUrl = jest.fn(({ key }: { key: string }) =>
        Promise.resolve(`https://signed.example/get?key=${key}`),
      );
      const { petsService, storage, queue } = buildDeps({ getPresignedGetUrl });
      const service = new PhotosService(petsService, storage, queue);
      const keyA = `pets/${petId}/original/a.jpg`;
      const keyB = `pets/${petId}/original/b.jpg`;

      const result = await service.viewUrls(householdId, petId, { keys: [keyA, keyB] });

      expect(result.items.map((item) => item.key)).toEqual([keyA, keyB]);
    });

    it("throws BadRequestException when a key is outside this pet's original-upload namespace, no signing for it", async () => {
      const getPresignedGetUrl = jest.fn();
      const { petsService, storage, queue } = buildDeps({ getPresignedGetUrl });
      const service = new PhotosService(petsService, storage, queue);
      const dto: PhotoViewUrlsDto = { keys: [`pets/other-pet/original/abc.jpg`] };

      await expect(service.viewUrls(householdId, petId, dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(getPresignedGetUrl).not.toHaveBeenCalled();
    });

    it("propagates NotFoundException from a pet outside the caller's household (no signing attempted)", async () => {
      const findOne = jest.fn().mockRejectedValue(new NotFoundException());
      const getPresignedGetUrl = jest.fn();
      const { petsService, storage, queue } = buildDeps({ findOne, getPresignedGetUrl });
      const service = new PhotosService(petsService, storage, queue);
      const dto: PhotoViewUrlsDto = { keys: [`pets/${petId}/original/abc.jpg`] };

      await expect(service.viewUrls("other-household", petId, dto)).rejects.toBeInstanceOf(NotFoundException);
      expect(getPresignedGetUrl).not.toHaveBeenCalled();
    });

    it("rejects a path-traversal key (400), no signing", async () => {
      const getPresignedGetUrl = jest.fn();
      const { petsService, storage, queue } = buildDeps({ getPresignedGetUrl });
      const service = new PhotosService(petsService, storage, queue);
      const dto: PhotoViewUrlsDto = { keys: [`pets/${petId}/original/../evil.jpg`] };

      await expect(service.viewUrls(householdId, petId, dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(getPresignedGetUrl).not.toHaveBeenCalled();
    });
  });
});
