/**
 * Pure, framework-free per-photo upload state machine (T046 plan §"Upload
 * state machine spec"). No React, no I/O — consumed by the
 * `usePhotoUploads` hook in `photo-prompt-question.tsx`. Every transition is
 * total: an illegal/unknown event is a no-op that returns the input `slot`
 * unchanged (never throws).
 */

export type PhotoUploadStatus = "pending" | "uploading" | "uploaded" | "failed";

export interface PhotoSlot {
  id: string;
  /** Local preview URI. Absent for answer-seeded uploaded slots (plan Key decision 6). */
  uri?: string | undefined;
  status: PhotoUploadStatus;
  progress: number;
  /** Present iff `status === "uploaded"`. `exactOptionalPropertyTypes` requires the
   * explicit `| undefined` so transitions can clear it (matches `packages/types`
   * convention, e.g. `intake.ts`'s `freeText?: string | undefined`). */
  key?: string | undefined;
}

export type PhotoUploadEvent =
  | { type: "START" }
  | { type: "PROGRESS"; progress: number }
  | { type: "SUCCEED"; key: string }
  | { type: "FAIL" }
  | { type: "RETRY" };

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Pure reducer over the transition table in the plan. Returns a new
 * `PhotoSlot` for legal transitions, or the exact same `slot` reference for
 * no-ops (illegal event for the current status).
 */
export function photoUploadReducer(slot: PhotoSlot, event: PhotoUploadEvent): PhotoSlot {
  switch (event.type) {
    case "START":
      if (slot.status !== "pending") {
        return slot;
      }
      return { ...slot, status: "uploading", progress: 0, key: undefined };

    case "RETRY":
      if (slot.status !== "failed") {
        return slot;
      }
      return { ...slot, status: "uploading", progress: 0, key: undefined };

    case "PROGRESS":
      if (slot.status !== "uploading") {
        return slot;
      }
      return { ...slot, progress: clamp01(event.progress) };

    case "SUCCEED":
      if (slot.status !== "uploading") {
        return slot;
      }
      return { ...slot, status: "uploaded", progress: 1, key: event.key };

    case "FAIL":
      if (slot.status !== "uploading") {
        return slot;
      }
      return { ...slot, status: "failed" };

    default:
      return slot;
  }
}

/** Freshly picked/compressed photo, not yet uploaded. */
export function createPendingSlot(id: string, uri: string): PhotoSlot {
  return { id, uri, status: "pending", progress: 0 };
}

/** Answer-seeded slot for a photo already uploaded in a prior render (no local preview URI). */
export function createUploadedSlotFromKey(id: string, key: string): PhotoSlot {
  return { id, status: "uploaded", progress: 1, key };
}

/** Keys of every `uploaded` slot, in array order. */
export function collectUploadedKeys(slots: PhotoSlot[]): string[] {
  const keys: string[] = [];
  for (const slot of slots) {
    if (slot.status === "uploaded" && slot.key !== undefined) {
      keys.push(slot.key);
    }
  }
  return keys;
}
