import Constants from "expo-constants";

// Single typed accessor for runtime config (CLAUDE.md §6 — no hardcoded
// URLs/ids in components). Defaults mirror `app.config.ts`'s `extra` block
// so behavior is identical whether `expoConfig` is populated or not (e.g.
// in a bare Jest environment where `expo-constants` is mocked).
export interface AppConfig {
  apiBaseUrl: string;
  googleClientId: string;
}

export function getConfig(): AppConfig {
  const extra = Constants.expoConfig?.extra as
    | { apiBaseUrl?: string; googleClientId?: string }
    | undefined;

  return {
    apiBaseUrl: extra?.apiBaseUrl ?? "http://localhost:3000",
    googleClientId: extra?.googleClientId ?? "",
  };
}
