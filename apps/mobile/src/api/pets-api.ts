import type { CreatePetInput, Pet } from "@pawcareright/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";

export const petsKeys = {
  all: ["pets"] as const,
  detail: (id: string) => ["pets", id] as const,
};

export function useCreatePet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePetInput) => apiClient.post<Pet>("/v1/pets", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: petsKeys.all });
    },
  });
}

export function usePet(id: string) {
  return useQuery({
    queryKey: petsKeys.detail(id),
    queryFn: () => apiClient.get<Pet>(`/v1/pets/${id}`),
  });
}

/**
 * Presign → PUT → confirm orchestration (matches T023's `PhotosController`).
 * Compression already applied at the photo step, so the blob is a JPEG
 * ≤1600px, well under the presign DTO's size/type limits (plan R7).
 */
export async function uploadPetPhoto(petId: string, localUri: string): Promise<void> {
  const blob = await (await fetch(localUri)).blob();

  const { uploadUrl, key } = await apiClient.post<{ uploadUrl: string; key: string }>(
    `/v1/pets/${petId}/photo-upload-url`,
    { contentType: "image/jpeg", contentLength: blob.size },
  );

  const put = await fetch(uploadUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": "image/jpeg" },
  });
  if (!put.ok) {
    throw new Error("upload failed");
  }

  await apiClient.post(`/v1/pets/${petId}/photo-upload-confirm`, { key });
}
