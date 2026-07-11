import { apiClient } from "./client";

// No shared Zod auth-response schema exists in `packages/types` (verified —
// see plan R9); this local interface mirrors the api's `AuthService`
// `AuthTokens` shape and is not a forbidden duplicate of a shared schema.
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string };
  householdId: string;
}

export type SocialProvider = "apple" | "google";

export const authApi = {
  requestOtp(email: string): Promise<{ ok: true }> {
    return apiClient.post<{ ok: true }>("/v1/auth/otp/request", { email });
  },
  verifyOtp(email: string, code: string): Promise<AuthTokens> {
    return apiClient.post<AuthTokens>("/v1/auth/otp/verify", { email, code });
  },
  social(provider: SocialProvider, identityToken: string): Promise<AuthTokens> {
    return apiClient.post<AuthTokens>("/v1/auth/social", {
      provider,
      identityToken,
    });
  },
  refresh(refreshToken: string): Promise<AuthTokens> {
    return apiClient.post<AuthTokens>("/v1/auth/refresh", { refreshToken });
  },
  logout(refreshToken: string): Promise<{ ok: true }> {
    return apiClient.post<{ ok: true }>("/v1/auth/logout", { refreshToken });
  },
};
