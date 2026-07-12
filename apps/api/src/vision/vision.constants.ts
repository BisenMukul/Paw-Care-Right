import type { VisionPrepLimits } from "./vision.types";

/**
 * Pinned vision-input prep constants (T034 plan "Pipeline semantics").
 * These are deliberate design choices (see plan R6), not runtime config —
 * production callers never override them (see `VisionPrepInput.limits`,
 * a testability seam only, R4).
 */
export const VISION_MAX_EDGE = 1024;
export const VISION_JPEG_QUALITY = 80;
export const VISION_MAX_IMAGES = 3;
export const VISION_TOTAL_BASE64_BUDGET_BYTES = 4 * 1024 * 1024;
export const VISION_OUTPUT_MIME = "image/jpeg";

export const DEFAULT_VISION_LIMITS: VisionPrepLimits = {
  maxImages: VISION_MAX_IMAGES,
  byteBudgetBytes: VISION_TOTAL_BASE64_BUDGET_BYTES,
};
