import type { NotificationPrefs, UpdateNotificationPrefsInput } from "@pawcareright/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";

export const notificationPrefsKeys = {
  me: ["notification-prefs", "me"] as const,
};

/** GET `/v1/me/notification-prefs` (T058): the caller's notification preferences. */
export function useNotificationPrefs() {
  return useQuery({
    queryKey: notificationPrefsKeys.me,
    queryFn: () => apiClient.get<NotificationPrefs>("/v1/me/notification-prefs"),
  });
}

/** PUT `/v1/me/notification-prefs` (T058): upserts and invalidates the cached prefs. */
export function useUpdateNotificationPrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateNotificationPrefsInput) =>
      apiClient.put<NotificationPrefs>("/v1/me/notification-prefs", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationPrefsKeys.me });
    },
  });
}
