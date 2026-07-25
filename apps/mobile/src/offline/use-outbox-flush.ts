import { useIsOffline } from "@pawcareright/api-client";
import { useEffect, useRef } from "react";

import { flushOutbox } from "./flush-outbox";

/**
 * Root-mounted hook (T094 plan step 3.3): flushes the reminder-completion
 * outbox on mount-if-online (cold start with pending items) AND on every
 * offline->online transition (reconnect). No timers, no polling.
 */
export function useOutboxFlush(): void {
  const isOffline = useIsOffline();
  const wasOfflineRef = useRef(true);

  useEffect(() => {
    if (!isOffline && wasOfflineRef.current) {
      void flushOutbox();
    }
    wasOfflineRef.current = isOffline;
  }, [isOffline]);
}
