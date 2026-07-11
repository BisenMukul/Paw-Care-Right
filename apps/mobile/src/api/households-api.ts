import type {
  AcceptInviteInput,
  AcceptInviteResponse,
  CreateInviteResponse,
  HouseholdMe,
} from "@pawcareright/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";
import { petsKeys } from "./pets-api";

export const householdKeys = {
  me: ["household", "me"] as const,
};

/** GET `/v1/households/me` (T026): the caller's household and its members. */
export function useHouseholdMe() {
  return useQuery({
    queryKey: householdKeys.me,
    queryFn: () => apiClient.get<HouseholdMe>("/v1/households/me"),
  });
}

/** POST `/v1/households/invites` (OWNER-only server-side) — mints a fresh invite. */
export function useCreateInvite() {
  return useMutation({
    mutationFn: () => apiClient.post<CreateInviteResponse>("/v1/households/invites"),
  });
}

/**
 * POST `/v1/households/invites/accept` — joins the caller into the inviting
 * household (JOIN-REPLACES, see `households.service.ts`). Success replaces
 * the caller's household, so both the pets list and the household-members
 * view are invalidated (plan Interfaces §).
 */
export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AcceptInviteInput) =>
      apiClient.post<AcceptInviteResponse>("/v1/households/invites/accept", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: petsKeys.all });
      void queryClient.invalidateQueries({ queryKey: householdKeys.me });
    },
  });
}
