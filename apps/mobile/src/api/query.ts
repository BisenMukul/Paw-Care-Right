import { createQueryClient, isApiError } from "@pawcareright/api-client";
import { createMmkvPersister } from "@pawcareright/api-client/mmkv-persister";
import { MutationCache } from "@tanstack/react-query";

import { useUpsellStore } from "../billing/upsell-store";
import { createSafeStorage } from "../storage/safe-storage";

// Singleton TanStack Query client + persisted cache (offline base, T019).
// The storage layer falls back to in-memory when the native MMKV binding is
// unavailable at runtime (for example in Expo Go), so app startup does not
// crash before the root layout renders.
export const mmkv = createSafeStorage({
  createMmkv: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: lazy runtime require so a missing native MMKV binding (Expo Go) falls back instead of crashing at module load
    const { createMMKV } = require("react-native-mmkv");
    return createMMKV();
  },
});

// Central 402-upsell interceptor (T075 plan decision 7): any mutation that
// fails with `PAYMENT_REQUIRED` shows the global `<UpsellSheet/>`, UNLESS
// the mutation opts out via `meta.skipUpsell` (the checks mutation does —
// it keeps its own bespoke quota screen, avoiding a double UI on the
// §5-adjacent check flow). A future gated mutation that forgets the meta
// correctly falls through to the global sheet (safe default).
const mutationCache = new MutationCache({
  onError: (error, _variables, _context, mutation) => {
    if (isApiError(error) && error.code === "PAYMENT_REQUIRED" && mutation.options.meta?.skipUpsell !== true) {
      useUpsellStore.getState().show();
    }
  },
});

export const queryClient = createQueryClient({ mutationCache });
export const queryPersister = createMmkvPersister({ mmkv });
