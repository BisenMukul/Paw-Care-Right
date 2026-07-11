import * as SecureStore from "expo-secure-store";

// The ONLY module in this app that touches `expo-secure-store` (CLAUDE.md
// §6 — tokens live in SecureStore, never AsyncStorage). Centralizing here
// makes the "no AsyncStorage" guarantee auditable in one place.
const ACCESS_TOKEN_KEY = "pawcareright.auth.accessToken";
const REFRESH_TOKEN_KEY = "pawcareright.auth.refreshToken";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function readAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export function readRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
