import type { MMKV } from "react-native-mmkv";
import type { Persister, PersistedClient } from "@tanstack/react-query-persist-client";

const DEFAULT_PERSISTER_KEY = "pawcareright-query-cache";

type MmkvLike = Pick<MMKV, "getString" | "set" | "remove">;

function createMemoryStorage(): MmkvLike {
  const store = new Map<string, string>();

  return {
    getString(key: string) {
      return store.get(key);
    },
    set(key: string, value: string) {
      store.set(key, value);
    },
    remove(key: string) {
      store.delete(key);
    },
  };
}

function resolveStorage(options: CreateMmkvPersisterOptions): MmkvLike {
  if (options.mmkv) {
    return options.mmkv;
  }

  try {
    const runtime = require("react-native-mmkv") as { createMMKV?: () => MmkvLike };
    if (typeof runtime.createMMKV === "function") {
      return runtime.createMMKV();
    }
  } catch {
    // Fall back to an in-memory store so Expo Go startup does not crash when
    // the native MMKV binding cannot be loaded.
  }

  return createMemoryStorage();
}

export interface CreateMmkvPersisterOptions {
  /** Reuse an existing MMKV instance; a dedicated one is created via `createMMKV()` if omitted. */
  mmkv?: MMKV;
  /** Storage key under which the serialized cache is persisted. */
  key?: string;
}

/**
 * Mobile-only TanStack Query persister backed by MMKV. Not exported from the
 * package's core (`.`) entry so `react-native-mmkv` never enters the web
 * import graph — import this from `@pawcareright/api-client/mmkv-persister`.
 */
export function createMmkvPersister(options: CreateMmkvPersisterOptions = {}): Persister {
  const storage = resolveStorage(options);
  const key = options.key ?? DEFAULT_PERSISTER_KEY;

  return {
    persistClient(persistedClient: PersistedClient): Promise<void> {
      storage.set(key, JSON.stringify(persistedClient));
      return Promise.resolve();
    },
    restoreClient(): Promise<PersistedClient | undefined> {
      const raw = storage.getString(key);
      if (raw === undefined) {
        return Promise.resolve(undefined);
      }
      return Promise.resolve(JSON.parse(raw) as PersistedClient);
    },
    removeClient(): Promise<void> {
      storage.remove(key);
      return Promise.resolve();
    },
  };
}
