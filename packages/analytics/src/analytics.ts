import type { AnalyticsEventMap, AnalyticsEventName } from "./events";

/** The payload shape handed to a transport -- vendor-agnostic (plan decision 1/2). */
export interface CapturePayload {
  distinctId: string;
  event: AnalyticsEventName;
  properties: Record<string, unknown>;
}

/** A transport sends a capture payload; it never throws synchronously (plan decision 5). */
export interface AnalyticsTransport {
  send(payload: CapturePayload): void;
}

export interface Analytics {
  /**
   * Emits `event` for `distinctId` with `properties` typed exactly to
   * `AnalyticsEventMap[E]` -- an unknown `event` name or mismatched
   * `properties` shape is a compile error (plan decision 3).
   */
  capture<E extends AnalyticsEventName>(distinctId: string, event: E, properties: AnalyticsEventMap[E]): void;
}

export interface CreateAnalyticsOptions {
  transport: AnalyticsTransport;
  /**
   * Consent gate (plan decision 4): when this returns `false`, `capture` is
   * a no-op. Omitted or returning `true` means "enabled" -- the default
   * consent posture is ON.
   */
  isEnabled?: () => boolean;
}

/**
 * Builds an `Analytics` emitter over a transport, with an optional consent
 * gate. `isEnabled` is consulted synchronously on every `capture` call so a
 * runtime toggle (e.g. the mobile settings switch) takes effect immediately.
 */
export function createAnalytics(opts: CreateAnalyticsOptions): Analytics {
  return {
    capture<E extends AnalyticsEventName>(distinctId: string, event: E, properties: AnalyticsEventMap[E]): void {
      if (opts.isEnabled?.() === false) {
        return;
      }
      opts.transport.send({ distinctId, event, properties });
    },
  };
}
