import type { ActivityType, ActivityUnit, HealthLogKind, VetVisitValue } from "@pawcareright/types";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";

/**
 * `healthTimelineKeys.pet(petId)` is the T066 mutation-invalidation prefix.
 * `.list(petId, kind)` (T067 plan decision 5) extends it with a `kind`
 * segment so each kind filter caches independently, while a
 * `pet(petId)`-scoped invalidation (T066's mutations) still matches every
 * kind variant via TanStack's default `exact: false` prefix match.
 */
export const healthTimelineKeys = {
  all: ["health-timeline"] as const,
  pet: (petId: string) => ["health-timeline", petId] as const,
  list: (petId: string, kind: HealthLogKind | null) =>
    [...healthTimelineKeys.pet(petId), kind ?? "all"] as const,
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

export interface AddVetVisitVars {
  value: VetVisitValue;
  photoKeys: string[];
}

/**
 * `POST /v1/pets/:petId/logs` with `kind: "VET_VISIT"`. `value` is exactly
 * the shared `VetVisitValue` (already validated client-side by
 * `validateVetVisitForm`) — no cost/med/dose field is added here (T066 plan
 * decision 5 / CLAUDE §7). `photoKeys` is included only when non-empty
 * (T069 plan decision 8 — mirrors `useAddNote`'s pattern exactly).
 */
export function useAddVetVisit(petId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: AddVetVisitVars) =>
      apiClient.post(`/v1/pets/${petId}/logs`, {
        kind: "VET_VISIT",
        occurredAt: new Date().toISOString(),
        value: vars.value,
        ...(vars.photoKeys.length > 0 ? { photoKeys: vars.photoKeys } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: healthTimelineKeys.pet(petId) });
    },
  });
}

export interface AddActivityVars {
  activityType: ActivityType;
  quantity?: number;
  unit?: ActivityUnit;
  note?: string;
}

/**
 * `POST /v1/pets/:petId/logs` with `kind: "ACTIVITY"` (founder-directed
 * tap-first activity log). `quantity`/`unit`/`note` are included only when
 * present (mirrors `useAddNote`'s "omit rather than send empty" pattern) --
 * the sheet's ≤2-tap defaults still round-trip through
 * `activityValueSchema` server-side either way.
 */
export function useAddActivity(petId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: AddActivityVars) =>
      apiClient.post(`/v1/pets/${petId}/logs`, {
        kind: "ACTIVITY",
        occurredAt: new Date().toISOString(),
        value: {
          activityType: vars.activityType,
          ...(vars.quantity !== undefined ? { quantity: vars.quantity } : {}),
          ...(vars.unit !== undefined ? { unit: vars.unit } : {}),
          ...(vars.note !== undefined && vars.note.length > 0 ? { note: vars.note } : {}),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: healthTimelineKeys.pet(petId) });
    },
  });
}

/**
 * Local mirror (T067 plan — mirrors `WeightSeriesResponse`'s comment above)
 * of the api's `HealthLogsService.HealthLogResponse` — no import across the
 * api/mobile boundary.
 */
export interface TimelineItem {
  id: string;
  kind: HealthLogKind;
  occurredAt: string;
  value: Record<string, unknown>;
  photoKeys: string[];
}

/** Local mirror of the api's `HealthLogsService.TimelineListResponse`. */
export interface TimelinePage {
  items: TimelineItem[];
  nextCursor: string | null;
}

export const HEALTH_TIMELINE_PAGE_SIZE = 20;

/**
 * Cursor-paginated, kind-filterable health timeline for a pet (T067 plan).
 * Shares `healthTimelineKeys.pet(petId)` as its query-key prefix with
 * `useAddNote`/`useAddVetVisit`'s invalidations (see `healthTimelineKeys`
 * above) — mirrors `useChecksList`'s infinite-query shape.
 */
export function useHealthTimeline(petId: string, kind: HealthLogKind | null) {
  return useInfiniteQuery({
    queryKey: healthTimelineKeys.list(petId, kind),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => {
      const params = new URLSearchParams({ limit: String(HEALTH_TIMELINE_PAGE_SIZE) });
      if (pageParam !== undefined) params.set("cursor", pageParam);
      if (kind !== null) params.set("kind", kind);
      return apiClient.get<TimelinePage>(`/v1/pets/${petId}/logs?${params.toString()}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: TimelinePage) => lastPage.nextCursor ?? undefined,
    enabled: petId.length > 0,
  });
}

/**
 * Local mirror (T068 plan -- mirrors `WeightSeriesResponse`'s precedent
 * above) of the api's `HealthLogsService.VetSummaryResponse` — no import
 * across the api/mobile boundary.
 */
export interface VetSummaryResponse {
  summary: string;
}

/**
 * `GET /v1/pets/:petId/vet-summary` (T068's endpoint) — an on-demand
 * fetch-then-share mutation (not a query: the digest is prepared once,
 * when the owner taps "Prepare vet summary", never cached/refetched).
 */
export function usePrepareVetSummary(petId: string) {
  return useMutation({
    mutationFn: () => apiClient.get<VetSummaryResponse>(`/v1/pets/${petId}/vet-summary`),
  });
}
