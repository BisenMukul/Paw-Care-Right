import { createQueryClient } from "@pawcareright/api-client";
import { createMmkvPersister } from "@pawcareright/api-client/mmkv-persister";

import { createSafeStorage } from "../storage/safe-storage";

// Singleton TanStack Query client + persisted cache (offline base, T019).
// The storage layer falls back to in-memory when the native MMKV binding is
// unavailable at runtime (for example in Expo Go), so app startup does not
// crash before the root layout renders.
export const mmkv = createSafeStorage({
  createMmkv: () => {
    const { createMMKV } = require("react-native-mmkv");
    return createMMKV();
  },
});
export const queryClient = createQueryClient();
export const queryPersister = createMmkvPersister({ mmkv });
