import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { apiClient } from "../api/client";

export type PushRegistrationResult = "granted" | "denied" | "error";

export interface UsePushRegistrationResult {
  register(): Promise<PushRegistrationResult>;
}

/**
 * JIT device push-token registration (CLAUDE.md §6 — permissions requested
 * just-in-time with a rationale screen first, see `push-rationale.tsx`).
 * Fully failure-tolerant: any error (permission denial, missing project id,
 * network failure) resolves to `"error"`/`"denied"` and never throws, so the
 * caller can always proceed into the app.
 */
export function usePushRegistration(): UsePushRegistrationResult {
  async function register(): Promise<PushRegistrationResult> {
    try {
      let permission = await Notifications.getPermissionsAsync();

      if (permission.status === "undetermined") {
        permission = await Notifications.requestPermissionsAsync();
      }

      if (permission.status !== "granted") {
        return "denied";
      }

      const projectId = (
        Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
      )?.eas?.projectId;

      if (projectId === undefined) {
        return "error";
      }

      const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      await apiClient.post("/v1/devices", {
        expoPushToken,
        platform: Platform.OS,
      });

      return "granted";
    } catch {
      return "error";
    }
  }

  return { register };
}
