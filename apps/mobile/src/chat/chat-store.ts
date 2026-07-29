import type { SymptomCategory } from "@bombaypetcompany/types";
import { create } from "zustand";

/**
 * Non-persisted, per-pet chat state (T083 plan decision D5): ONE thread per
 * pet per app session, created lazily on first send. NON-persisted
 * (mirrors `premium-store.ts`) so a cold start begins a clean thread and no
 * assistant text is ever written to device storage — T081 shipped no
 * thread-list/message-history endpoint, so there is nothing to replay
 * anyway. Switching the active pet switches to that pet's thread/transcript
 * (keyed by `petId` throughout), creating a fresh one on next send.
 */

export type ChatMessageStatusUi = "streaming" | "ok" | "safeFallback";

export interface ChatUiMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Assistant-only. */
  status?: ChatMessageStatusUi;
  /** Assistant-only, set from a `nudge` frame. Renders the nudge card ABOVE this bubble. */
  nudgeCategory?: SymptomCategory;
}

export interface ChatState {
  threadIdByPetId: Record<string, string>;
  messagesByPetId: Record<string, ChatUiMessage[]>;
  setThreadId(petId: string, threadId: string): void;
  appendMessage(petId: string, message: ChatUiMessage): void;
  patchMessage(petId: string, id: string, patch: Partial<ChatUiMessage>): void;
  /** Used to drop a dropped/failed assistant bubble (it is not a truthful record of a completed answer). */
  removeMessage(petId: string, id: string): void;
  reset(petId: string): void;
}

export const useChatStore = create<ChatState>()((set) => ({
  threadIdByPetId: {},
  messagesByPetId: {},

  setThreadId(petId, threadId) {
    set((state) => ({ threadIdByPetId: { ...state.threadIdByPetId, [petId]: threadId } }));
  },

  appendMessage(petId, message) {
    set((state) => ({
      messagesByPetId: {
        ...state.messagesByPetId,
        [petId]: [...(state.messagesByPetId[petId] ?? []), message],
      },
    }));
  },

  patchMessage(petId, id, patch) {
    set((state) => ({
      messagesByPetId: {
        ...state.messagesByPetId,
        [petId]: (state.messagesByPetId[petId] ?? []).map((message) =>
          message.id === id ? { ...message, ...patch } : message,
        ),
      },
    }));
  },

  removeMessage(petId, id) {
    set((state) => ({
      messagesByPetId: {
        ...state.messagesByPetId,
        [petId]: (state.messagesByPetId[petId] ?? []).filter((message) => message.id !== id),
      },
    }));
  },

  reset(petId) {
    set((state) => ({ messagesByPetId: { ...state.messagesByPetId, [petId]: [] } }));
  },
}));
