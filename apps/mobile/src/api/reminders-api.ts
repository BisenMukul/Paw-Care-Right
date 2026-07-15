import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { agendaKeys } from "./agenda-api";
import { apiClient } from "./client";

/**
 * Reminder CRUD hooks (T060 plan "NOTE"): kept separate from
 * `agenda-api.ts` (agenda-only). No shared Zod schema exists for the
 * `Reminder` resource in `@pawcareright/types` (only the agenda/occurrence
 * shapes were added for T060) -- this local `Reminder` interface mirrors
 * `apps/api/src/reminders/reminders.service.ts`'s `ReminderResponse`
 * structurally, the same "service-local read type" posture already used
 * for `AgendaEntry` pre-T060.
 */
export interface Reminder {
  id: string;
  petId: string;
  type: string;
  title: string;
  rrule: string;
  timezone: string;
  startAt: string;
  nextFireAt: string;
  medNameAsEntered?: string;
  active: boolean;
  templateKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReminderInput {
  type: string;
  title: string;
  rrule: string;
  timezone: string;
  startAt: string;
}

export type UpdateReminderInput = Partial<CreateReminderInput>;

export const remindersKeys = {
  detail: (id: string) => ["reminders", id] as const,
};

/** GET `/v1/reminders/:id` -- used to seed the edit form. */
export function useReminder(id: string) {
  return useQuery({
    queryKey: remindersKeys.detail(id),
    queryFn: () => apiClient.get<Reminder>(`/v1/reminders/${id}`),
    enabled: id.length > 0,
  });
}

/** POST `/v1/pets/:petId/reminders` -- invalidates the agenda so the new reminder's occurrences appear. */
export function useCreateReminder(petId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReminderInput) => apiClient.post<Reminder>(`/v1/pets/${petId}/reminders`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agendaKeys.all });
    },
  });
}

/** PATCH `/v1/reminders/:id` -- invalidates the agenda + the cached reminder detail. */
export function useUpdateReminder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateReminderInput) => apiClient.patch<Reminder>(`/v1/reminders/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agendaKeys.all });
      void queryClient.invalidateQueries({ queryKey: remindersKeys.detail(id) });
    },
  });
}
