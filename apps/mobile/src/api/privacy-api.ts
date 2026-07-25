import type {
  AccountDeletionStatus,
  AccountExportRequest,
  AccountPrivacySettings,
  UpdateAccountPrivacySettingsInput,
} from "@pawcareright/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";

export const privacyKeys = {
  me: ["privacy", "me"] as const,
};

/** GET `/v1/me/privacy` (T091): the caller's privacy settings + any pending deletion. */
export function usePrivacySettings() {
  return useQuery({
    queryKey: privacyKeys.me,
    queryFn: () => apiClient.get<AccountPrivacySettings>("/v1/me/privacy"),
  });
}

/** PUT `/v1/me/privacy` (T091): updates and invalidates the cached settings. */
export function useUpdatePrivacySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAccountPrivacySettingsInput) =>
      apiClient.put<AccountPrivacySettings>("/v1/me/privacy", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: privacyKeys.me });
    },
  });
}

/** POST `/v1/me/export` (T091): requests (or returns the existing pending) full-data export. */
export function useRequestExport() {
  return useMutation({
    mutationFn: () => apiClient.post<AccountExportRequest>("/v1/me/export"),
  });
}

/**
 * DELETE `/v1/me` (T091): schedules the caller's account for hard deletion
 * after the grace period, or throws an `ApiError` with `code: "CONFLICT"`
 * for D1 case (c) — a shared-household owner. Invalidates the cached
 * privacy settings on success so `deletionScheduledAt` reflects the new
 * pending state if the screen is re-visited before sign-out completes.
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete<AccountDeletionStatus>("/v1/me"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: privacyKeys.me });
    },
  });
}
