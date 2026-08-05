import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import { createSafeStorage } from "../storage/safe-storage";

/**
 * Persisted reminder-completion outbox (T094 plan D1 — a small zustand-
 * persisted store, NOT TanStack Query mutation persistence; see the plan's
 * D1 for the rejected alternative and why). Mirrors `active-pet-store.ts`'s
 * shape exactly: same `createSafeStorage` lazy-require + JUSTIFIED comment,
 * same `createJSONStorage(() => mmkvStorage)`. No new dependency.
 */

export interface OutboxCompletion {
  /** `${reminderId}:${dueAt}` — the SAME merge key the api upserts on
   * (`ReminderEvent.reminderId_dueAt`) and the same key `patchEntryStatus`
   * matches on. Dedupes double-taps at enqueue time. */
  id: string;
  reminderId: string;
  dueAt: string; // ISO, exactly the string the agenda entry carries
  queuedAt: string; // ISO
  attempts: number;
}

export interface OutboxState {
  items: OutboxCompletion[];
  /** No-op when an item with the same `id` is already queued (duplicate completion, offline double-tap). */
  enqueue(vars: { reminderId: string; dueAt: string }): void;
  remove(id: string): void;
  markAttempt(id: string): void;
  clear(): void;
}

/** Bounded retry (T094 plan D7 — arbitrary bound, stated so it can be challenged). */
export const MAX_OUTBOX_ATTEMPTS = 5;

function buildId(reminderId: string, dueAt: string): string {
  return `${reminderId}:${dueAt}`;
}

// A dedicated persisted store for the reminder-completion outbox. The
// storage layer falls back to memory when the native MMKV binding is
// unavailable (mirrors every other persisted store in this app).
const mmkv = createSafeStorage({
  createMmkv: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: lazy runtime require so a missing native MMKV binding (Expo Go) falls back instead of crashing at module load
    const { createMMKV } = require("react-native-mmkv");
    return createMMKV();
  },
});
const mmkvStorage: StateStorage = {
  getItem: (name) => mmkv.getString(name) ?? null,
  setItem: (name, value) => {
    mmkv.set(name, value);
  },
  removeItem: (name) => {
    mmkv.remove(name);
  },
};

export const useOutboxStore = create<OutboxState>()(
  persist(
    (set, get) => ({
      items: [],

      enqueue(vars) {
        const id = buildId(vars.reminderId, vars.dueAt);
        if (get().items.some((item) => item.id === id)) {
          return;
        }
        const entry: OutboxCompletion = {
          id,
          reminderId: vars.reminderId,
          dueAt: vars.dueAt,
          queuedAt: new Date().toISOString(),
          attempts: 0,
        };
        set((state) => ({ items: [...state.items, entry] }));
      },

      remove(id) {
        set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
      },

      markAttempt(id) {
        set((state) => ({
          items: state.items.map((item) => (item.id === id ? { ...item, attempts: item.attempts + 1 } : item)),
        }));
      },

      clear() {
        set({ items: [] });
      },
    }),
    {
      name: "bombaypetcompany.reminder-outbox",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
