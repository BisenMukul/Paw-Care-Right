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
  signOut(): Promise<void>;
  markPushAsked(): void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "restoring",
  user: null,
  householdId: null,
  accessToken: null,
  pushAsked: false,

  async restore() {
    const refreshToken = await readRefreshToken();
    if (refreshToken === null) {
      set({ status: "signedOut" });
      return;
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
    } catch {
      await clearTokens();
      set({
        status: "signedOut",
        user: null,
        householdId: null,
        accessToken: null,
      });
    }
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
