import type { VetVisitValue } from "@pawcareright/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";

/**
 * Forward contract for T067's timeline list (T066 plan decision 4) — no
 * query consumes this yet, so invalidation below is a harmless no-op today
 * and the honest pattern once `useHealthTimeline` lands.
 */
export const healthTimelineKeys = {
  all: ["health-timeline"] as const,
  pet: (petId: string) => ["health-timeline", petId] as const,
};

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

export interface AddNoteVars {
  text: string;
  photoKeys: string[];
}

/**
 * `POST /v1/pets/:petId/logs` with `kind: "NOTE"`. `photoKeys` is included
 * only when non-empty (mirrors `useAddWeight` omitting the field entirely) —
 * an empty attach set posts a bare NOTE (T066 plan decision 6).
 */
export function useAddNote(petId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: AddNoteVars) =>
      apiClient.post(`/v1/pets/${petId}/logs`, {
        kind: "NOTE",
        occurredAt: new Date().toISOString(),
        value: { text: vars.text },
        ...(vars.photoKeys.length > 0 ? { photoKeys: vars.photoKeys } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: healthTimelineKeys.pet(petId) });
    },
  });
}

export type AddVetVisitVars = VetVisitValue;

/**
 * `POST /v1/pets/:petId/logs` with `kind: "VET_VISIT"`. The vars type is
 * exactly the shared `VetVisitValue` (already validated client-side by
 * `validateVetVisitForm`) — no cost/med/dose field is added here (T066 plan
 * decision 5 / CLAUDE §7).
 */
export function useAddVetVisit(petId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: AddVetVisitVars) =>
      apiClient.post(`/v1/pets/${petId}/logs`, {
        kind: "VET_VISIT",
        occurredAt: new Date().toISOString(),
        value: vars,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: healthTimelineKeys.pet(petId) });
    },
  });
}
