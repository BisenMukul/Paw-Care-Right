import { isApiError, useIsOffline } from "@pawcareright/api-client";
import type { ChatThread } from "@pawcareright/types";
import * as Crypto from "expo-crypto";
import { useCallback, useRef, useState } from "react";

import { apiClient } from "../api/client";
import { parseChatFrame } from "./chat-events";
import { useChatStore, type ChatUiMessage } from "./chat-store";

/**
 * Send/stream orchestration hook (T083 plan). Offline guard blocks the send
 * entirely (no network call — mirrors `useCheckSubmission`'s offline
 * pattern); thread creation is lazy and reused for the pet's whole session
 * (D5/D6); every frame is classified through `parseChatFrame` (D4); two
 * DISTINCT terminal failure states are modelled and never merged
 * (D7/Safety statement 3): `dropped` (transport failure — retry offered)
 * vs. `safeFallback` (a real server safety decision — NO retry). `retry()`
 * re-sends only the last user message, on the SAME thread, and is a no-op
 * outside `dropped`/`error`.
 */

export type ChatStreamState =
  | "idle"
  | "sending"
  | "streaming"
  | "dropped" // transport ended without `done` -> RETRY OFFERED
  | "safeFallback" // done.status === "SAFE_FALLBACK" -> NO RETRY (safety, D7)
  | "error" // non-402 ApiError before/around the stream -> RETRY OFFERED
  | "blocked402" // premium lock or fair-use quota -> NO RETRY (D8)
  | "offline"; // send blocked, never attempted

export interface UseChatStream {
  state: ChatStreamState;
  messages: ChatUiMessage[];
  send: (text: string) => void;
  /** No-op unless state is "dropped" or "error". Re-sends the last USER message text. */
  retry: () => void;
  /**
   * Clears a terminal `blocked402` lock back to `idle` (FINDING-3: the
   * screen calls this exactly when `premiumStatus` transitions from
   * non-entitled to entitled while blocked -- i.e. right after a successful
   * purchase clears the FEATURE-LOCK case). No-op in every other state,
   * including the FAIR-USE QUOTA case (the user was already entitled when
   * quota-blocked, so that lock legitimately persists until next month).
   */
  reset: () => void;
}

/**
 * Classifies a rejection from `apiClient.streamSse` (or thread creation).
 * `streamSseRequest` NEVER throws anything but an `ApiError` (non-2xx ⇒
 * `normalizeError`, transport failure/mid-body throw ⇒
 * `normalizeNetworkError`, `httpStatus: 0`) — so `httpStatus === 0` is
 * exactly "never completed an HTTP round trip" (a transport DROP), and any
 * other status is a real server response that arrived before/around the
 * stream (a pre-stream API `error`, per D7).
 */
function classifyError(err: unknown): ChatStreamState {
  if (isApiError(err)) {
    if (err.code === "PAYMENT_REQUIRED") {
      return "blocked402";
    }
    if (err.httpStatus === 0) {
      return "dropped";
    }
    return "error";
  }
  return "dropped";
}

async function ensureThreadId(petId: string): Promise<string> {
  const existing = useChatStore.getState().threadIdByPetId[petId];
  if (existing !== undefined) {
    return existing;
  }
  const thread = await apiClient.post<ChatThread>("/v1/chat/threads", { petId });
  useChatStore.getState().setThreadId(petId, thread.id);
  return thread.id;
}

/**
 * Runs one streamed assistant reply. `invalid` frames THROW (fail upward,
 * D4) — the throw propagates out of `streamSseRequest`'s frame-dispatch
 * loop, stopping ALL further frame consumption immediately (no later frame,
 * in this chunk or any subsequent one, is ever rendered) and is normalized
 * to a transport-shaped `ApiError` (`httpStatus: 0`), which `classifyError`
 * maps to `dropped` — matching "invalid -> abort, treat as dropped"
 * exactly (D7/M9).
 */
function runStream(
  text: string,
  petId: string,
  threadId: string,
  assistantId: string,
  setState: (state: ChatStreamState) => void,
): Promise<void> {
  let assistantText = "";
  let sawDone = false;

  return apiClient
    .streamSse(
      `/v1/chat/threads/${threadId}/messages`,
      { content: text },
      {
        onFrame: (frame) => {
          const event = parseChatFrame(frame);
          const { patchMessage } = useChatStore.getState();

          switch (event.kind) {
            case "start":
              setState("streaming");
              break;
            case "nudge":
              patchMessage(petId, assistantId, { nudgeCategory: event.value.category });
              break;
            case "chunk":
              assistantText += event.value.text;
              patchMessage(petId, assistantId, { text: assistantText });
              break;
            case "done":
              sawDone = true;
              patchMessage(petId, assistantId, {
                status: event.value.status === "SAFE_FALLBACK" ? "safeFallback" : "ok",
              });
              setState(event.value.status === "SAFE_FALLBACK" ? "safeFallback" : "idle");
              break;
            case "invalid":
              throw new Error(`chat: invalid "${event.event}" frame`);
            case "unknown":
              break;
          }
        },
      },
    )
    .then(() => {
      if (!sawDone) {
        useChatStore.getState().removeMessage(petId, assistantId);
        setState("dropped");
      }
    })
    .catch((err: unknown) => {
      // A `done` frame is a TERMINAL, already-applied outcome (the message's
      // status and the hook's state were already set inside `onFrame`,
      // above). A transport error arriving AFTER it (e.g. the byte source
      // failing between the `done` chunk and EOF, or a `flush()`-phase
      // throw) must be a no-op here -- otherwise a completed `SAFE_FALLBACK`
      // answer would be demoted to the retryable `dropped` state (deleting
      // the safe-fallback notice and rendering a Retry button for a safety
      // decision the server already made — CLAUDE §7 rule 5 / D7 / Safety
      // statement 3), and a completed `OK` answer would be erased with a
      // retry that re-sends and double-charges quota for an already
      // persisted message.
      if (sawDone) {
        return;
      }
      useChatStore.getState().removeMessage(petId, assistantId);
      setState(classifyError(err));
    });
}

// Stable reference (NOT a fresh `[]` per selector call) — `useSyncExternalStore`
// (which zustand's hook is built on) requires a cached snapshot; returning a
// new array identity every render is an infinite-loop footgun.
const EMPTY_MESSAGES: ChatUiMessage[] = [];

export function useChatStream(petId: string | undefined): UseChatStream {
  const isOffline = useIsOffline();
  const [state, setState] = useState<ChatStreamState>("idle");
  const messages = useChatStore((chatState) =>
    petId !== undefined ? (chatState.messagesByPetId[petId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES,
  );

  const lastUserTextRef = useRef<string | null>(null);
  const assistantIdRef = useRef<string | null>(null);

  const send = useCallback(
    (text: string) => {
      if (petId === undefined) {
        return;
      }
      if (isOffline) {
        setState("offline");
        return;
      }

      const resolvedPetId = petId;
      lastUserTextRef.current = text;
      useChatStore.getState().appendMessage(resolvedPetId, { id: Crypto.randomUUID(), role: "user", text });
      setState("sending");

      void ensureThreadId(resolvedPetId)
        .then((resolvedThreadId) => {
          const assistantId = Crypto.randomUUID();
          assistantIdRef.current = assistantId;
          useChatStore
            .getState()
            .appendMessage(resolvedPetId, { id: assistantId, role: "assistant", text: "", status: "streaming" });
          return runStream(text, resolvedPetId, resolvedThreadId, assistantId, setState);
        })
        .catch((err: unknown) => {
          setState(classifyError(err));
        });
    },
    [petId, isOffline],
  );

  const retry = useCallback(() => {
    if (petId === undefined || (state !== "dropped" && state !== "error")) {
      return;
    }
    const text = lastUserTextRef.current;
    if (text === null) {
      return;
    }

    const resolvedPetId = petId;
    if (assistantIdRef.current !== null) {
      // Idempotent -- the failed bubble was already removed when the drop/error occurred.
      useChatStore.getState().removeMessage(resolvedPetId, assistantIdRef.current);
    }
    setState("sending");

    const existingThreadId = useChatStore.getState().threadIdByPetId[resolvedPetId];
    const threadIdPromise = existingThreadId !== undefined ? Promise.resolve(existingThreadId) : ensureThreadId(resolvedPetId);

    void threadIdPromise
      .then((resolvedThreadId) => {
        const assistantId = Crypto.randomUUID();
        assistantIdRef.current = assistantId;
        useChatStore
          .getState()
          .appendMessage(resolvedPetId, { id: assistantId, role: "assistant", text: "", status: "streaming" });
        return runStream(text, resolvedPetId, resolvedThreadId, assistantId, setState);
      })
      .catch((err: unknown) => {
        setState(classifyError(err));
      });
  }, [petId, state]);

  const reset = useCallback(() => {
    setState((current) => (current === "blocked402" ? "idle" : current));
  }, []);

  return { state, messages, send, retry, reset };
}
