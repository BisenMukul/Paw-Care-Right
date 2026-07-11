import sharp from "sharp";

import type { PrismaService } from "../prisma/prisma.service";
import type { StorageService } from "../storage/storage.service";
import type { ImagesJobData } from "./images.contract";
import { ImagesProcessor } from "./images.processor";

/**
 * Direct-invoke unit test: constructs `ImagesProcessor` with mocked
 * `StorageService`/`PrismaService` and calls `process()` on a hand-built
 * `Job`-shaped object — no real BullMQ/Redis/MinIO involved (that round-trip
 * is `test/photos.e2e-spec.ts`'s job).
 */
describe("ImagesProcessor", () => {
  const petId = "pet-1";
  const householdId = "household-1";
  const originalKey = `pets/${petId}/original/abc.jpg`;
  const mainKey = `pets/${petId}/main/abc.jpg`;
  const thumbKey = `pets/${petId}/thumb/abc.jpg`;

  async function buildExifSourceBuffer(): Promise<Buffer> {
    return sharp({
      create: { width: 2000, height: 1500, channels: 3, background: { r: 10, g: 120, b: 200 } },
    })
      .jpeg()
      .withExif({ IFD0: { Software: "pawcareright-test", Copyright: "t" } })
      .toBuffer();
  }

  function buildJob(data: ImagesJobData) {
    return { id: "job-1", data } as unknown as Parameters<ImagesProcessor["process"]>[0];
  }

  it("produces main (<=1600) + thumb (<=320) renditions from a source buffer with EXIF stripped", async () => {
    const src = await buildExifSourceBuffer();
    expect((await sharp(src).metadata()).exif).toBeInstanceOf(Buffer);

    const getObject = jest.fn().mockResolvedValue(src);
    const putObject = jest.fn().mockResolvedValue(undefined);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const storage = { getObject, putObject } as unknown as StorageService;
    const prisma = { pet: { updateMany } } as unknown as PrismaService;
    const processor = new ImagesProcessor(storage, prisma);

    await processor.process(buildJob({ petId, householdId, key: originalKey }));

    expect(getObject).toHaveBeenCalledWith(originalKey);
    expect(putObject).toHaveBeenCalledTimes(2);

    const [mainCall, thumbCall] = putObject.mock.calls as [
      [string, Buffer, string],
      [string, Buffer, string],
    ];
    expect(mainCall[0]).toBe(mainKey);
    expect(mainCall[2]).toBe("image/jpeg");
    expect(thumbCall[0]).toBe(thumbKey);
    expect(thumbCall[2]).toBe("image/jpeg");

    const mainMeta = await sharp(mainCall[1]).metadata();
    expect(mainMeta.width).toBeLessThanOrEqual(1600);
    expect(mainMeta.height).toBeLessThanOrEqual(1600);
    expect(mainMeta.format).toBe("jpeg");
    expect(mainMeta.exif).toBeUndefined();

    const thumbMeta = await sharp(thumbCall[1]).metadata();
    expect(thumbMeta.width).toBeLessThanOrEqual(320);
    expect(thumbMeta.height).toBeLessThanOrEqual(320);
    expect(thumbMeta.exif).toBeUndefined();
  });

  it("writes Pet.photoKey scoped to { id: petId, householdId } via updateMany", async () => {
    const src = await buildExifSourceBuffer();
    const storage = {
      getObject: jest.fn().mockResolvedValue(src),
      putObject: jest.fn().mockResolvedValue(undefined),
    } as unknown as StorageService;
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = { pet: { updateMany } } as unknown as PrismaService;
    const processor = new ImagesProcessor(storage, prisma);

    await processor.process(buildJob({ petId, householdId, key: originalKey }));

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: petId, householdId },
      data: { photoKey: mainKey },
    });
  });

  it("is idempotent: re-running the same job overwrites the same deterministic keys", async () => {
    const src = await buildExifSourceBuffer();
    const putObject = jest.fn().mockResolvedValue(undefined);
    const storage = { getObject: jest.fn().mockResolvedValue(src), putObject } as unknown as StorageService;
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = { pet: { updateMany } } as unknown as PrismaService;
    const processor = new ImagesProcessor(storage, prisma);

    await processor.process(buildJob({ petId, householdId, key: originalKey }));
    await processor.process(buildJob({ petId, householdId, key: originalKey }));

    expect(putObject).toHaveBeenCalledTimes(4);
    const keysUsed = putObject.mock.calls.map((call) => call[0] as string);
    expect(keysUsed).toEqual([mainKey, thumbKey, mainKey, thumbKey]);
    expect(updateMany).toHaveBeenCalledTimes(2);
  });
});
