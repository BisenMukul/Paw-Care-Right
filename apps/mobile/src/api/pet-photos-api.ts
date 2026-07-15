import { useQuery } from "@tanstack/react-query";

import { apiClient } from "./client";

/**
 * Local mirror (T069 plan — mirrors `WeightSeriesResponse`'s precedent in
 * `health-logs-api.ts`) of the api's `PhotosService.PhotoViewUrlsResponse` —
 * no import across the api/mobile boundary.
 */
export interface PhotoViewItem {
  key: string;
  thumbUrl: string;
  mainUrl: string;
}

export interface PhotoViewUrlsResponse {
  items: PhotoViewItem[];
}

const PHOTO_VIEW_URLS_STALE_TIME_MS = 4 * 60 * 1000;

/**
 * `POST /v1/pets/:petId/photo-view-urls` (T069's endpoint) — shared by
 * `TimelinePhotoStrip` and `TimelinePhotoViewer` under the same query key so
 * the viewer reuses the strip's already-cached URLs instantly (plan
 * decision 6). `staleTime` sits below the 300s presign expiry so URLs don't
 * churn per render but do refresh before they die.
 */
export function usePhotoViewUrls(petId: string, photoKeys: string[]) {
  return useQuery({
    queryKey: ["pet-photo-view-urls", petId, photoKeys.join(",")],
    queryFn: () =>
      apiClient.post<PhotoViewUrlsResponse>(`/v1/pets/${petId}/photo-view-urls`, { keys: photoKeys }),
    enabled: petId.length > 0 && photoKeys.length > 0,
    staleTime: PHOTO_VIEW_URLS_STALE_TIME_MS,
  });
}
