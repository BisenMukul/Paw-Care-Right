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

/** True iff `key` is a single flat object under this pet's original-upload
 *  namespace. Rejects a foreign prefix, path-traversal (`..`) and any extra
 *  `/` segment, so a derived thumb/main key can never escape the namespace. */
export function isKeyInPetNamespace(petId: string, key: string): boolean {
  const prefix = originalKeyPrefix(petId);
  if (!key.startsWith(prefix)) return false;
  const remainder = key.slice(prefix.length);
  if (remainder.length === 0) return false;
  if (remainder.includes("/")) return false;
  if (remainder.includes("..")) return false;
  return true;
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
