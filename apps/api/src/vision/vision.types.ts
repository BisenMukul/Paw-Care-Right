import type { CompletedIntake } from "@pawcareright/types";

/**
 * Structurally assignable to `packages/ai`'s `VisionImage`
 * (`{ base64?: string; url?: string; mimeType: string }`) — see plan R3.
 * NOT importing `VisionImage` here keeps this task free of the
 * `@pawcareright/ai` workspace alias/tsconfig/jest-mapper cost (T043 wires
 * that when it consumes `PreparedVisionInput.images` directly).
 */
export interface PreparedVisionImage {
  base64: string;
  mimeType: string;
}

export interface PreparedVisionInput {
  images: PreparedVisionImage[];
  requestedCount: number;
  includedCount: number;
  truncated: boolean;
  totalBase64Bytes: number;
}

export interface VisionPrepLimits {
  maxImages: number;
  byteBudgetBytes: number;
}

export interface UnsafeImageVerdict {
  verdict: "ok" | "flagged";
  reason?: string;
}

/**
 * v1 stub interface (log-only, fail-open — see plan Safety statement / R7).
 * Real enforcement (T038 red-team detector, T052 moderation hardening)
 * implements this same interface via the `UNSAFE_IMAGE_CHECK` DI token with
 * zero pipeline changes.
 */
export interface UnsafeImageCheck {
  check(input: { bytes: Buffer; key: string }): Promise<UnsafeImageVerdict>;
}

/**
 * DI token for the injected `UnsafeImageCheck` implementation — mirrors the
 * `S3_CLIENT` symbol-token pattern in `storage.service.ts`.
 */
export const UNSAFE_IMAGE_CHECK = Symbol("UNSAFE_IMAGE_CHECK");

export interface VisionPrepInput {
  intake: CompletedIntake;
  checkId: string;
  /** Testability seam only (R4) — production callers omit this. */
  limits?: Partial<VisionPrepLimits>;
}
