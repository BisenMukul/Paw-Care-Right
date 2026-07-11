import { create } from "zustand";

import { authApi } from "../api/auth-api";
import { clearTokens, readRefreshToken, saveTokens } from "./secure-store";

export type AuthStatus = "restoring" | "signedOut" | "signedIn";

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  householdId: string | null;
  /** In-memory only; source for the api-client `getAuthToken`. */
  accessToken: string | null;
  pushAsked: boolean;
  restore(): Promise<void>;
  requestOtp(email: string): Promise<void>;
  verifyOtp(email: string, code: string): Promise<void>;
  socialSignIn(provider: "apple" | "google", identityToken: string): Promise<void>;
  /**
   * Reads the stored refresh token, exchanges it for a fresh access token,
   * and persists + applies the result (signedIn). Side-effect-free on any
   * failure (no refresh token, or `authApi.refresh` rejects): returns
   * `null` without mutating SecureStore or store state. Used by both
   * `restore()` and the api-client's 401 interceptor (`src/api/client.ts`).
   */
  refreshSession(): Promise<string | null>;
  /**
   * Local-only logout for a dead session: clears SecureStore and sets
   * `signedOut`. Deliberately does NOT call `authApi.logout` — the session
   * is already known to be unrecoverable, so there is nothing valid to
   * revoke server-side under the expired credentials.
   */
  sessionExpired(): Promise<void>;
  signOut(): Promise<void>;
  markPushAsked(): void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "restoring",
  user: null,
  householdId: null,
  accessToken: null,
  pushAsked: false,

  async restore() {
    const accessToken = await get().refreshSession();

    if (accessToken === null) {
      await clearTokens();
      set({
        status: "signedOut",
        user: null,
        householdId: null,
        accessToken: null,
      });
    }
  },

  async refreshSession() {
    const refreshToken = await readRefreshToken();
    if (refreshToken === null) {
      return null;
    }

    try {
      const tokens = await authApi.refresh(refreshToken);
      await saveTokens(tokens);
      set({
        status: "signedIn",
        user: tokens.user,
        householdId: tokens.householdId,
        accessToken: tokens.accessToken,
      });
      return tokens.accessToken;
    } catch {
      return null;
    }
  },

  async sessionExpired() {
    await clearTokens();
    set({
      status: "signedOut",
      user: null,
      householdId: null,
      accessToken: null,
    });
  },

  async requestOtp(email: string) {
    await authApi.requestOtp(email);
  },

  async verifyOtp(email: string, code: string) {
    const tokens = await authApi.verifyOtp(email, code);
    await saveTokens(tokens);
    set({
      status: "signedIn",
      user: tokens.user,
      householdId: tokens.householdId,
      accessToken: tokens.accessToken,
    });
  },

  async socialSignIn(provider, identityToken) {
    const tokens = await authApi.social(provider, identityToken);
    await saveTokens(tokens);
    set({
      status: "signedIn",
      user: tokens.user,
      householdId: tokens.householdId,
      accessToken: tokens.accessToken,
    });
  },

  async signOut() {
    const refreshToken = await readRefreshToken();
    if (refreshToken !== null) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // Best-effort: local sign-out proceeds regardless of server result.
      }
    }
    await clearTokens();
    set({
      status: "signedOut",
      user: null,
      householdId: null,
      accessToken: null,
      pushAsked: false,
    });
  },

  markPushAsked() {
    set({ pushAsked: true });
  },
}));
