export interface SafeStorageLike {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SafeStorageOptions {
  createMmkv?: () => SafeStorageLike;
}

export function createSafeStorage(options: SafeStorageOptions = {}): SafeStorageLike & StorageLike {
  const createMmkv = options.createMmkv;

  if (createMmkv) {
    try {
      const mmkv = createMmkv();
      // The raw MMKV instance only implements SafeStorageLike; adapt it so
      // StorageLike consumers (zustand createJSONStorage, web-style callers)
      // work on the native path too, not just the memory fallback.
      return {
        getString: (key) => mmkv.getString(key),
        getItem: (key) => mmkv.getString(key) ?? null,
        set: (key, value) => {
          mmkv.set(key, value);
        },
        setItem: (key, value) => {
          mmkv.set(key, value);
        },
        remove: (key) => {
          mmkv.remove(key);
        },
        removeItem: (key) => {
          mmkv.remove(key);
        },
      };
    } catch {
      // Fall back to memory storage so Expo Go startup does not crash when
      // the native MMKV binding is unavailable at runtime.
    }
  }

  const memory = new Map<string, string>();

  return {
    getString(key: string) {
      return memory.get(key);
    },
    getItem(key: string) {
      return memory.has(key) ? memory.get(key)! : null;
    },
    set(key: string, value: string) {
      memory.set(key, value);
    },
    setItem(key: string, value: string) {
      memory.set(key, value);
    },
    remove(key: string) {
      memory.delete(key);
    },
    removeItem(key: string) {
      memory.delete(key);
    },
  };
}
