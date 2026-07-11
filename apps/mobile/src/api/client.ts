import { createApiClient } from "@pawcareright/api-client";

import { useAuthStore } from "../auth/auth-store";
import { getConfig } from "../config";

// BARE client — no `refreshSession`/`onSessionExpired`. The auth endpoints
// (refresh/logout) must go through a client that never re-enters the 401
// interceptor below, or a 401 on the refresh call itself would recurse
// (T019 plan R9). `auth-api.ts` uses this exclusively.
export const authClient = createApiClient({
  baseUrl: getConfig().apiBaseUrl,
  getAuthToken: () => useAuthStore.getState().accessToken,
});

// Singleton HTTP client for all domain/data requests. `getAuthToken` reads
// the in-memory access token from the auth store (never SecureStore
// directly — that would make every request async-await a native storage
// read). `refreshSession`/`onSessionExpired` delegate to the auth store, so
// a 401 triggers a single-flighted refresh-then-retry, and a dead session
// (refresh failure, or a still-401 retry) performs a local-only sign-out.
export const apiClient = createApiClient({
  baseUrl: getConfig().apiBaseUrl,
  getAuthToken: () => useAuthStore.getState().accessToken,
  refreshSession: () => useAuthStore.getState().refreshSession(),
  onSessionExpired: () => useAuthStore.getState().sessionExpired(),
});
