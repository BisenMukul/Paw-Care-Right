import { createApiClient } from "@pawcareright/api-client";

import { useAuthStore } from "../auth/auth-store";
import { getConfig } from "../config";

// Singleton HTTP client for the mobile app. `getAuthToken` reads the
// in-memory access token from the auth store (never SecureStore directly —
// that would make every request async-await a native storage read). No
// `ApiQueryProvider`/TanStack wiring and no 401->refresh interceptor here —
// both are T019 (out of scope, see plan R8/§2 rule 2).
export const apiClient = createApiClient({
  baseUrl: getConfig().apiBaseUrl,
  getAuthToken: () => useAuthStore.getState().accessToken,
});
