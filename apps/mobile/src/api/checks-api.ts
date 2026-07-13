import { isTerminalCheckStatus, type CheckResponse, type CompletedIntake } from "@pawcareright/types";
import type { Query } from "@tanstack/react-query";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";

export const checksKeys = {
  all: ["checks"] as const,
  detail: (id: string) => ["checks", id] as const,
  list: (petId: string) => ["checks", "pet", petId] as const,
};

/** Poll cadence for `useCheck` (T047 plan "Hook & helper specs"). */
export const CHECK_POLL_INTERVAL_MS = 1500;

/**
 * Pure `refetchInterval`-as-function (TanStack v5 form): receives the Query,
 * reads its data. `undefined` data (no response yet) keeps polling; a
 * terminal status (DONE/FALLBACK, D4) stops it. Widened to the library's
 * `Query` type (plan Risk 5) so it type-checks as `useCheck`'s
 * `refetchInterval`; the unit test constructs a minimal structurally-typed
 * stand-in and casts it.
 */
export function checkRefetchInterval(query: Query<CheckResponse>): number | false {
  const status = query.state.data?.status;
  if (status === undefined) {
    return CHECK_POLL_INTERVAL_MS;
  }
  return isTerminalCheckStatus(status) ? false : CHECK_POLL_INTERVAL_MS;
}

/** Polls `GET /v1/checks/:id` until the check reaches a terminal status. */
export function useCheck(checkId: string) {
  return useQuery({
    queryKey: checksKeys.detail(checkId),
    queryFn: () => apiClient.get<CheckResponse>(`/v1/checks/${checkId}`),
    enabled: checkId.length > 0,
    refetchInterval: checkRefetchInterval,
  });
}

/** Submits a completed intake via `POST /v1/pets/:petId/checks` (mirrors `useCreatePet`). */
export function useCreateCheck(petId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { intake: CompletedIntake; photoKeys: string[]; idempotencyKey: string }) =>
      apiClient.post<CheckResponse>(
        `/v1/pets/${petId}/checks`,
        { intake: vars.intake, photoKeys: vars.photoKeys },
        { headers: { "Idempotency-Key": vars.idempotencyKey } },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: checksKeys.list(petId) });
    },
  });
}

/** A single page of `GET /v1/pets/:petId/checks` (T050 plan D2). */
export interface CheckListPage {
  items: CheckResponse[];
  nextCursor: string | null;
}

export const CHECKS_LIST_PAGE_SIZE = 20;

/**
 * Cursor-paginated check history for a pet (T050 plan). Shares
 * `checksKeys.list(petId)` with `useCreateCheck`'s invalidation, so a newly
 * created check refetches all loaded pages of this list.
 */
export function useChecksList(petId: string) {
  return useInfiniteQuery({
    queryKey: checksKeys.list(petId),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => {
      const params = new URLSearchParams({ limit: String(CHECKS_LIST_PAGE_SIZE) });
      if (pageParam !== undefined) params.set("cursor", pageParam);
      return apiClient.get<CheckListPage>(`/v1/pets/${petId}/checks?${params.toString()}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: CheckListPage) => lastPage.nextCursor ?? undefined,
    enabled: petId.length > 0,
  });
}
