import { ApiError, getIsOfflineSnapshot, isApiError } from "@pawcareright/api-client";
import type { AgendaEntry } from "@pawcareright/types";

import { apiClient } from "../api/client";
import { agendaKeys } from "../api/agenda-api";
import { queryClient } from "../api/query";
import { MAX_OUTBOX_ATTEMPTS, useOutboxStore, type OutboxCompletion } from "./outbox-store";

/**
 * Reconnect flush for the reminder-completion outbox (T094 plan step 3.2).
 * Iterates a snapshot of `items` SEQUENTIALLY (never `Promise.all` — keeps
 * the client's single-flighted 401 refresh sane and preserves user order).
 */

export interface FlushOutboxResult {
  synced: number;
  dropped: number;
  remaining: number;
}

/** A second concurrent call returns the SAME promise (a reconnect flap must not double-flush). */
let inFlight: Promise<FlushOutboxResult> | null = null;

/** 4xx (except 401/408/429) -- terminal: the reminder is gone, or the occurrence is stale. Retrying can never succeed. */
function isTerminalDrop(error: ApiError): boolean {
  const status = error.httpStatus;
  return status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429;
}

/** 408/429/5xx/0 (transport) -- transient: try again next reconnect, up to MAX_OUTBOX_ATTEMPTS. */
function isTransient(error: ApiError): boolean {
  const status = error.httpStatus;
  return status === 408 || status === 429 || status >= 500 || status === 0;
}

async function flushSequentially(items: OutboxCompletion[]): Promise<FlushOutboxResult> {
  const store = useOutboxStore.getState();
  let synced = 0;
  let dropped = 0;

  for (const item of items) {
    try {
      await apiClient.post<AgendaEntry>(`/v1/reminders/${item.reminderId}/complete`, { dueAt: item.dueAt });
      store.remove(item.id);
      synced += 1;
      continue;
    } catch (err) {
      if (isApiError(err)) {
        if (err.httpStatus === 401) {
          // The api client already ran its single-flighted refresh and, on
          // failure, called `onSessionExpired()`. Spinning here would
          // hammer a dead session -- STOP the loop, keep every remaining
          // item (including this one) for the next flush after re-auth.
          break;
        }
        if (isTerminalDrop(err)) {
          // The reminder was deleted server-side (404) or the `dueAt` is no
          // longer an occurrence (400/409/410/422/403) -- retrying can
          // never succeed.
          store.remove(item.id);
          dropped += 1;
          continue;
        }
        if (isTransient(err)) {
          store.markAttempt(item.id);
          if (item.attempts + 1 >= MAX_OUTBOX_ATTEMPTS) {
            store.remove(item.id);
            dropped += 1;
            continue;
          }
          break;
        }
        // Any other ApiError shape: treat as transient (defensive; matches
        // `classifyError`'s house fallback elsewhere in this app).
        store.markAttempt(item.id);
        if (item.attempts + 1 >= MAX_OUTBOX_ATTEMPTS) {
          store.remove(item.id);
          dropped += 1;
          continue;
        }
        break;
      }
      // A non-ApiError throw: treat as the transient row above.
      store.markAttempt(item.id);
      if (item.attempts + 1 >= MAX_OUTBOX_ATTEMPTS) {
        store.remove(item.id);
        dropped += 1;
        continue;
      }
      break;
    }
  }

  return { synced, dropped, remaining: useOutboxStore.getState().items.length };
}

export function flushOutbox(): Promise<FlushOutboxResult> {
  if (inFlight !== null) {
    return inFlight;
  }

  if (getIsOfflineSnapshot()) {
    return Promise.resolve({ synced: 0, dropped: 0, remaining: useOutboxStore.getState().items.length });
  }

  const snapshot = [...useOutboxStore.getState().items];

  inFlight = flushSequentially(snapshot)
    .then((result) => {
      // Fail-upward half of the design: if anything synced OR dropped, the
      // agenda must re-read server truth so a dropped (stale) completion
      // can never leave a false "DONE" tick on screen.
      if (result.synced + result.dropped > 0) {
        void queryClient.invalidateQueries({ queryKey: agendaKeys.all });
      }
      return result;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
