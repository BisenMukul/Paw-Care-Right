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
      return createMmkv();
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
