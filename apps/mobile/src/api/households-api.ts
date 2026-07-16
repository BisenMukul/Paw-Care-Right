import type {
  AcceptInviteInput,
  AcceptInviteResponse,
  CreateInviteResponse,
  HouseholdMe,
  LeaveHouseholdResponse,
} from "@pawcareright/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { billingKeys } from "./billing-api";
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

/**
 * POST `/v1/households/leave` — member-initiated self-leave (T077). Success
 * re-provisions the caller into a fresh solo household, so the pets list,
 * household-members view, and billing entitlement (a family grant drops
 * once the caller is no longer in that household) are all invalidated.
 */
export function useLeaveHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<LeaveHouseholdResponse>("/v1/households/leave"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: petsKeys.all });
      void queryClient.invalidateQueries({ queryKey: householdKeys.me });
      void queryClient.invalidateQueries({ queryKey: billingKeys.entitlement });
    },
  });
}
