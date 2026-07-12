import { Inject, Injectable, Logger } from "@nestjs/common";
import sharp from "sharp";

import { StorageService } from "../storage/storage.service";
import {
  DEFAULT_VISION_LIMITS,
  VISION_JPEG_QUALITY,
  VISION_MAX_EDGE,
  VISION_OUTPUT_MIME,
} from "./vision.constants";
import {
  UNSAFE_IMAGE_CHECK,
  type PreparedVisionImage,
  type PreparedVisionInput,
  type UnsafeImageCheck,
  type VisionPrepInput,
  type VisionPrepLimits,
} from "./vision.types";
import { collectPhotoKeys } from "./vision.util";

/**
 * Turns a completed intake's photo keys into provider-ready base64 images:
 * fetch bytes from storage -> downscale to <=1024px long edge -> strip all
 * metadata (EXIF/GPS) -> run the injected (v1 log-only) unsafe-image
 * pre-check -> base64-package with a <=3-image count cap and a pinned total
 * base64-byte budget, truncating deterministically (intake answer order,
 * drop from the end) with a structured `Logger.warn`. No HTTP surface, no
 * worker wiring — T043 is the sole consumer.
 */
@Injectable()
export class VisionPrepService {
  private readonly logger = new Logger(VisionPrepService.name);

  constructor(
    private readonly storage: StorageService,
    @Inject(UNSAFE_IMAGE_CHECK) private readonly unsafeCheck: UnsafeImageCheck,
  ) {}

  async prepare(input: VisionPrepInput): Promise<PreparedVisionInput> {
    const limits: VisionPrepLimits = { ...DEFAULT_VISION_LIMITS, ...(input.limits ?? {}) };
    const allKeys = collectPhotoKeys(input.intake);
    const requestedCount = allKeys.length;

    const capped = allKeys.slice(0, limits.maxImages);
    if (allKeys.length > limits.maxImages) {
      this.logger.warn({
        checkId: input.checkId,
        reason: "max_images",
        requestedCount,
        kept: capped.length,
        droppedKeys: allKeys.slice(limits.maxImages),
      });
    }

    const images: PreparedVisionImage[] = [];
    let totalBase64Bytes = 0;

    for (const [index, key] of capped.entries()) {
      // Sequential, ordered, early-break pipeline (plan R8) — parallelizing
      // fetches would break the deterministic byte-budget accumulation.
      const src = await this.storage.getObject(key);

      const processed = await sharp(src)
        .rotate()
        .resize(VISION_MAX_EDGE, VISION_MAX_EDGE, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: VISION_JPEG_QUALITY })
        .toBuffer();

      const verdict = await this.unsafeCheck.check({ bytes: processed, key });
      if (verdict.verdict === "flagged") {
        // v1 fail-open: log only, never drop/throw (plan Safety statement / R7).
        this.logger.warn({
          checkId: input.checkId,
          key,
          reason: "unsafe_flagged",
          detail: verdict.reason,
        });
      }

      const base64 = processed.toString("base64");
      const size = base64.length;

      if (totalBase64Bytes + size > limits.byteBudgetBytes) {
        this.logger.warn({
          checkId: input.checkId,
          key,
          reason: "byte_budget",
          totalBase64Bytes,
          wouldAdd: size,
          budget: limits.byteBudgetBytes,
          droppedFromHere: capped.slice(index),
        });
        break;
      }

      images.push({ base64, mimeType: VISION_OUTPUT_MIME });
      totalBase64Bytes += size;
    }

    return {
      images,
      requestedCount,
      includedCount: images.length,
      truncated: images.length < requestedCount,
      totalBase64Bytes,
    };
  }
}
