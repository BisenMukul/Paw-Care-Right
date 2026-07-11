export const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const contentTypeToExt: Record<AllowedContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** `pets/<petId>/original/<uuid>.<ext>` — the key the client PUTs the raw upload to. */
export function buildOriginalKey(petId: string, uuid: string, ext: string): string {
  return `${originalKeyPrefix(petId)}${uuid}.${ext}`;
}

/** Namespace every original upload for `petId` must live under. */
export function originalKeyPrefix(petId: string): string {
  return `pets/${petId}/original/`;
}

/** `pets/<petId>/main/<uuid>.jpg` — derived from the original key, same uuid. */
export function deriveMainKey(originalKey: string): string {
  return deriveRenditionKey(originalKey, "main");
}

/** `pets/<petId>/thumb/<uuid>.jpg` — derived from the original key, same uuid. */
export function deriveThumbKey(originalKey: string): string {
  return deriveRenditionKey(originalKey, "thumb");
}

function deriveRenditionKey(originalKey: string, rendition: "main" | "thumb"): string {
  return originalKey.replace("/original/", `/${rendition}/`).replace(/\.[^./]+$/, ".jpg");
}
