import type { AgendaEntry, AgendaResponse } from "@pawcareright/types";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";

export const agendaKeys = {
  all: ["agenda"] as const,
  window: (params: { from: string; to: string; petId?: string }) =>
    ["agenda", params.from, params.to, params.petId ?? null] as const,
};

/**
 * GET `/v1/agenda?from&to[&petId]` (T060 plan): mirrors `checks-api.ts`'s
 * `URLSearchParams` pattern. `placeholderData: keepPreviousData` (stock
 * TanStack Query v5, no new dependency) keeps the previously-loaded agenda
 * on screen while a pet-filter-chip change is in flight, instead of
 * flashing the full loading state on every chip tap.
 */
export function useAgenda(params: { from: string; to: string; petId?: string }) {
  return useQuery({
    queryKey: agendaKeys.window(params),
    queryFn: () => {
      const query = new URLSearchParams({ from: params.from, to: params.to });
      if (params.petId !== undefined) {
        query.set("petId", params.petId);
      }
      return apiClient.get<AgendaResponse>(`/v1/agenda?${query.toString()}`);
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * Patches every cached `["agenda"]` window's matching entry (keyed on
 * `reminderId`+`dueAt`, mirrors the api's own merge key) to the given
 * status -- used both by the real optimistic `onMutate` and (implicitly,
 * via the same shape) proven by the AC1 rollback test. `undefined`/missing
 * data is passed through unchanged (a not-yet-loaded window has nothing to
 * patch).
 */
function patchEntryStatus(
  data: AgendaResponse | undefined,
  reminderId: string,
  dueAt: string,
  status: AgendaEntry["status"],
): AgendaResponse | undefined {
  if (data === undefined) {
    return data;
  }
  return {
    ...data,
    entries: data.entries.map((entry) =>
      entry.reminderId === reminderId && entry.dueAt === dueAt ? { ...entry, status, virtual: false } : entry,
    ),
  };
}

export interface CompleteOccurrenceVars {
  reminderId: string;
  dueAt: string;
}

/**
 * `POST /v1/reminders/:reminderId/complete` (T060 plan decision 6):
 * optimistically patches every cached agenda window's matching entry to
 * `DONE`, rolling back to the exact pre-mutation snapshot on failure.
 * `onSettled` always invalidates so a success reconciles with the server's
 * real `eventId`/status.
 */
export function useCompleteOccurrence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: CompleteOccurrenceVars) =>
      apiClient.post<AgendaEntry>(`/v1/reminders/${vars.reminderId}/complete`, { dueAt: vars.dueAt }),
    onMutate: async (vars: CompleteOccurrenceVars) => {
      await queryClient.cancelQueries({ queryKey: agendaKeys.all });
      const previous = queryClient.getQueriesData<AgendaResponse>({ queryKey: agendaKeys.all });
      queryClient.setQueriesData<AgendaResponse>({ queryKey: agendaKeys.all }, (old) =>
        patchEntryStatus(old, vars.reminderId, vars.dueAt, "DONE"),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context === undefined) {
        return;
      }
      for (const [queryKey, data] of context.previous) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: agendaKeys.all });
    },
  });
}

export interface SnoozeOccurrenceVars {
  reminderId: string;
  dueAt: string;
  snoozeUntil: string;
}

/** `POST /v1/reminders/:reminderId/snooze` (T060 plan decision 6): same optimistic patch+rollback shape as `useCompleteOccurrence`. */
export function useSnoozeOccurrence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: SnoozeOccurrenceVars) =>
      apiClient.post<AgendaEntry>(`/v1/reminders/${vars.reminderId}/snooze`, {
        dueAt: vars.dueAt,
        snoozeUntil: vars.snoozeUntil,
      }),
    onMutate: async (vars: SnoozeOccurrenceVars) => {
      await queryClient.cancelQueries({ queryKey: agendaKeys.all });
      const previous = queryClient.getQueriesData<AgendaResponse>({ queryKey: agendaKeys.all });
      queryClient.setQueriesData<AgendaResponse>({ queryKey: agendaKeys.all }, (old) =>
        patchEntryStatus(old, vars.reminderId, vars.dueAt, "SNOOZED"),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context === undefined) {
        return;
      }
      for (const [queryKey, data] of context.previous) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: agendaKeys.all });
    },
  });
}
