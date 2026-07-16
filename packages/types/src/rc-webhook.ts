import { z } from "zod";

/**
 * RevenueCat webhook payload subset (T073 plan). Only the fields the
 * backend actually consumes are validated; `.passthrough()` on both
 * schemas preserves every other RC field so the controller can persist
 * the *entire* raw body in `Subscription.rawEventJson` (plan decision 9)
 * without a class-validator DTO stripping anything. No runtime DB/Nest
 * imports here -- this module is portable (web/mobile could import it).
 */
export const rcWebhookEventSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    app_user_id: z.string().optional(),
    product_id: z.string().nullish(),
    expiration_at_ms: z.number().nullish(),
    purchased_at_ms: z.number().nullish(),
    event_timestamp_ms: z.number().nullish(),
    environment: z.string().optional(),
    store: z.string().optional(),
    // T078: RC's trial-vs-paid marker on a subscription lifecycle event.
    // `.passthrough()` already retained this field on any raw payload; this
    // typing lets `rc-webhook.service.ts` read it to detect `trial_start`.
    period_type: z.string().nullish(),
  })
  .passthrough();
export type RcWebhookEvent = z.infer<typeof rcWebhookEventSchema>;

export const rcWebhookEnvelopeSchema = z
  .object({
    event: rcWebhookEventSchema,
    api_version: z.string().optional(),
  })
  .passthrough();
export type RcWebhookEnvelope = z.infer<typeof rcWebhookEnvelopeSchema>;

/** The six RC event types the state machine (T073) understands. */
export const RC_WEBHOOK_EVENT_TYPES = {
  INITIAL_PURCHASE: "INITIAL_PURCHASE",
  RENEWAL: "RENEWAL",
  CANCELLATION: "CANCELLATION",
  EXPIRATION: "EXPIRATION",
  BILLING_ISSUE: "BILLING_ISSUE",
  PRODUCT_CHANGE: "PRODUCT_CHANGE",
} as const;
export type RcWebhookEventType = (typeof RC_WEBHOOK_EVENT_TYPES)[keyof typeof RC_WEBHOOK_EVENT_TYPES];
