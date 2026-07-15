import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";

export const weightSeriesKeys = {
  all: ["weight-series"] as const,
  pet: (petId: string) => ["weight-series", petId] as const,
};

/**
 * Local mirror (T065 plan decision 2) of the api's
 * `HealthLogsService.WeightSeriesResponse` — no import across the
 * api/mobile boundary. `t` is an ISO-8601 string; the screen converts it to
 * a number via `Date.parse` before handing it to the chart geometry.
 */
export interface WeightSeriesResponse {
  points: Array<{ t: string; grams: number }>;
  sampled: boolean;
}

/** `GET /v1/pets/:petId/weight-series` (T064's endpoint), ascending, downsampled server-side. */
export function useWeightSeries(petId: string) {
  return useQuery({
    queryKey: weightSeriesKeys.pet(petId),
    queryFn: () => apiClient.get<WeightSeriesResponse>(`/v1/pets/${petId}/weight-series`),
  });
}

export interface AddWeightVars {
  grams: number;
}

/**
 * `POST /v1/pets/:petId/logs` with `kind: "WEIGHT"` (T064's `CreateLogDto` +
 * `weightValueSchema`). Invalidates the series on success rather than
 * patching optimistically (T065 plan decision 5) — the series is
 * downsampled server-side, so a local point could not be reconstructed
 * faithfully.
 */
export function useAddWeight(petId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: AddWeightVars) =>
      apiClient.post(`/v1/pets/${petId}/logs`, {
        kind: "WEIGHT",
        occurredAt: new Date().toISOString(),
        value: { weightGrams: vars.grams },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: weightSeriesKeys.pet(petId) });
    },
  });
}
