import { RC_WEBHOOK_EVENT_TYPES, type RcWebhookEvent } from "@pawcareright/types";

/**
 * Audit-only status strings persisted on `Subscription.status` (T073 plan
 * decision 4). Entitlement resolution (T072) never reads `status` -- it is
 * for traceability/support only.
 */
export const RC_WEBHOOK_STATUS = {
  ACTIVE: "active",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  BILLING_ISSUE: "billing_issue",
} as const;
export type RcWebhookStatus = (typeof RC_WEBHOOK_STATUS)[keyof typeof RC_WEBHOOK_STATUS];

/**
 * Plan decision 4 fallback chain for the event's ordering clock: RC's own
 * `event_timestamp_ms`, falling back to `purchased_at_ms`, falling back to
 * "received now" for events that carry neither.
 */
export function resolveEventTimestampMs(event: RcWebhookEvent, receivedNowMs: number): number {
  return event.event_timestamp_ms ?? event.purchased_at_ms ?? receivedNowMs;
}

function expiresAtFromEvent(event: RcWebhookEvent): Date | null {
  return event.expiration_at_ms == null ? null : new Date(event.expiration_at_ms);
}

interface ExistingSubscriptionClock {
  lastEventAt: Date | null;
}

export type ComputeResult =
  | {
      action: "upsert";
      data: {
        entitlement: "FREE" | "PREMIUM";
        plan: string | null;
        status: string;
        expiresAt: Date | null;
        lastEventAt: Date;
      };
    }
  | { action: "skip"; reason: "unknown_type" | "stale" };

/**
 * Pure, prisma-free core state machine (T073 plan decision 4). Given the
 * incoming event, the existing row's ordering clock (or `null` for a
 * first-ever event), and the received-at clock (for events with neither RC
 * timestamp), decides whether to upsert a new `Subscription` state or skip.
 *
 * The staleness gate runs FIRST: an event whose ordering timestamp is
 * strictly older than the stored `lastEventAt` is skipped outright (even
 * for an otherwise-unknown type) -- a late RENEWAL can never resurrect a
 * more-recent EXPIRATION, and a stale CANCELLATION can never override a
 * newer RENEWAL. Equal timestamps are NOT "strictly older" and are applied
 * in arrival order (documented risk R2 -- astronomically rare, and dedupe
 * already covers true replays).
 */
export function computeSubscriptionUpdate(
  event: RcWebhookEvent,
  existing: ExistingSubscriptionClock | null,
  receivedNow: Date,
): ComputeResult {
  const eventTsMs = resolveEventTimestampMs(event, receivedNow.getTime());
  const lastEventAt = existing?.lastEventAt ?? null;

  if (lastEventAt !== null && eventTsMs < lastEventAt.getTime()) {
    return { action: "skip", reason: "stale" };
  }

  const expiresAt = expiresAtFromEvent(event);
  const plan = event.product_id ?? null;
  const lastEventAtDate = new Date(eventTsMs);

  switch (event.type) {
    case RC_WEBHOOK_EVENT_TYPES.INITIAL_PURCHASE:
    case RC_WEBHOOK_EVENT_TYPES.RENEWAL:
    case RC_WEBHOOK_EVENT_TYPES.PRODUCT_CHANGE:
      return {
        action: "upsert",
        data: { entitlement: "PREMIUM", plan, status: RC_WEBHOOK_STATUS.ACTIVE, expiresAt, lastEventAt: lastEventAtDate },
      };
    case RC_WEBHOOK_EVENT_TYPES.CANCELLATION:
      return {
        action: "upsert",
        data: {
          entitlement: "PREMIUM",
          plan,
          status: RC_WEBHOOK_STATUS.CANCELLED,
          expiresAt,
          lastEventAt: lastEventAtDate,
        },
      };
    case RC_WEBHOOK_EVENT_TYPES.BILLING_ISSUE:
      return {
        action: "upsert",
        data: {
          entitlement: "PREMIUM",
          plan,
          status: RC_WEBHOOK_STATUS.BILLING_ISSUE,
          expiresAt,
          lastEventAt: lastEventAtDate,
        },
      };
    case RC_WEBHOOK_EVENT_TYPES.EXPIRATION:
      return {
        action: "upsert",
        data: { entitlement: "FREE", plan, status: RC_WEBHOOK_STATUS.EXPIRED, expiresAt, lastEventAt: lastEventAtDate },
      };
    default:
      return { action: "skip", reason: "unknown_type" };
  }
}
