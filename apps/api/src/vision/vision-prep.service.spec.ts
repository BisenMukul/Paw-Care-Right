import { Logger } from "@nestjs/common";
import type { CompletedIntake } from "@pawcareright/types";
import sharp from "sharp";

import type { StorageService } from "../storage/storage.service";
import { VISION_JPEG_QUALITY, VISION_MAX_EDGE } from "./vision.constants";
import type { UnsafeImageCheck } from "./vision.types";
import { VisionPrepService } from "./vision-prep.service";

/**
 * Direct-invoke unit tests: constructs `VisionPrepService` with a mocked
 * `StorageService` + fake `UnsafeImageCheck`, sharp-generated fixture
 * buffers — same pattern as `images.processor.spec.ts`.
 */
describe("VisionPrepService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function buildExifSourceBuffer(): Promise<Buffer> {
    return sharp({
      create: { width: 2000, height: 1500, channels: 3, background: { r: 10, g: 120, b: 200 } },
    })
      .jpeg()
      .withExif({ IFD0: { Software: "pawcareright-test", Copyright: "t" } })
      .toBuffer();
  }

  async function buildPlainSourceBuffer(): Promise<Buffer> {
    return sharp({
      create: { width: 40, height: 40, channels: 3, background: { r: 50, g: 90, b: 130 } },
    })
      .jpeg()
      .toBuffer();
  }

  async function computeProcessedBase64Length(src: Buffer): Promise<number> {
    const processed = await sharp(src)
      .rotate()
      .resize(VISION_MAX_EDGE, VISION_MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: VISION_JPEG_QUALITY })
      .toBuffer();
    return processed.toString("base64").length;
  }

  function buildIntake(photoKeyGroups: string[][]): CompletedIntake {
    return {
      category: "skin-itch",
      answers: photoKeyGroups.map((photoKeys, index) => ({
        questionId: `photo-${index}`,
        type: "photoPrompt" as const,
        photoKeys,
      })),
    };
  }

  function buildOkCheck(): UnsafeImageCheck {
    return { check: jest.fn().mockResolvedValue({ verdict: "ok" }) } as unknown as UnsafeImageCheck;
  }

  function buildStorage(getObject: jest.Mock): StorageService {
    return { getObject } as unknown as StorageService;
  }

  it("downscales to <=1024px long edge, re-encodes JPEG, strips EXIF", async () => {
    const src = await buildExifSourceBuffer();
    expect((await sharp(src).metadata()).exif).toBeInstanceOf(Buffer);

    const getObject = jest.fn().mockResolvedValue(src);
    const service = new VisionPrepService(buildStorage(getObject), buildOkCheck());
    const intake = buildIntake([["key-1"]]);

    const result = await service.prepare({ intake, checkId: "check-resize" });

    expect(result.includedCount).toBe(1);
    const [image] = result.images;
    if (!image) throw new Error("expected one prepared image");
    expect(image.mimeType).toBe("image/jpeg");

    const buf = Buffer.from(image.base64, "base64");
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBeLessThanOrEqual(1024);
    expect(meta.height).toBeLessThanOrEqual(1024);
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined();
    if (meta.width === undefined || meta.height === undefined) throw new Error("expected dimensions");
    expect(meta.width / meta.height).toBeCloseTo(2000 / 1500, 1);
  });

  it("caps to VISION_MAX_IMAGES and drops extras from the end", async () => {
    const src = await buildPlainSourceBuffer();
    const getObject = jest.fn().mockResolvedValue(src);
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const service = new VisionPrepService(buildStorage(getObject), buildOkCheck());
    const intake = buildIntake([["key-1", "key-2"], ["key-3", "key-4"]]);

    const result = await service.prepare({ intake, checkId: "check-count" });

    expect(result.requestedCount).toBe(4);
    expect(result.includedCount).toBe(3);
    expect(result.truncated).toBe(true);
    expect(getObject).toHaveBeenCalledTimes(3);
    expect(getObject.mock.calls.map((call) => call[0])).toEqual(["key-1", "key-2", "key-3"]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        checkId: "check-count",
        reason: "max_images",
        requestedCount: 4,
        kept: 3,
        droppedKeys: ["key-4"],
      }),
    );
  });

  it("truncates deterministically when base64 budget is exceeded", async () => {
    const src = await buildPlainSourceBuffer();
    const singleImageBase64Length = await computeProcessedBase64Length(src);
    const getObject = jest.fn().mockResolvedValue(src);
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const service = new VisionPrepService(buildStorage(getObject), buildOkCheck());
    const intake = buildIntake([["key-1", "key-2", "key-3"]]);

    const result = await service.prepare({
      intake,
      checkId: "check-budget",
      limits: { byteBudgetBytes: singleImageBase64Length },
    });

    expect(result.requestedCount).toBe(3);
    expect(result.includedCount).toBe(1);
    expect(result.truncated).toBe(true);
    expect(result.totalBase64Bytes).toBeLessThanOrEqual(singleImageBase64Length);
    expect(getObject).toHaveBeenCalledTimes(2);
    expect(getObject.mock.calls.map((call) => call[0])).toEqual(["key-1", "key-2"]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        checkId: "check-budget",
        key: "key-2",
        reason: "byte_budget",
        budget: singleImageBase64Length,
        droppedFromHere: ["key-2", "key-3"],
      }),
    );
  });

  it("is deterministic: same input yields identical included set and order", async () => {
    const src = await buildPlainSourceBuffer();
    const intake = buildIntake([["key-1", "key-2"], ["key-3", "key-4"]]);

    const service1 = new VisionPrepService(
      buildStorage(jest.fn().mockResolvedValue(src)),
      buildOkCheck(),
    );
    const result1 = await service1.prepare({ intake, checkId: "check-det" });

    const service2 = new VisionPrepService(
      buildStorage(jest.fn().mockResolvedValue(src)),
      buildOkCheck(),
    );
    const result2 = await service2.prepare({ intake, checkId: "check-det" });

    expect(result2.images.map((image) => image.base64)).toEqual(result1.images.map((image) => image.base64));
    expect(result2.includedCount).toBe(result1.includedCount);
    expect(result2.requestedCount).toBe(result1.requestedCount);
    expect(result2.truncated).toBe(result1.truncated);
  });

  it("returns empty result for an intake with no photos", async () => {
    const getObject = jest.fn();
    const service = new VisionPrepService(buildStorage(getObject), buildOkCheck());
    const intake: CompletedIntake = { category: "vomiting", answers: [] };

    const result = await service.prepare({ intake, checkId: "check-empty" });

    expect(result).toEqual({
      images: [],
      requestedCount: 0,
      includedCount: 0,
      truncated: false,
      totalBase64Bytes: 0,
    });
    expect(getObject).not.toHaveBeenCalled();
  });

  it("invokes the unsafe-image pre-check on every processed image", async () => {
    const src = await buildPlainSourceBuffer();
    const getObject = jest.fn().mockResolvedValue(src);
    const check = jest.fn().mockResolvedValue({ verdict: "ok" });
    const unsafeCheck = { check } as unknown as UnsafeImageCheck;
    const service = new VisionPrepService(buildStorage(getObject), unsafeCheck);
    const intake = buildIntake([["key-1", "key-2"]]);

    await service.prepare({ intake, checkId: "check-unsafe" });

    expect(check).toHaveBeenCalledTimes(2);
    expect(check).toHaveBeenNthCalledWith(1, { bytes: expect.any(Buffer), key: "key-1" });
    expect(check).toHaveBeenNthCalledWith(2, { bytes: expect.any(Buffer), key: "key-2" });
  });

  it("fails open on a flagged verdict: keeps the image and logs a warning", async () => {
    const src = await buildPlainSourceBuffer();
    const getObject = jest.fn().mockResolvedValue(src);
    const check = jest.fn().mockResolvedValue({ verdict: "flagged", reason: "test-reason" });
    const unsafeCheck = { check } as unknown as UnsafeImageCheck;
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const service = new VisionPrepService(buildStorage(getObject), unsafeCheck);
    const intake = buildIntake([["key-1"]]);

    const result = await service.prepare({ intake, checkId: "check-flagged" });

    expect(result.includedCount).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        checkId: "check-flagged",
        key: "key-1",
        reason: "unsafe_flagged",
        detail: "test-reason",
      }),
    );
  });

  it("propagates storage fetch errors (does not swallow)", async () => {
    const getObject = jest.fn().mockRejectedValue(new Error("boom"));
    const service = new VisionPrepService(buildStorage(getObject), buildOkCheck());
    const intake = buildIntake([["key-1"]]);

    await expect(service.prepare({ intake, checkId: "check-error" })).rejects.toThrow("boom");
  });
});
