import { createMMKV } from "react-native-mmkv";
import { createQueryClient } from "@pawcareright/api-client";
import { createMmkvPersister } from "@pawcareright/api-client/mmkv-persister";

// Singleton TanStack Query client + MMKV-backed persister (offline base,
// T019). Imported ONLY by the root layout (`app/_layout.tsx`) so no other
// module transitively pulls in the native `react-native-mmkv` binding.
export const queryClient = createQueryClient();
export const mmkv = createMMKV();
export const queryPersister = createMmkvPersister({ mmkv });
