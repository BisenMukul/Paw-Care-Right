import { apiClient } from "./client";

/**
 * The seam between the schema-driven intake renderer and the pet-scoped
 * upload endpoints (T046 plan §"petId / capability seam design"). The
 * renderer/`PhotoPromptQuestion` never learn `petId` — they only see this
 * capability, constructed by `app/check/[category].tsx` (which owns the
 * route's `petId` param).
 */
export interface PhotoUploadCapability {
  upload(localUri: string, onProgress: (progress: number) => void): Promise<{ key: string }>;
}

/**
 * Presign -> XHR PUT (with upload progress) -> confirm, mirroring
 * `src/api/pets-api.ts#uploadPetPhoto` exactly except for the progress
 * mechanism: `fetch` exposes no upload-progress events in RN, so the PUT
 * step uses `XMLHttpRequest` (plan Key decision 1 / Risk 1).
 */
export async function uploadIntakePhoto(
  petId: string,
  localUri: string,
  onProgress: (progress: number) => void,
): Promise<{ key: string }> {
  const blob = await (await fetch(localUri)).blob();

  const { uploadUrl, key } = await apiClient.post<{ uploadUrl: string; key: string }>(
    `/v1/pets/${petId}/photo-upload-url`,
    { contentType: "image/jpeg", contentLength: blob.size },
  );

  await putWithProgress(uploadUrl, blob, onProgress);

  await apiClient.post(`/v1/pets/${petId}/photo-upload-confirm`, { key });

  return { key };
}

function putWithProgress(
  uploadUrl: string,
  blob: Blob,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", "image/jpeg");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error("upload failed"));
      }
    };

    xhr.onerror = () => {
      reject(new Error("upload failed"));
    };

    xhr.send(blob);
  });
}
