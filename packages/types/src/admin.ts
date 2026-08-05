import { z } from "zod";

import { billingEntitlementSchema } from "./entitlement";

/**
 * T111: `/v1/admin/*` read-only mini-dashboard response contracts.
 *
 * (a) MRR limitation (plan R1 -- the load-bearing finding): `RcWebhookService.
 * handle` (T073) persists NO amount, NO currency and NO event type -- only
 * `ProcessedWebhookEvent{eventId, processedAt}` (a dedupe ledger) and the
 * `Subscription` mirror row (`lastEventAt`, last `rawEventJson` only). The
 * "MRR events" card in the task text is therefore honestly served as EVENT
 * COUNTS (`billingEventsProcessed`, `subscriptionsUpdated`) -- NEVER a
 * revenue/currency figure. Any future revenue number requires a new
 * billing-event ledger (a write path) added to T072/T073, which is out of
 * scope for a strictly-read-only card.
 *
 * (b) Codes-only invariant: `adminAuditRowSchema` mirrors `AiAuditLog`'s
 * exact 11 columns (schema.prisma: "NO CONTENT COLUMNS, EVER") -- ids,
 * enum codes, versions and counts only. `.strict()` on every schema here
 * means an accidental extra key (e.g. a future content column) fails
 * parsing loudly instead of silently riding along to the client.
 */

export const adminKpiDaySchema = z
  .object({
    day: z.string(),
    devicesCreated: z.number().int().nonnegative(),
    checksCreated: z.number().int().nonnegative(),
    checksDone: z.number().int().nonnegative(),
    checksFallback: z.number().int().nonnegative(),
    // null (never a fake 0%) when checksDone + checksFallback === 0 for the day.
    fallbackRate: z.number().min(0).max(1).nullable(),
    billingEventsProcessed: z.number().int().nonnegative(),
    subscriptionsUpdated: z.number().int().nonnegative(),
  })
  .strict();
export type AdminKpiDay = z.infer<typeof adminKpiDaySchema>;

/**
 * A point-in-time snapshot of the RC-mirror `Subscription` table plus active
 * `ReferralGrant` count -- NOT the same thing as any one user's effective
 * `pickEntitlement` outcome (household/grant-aware). See R3.
 */
export const adminTierSnapshotSchema = z
  .object({
    totalUsers: z.number().int().nonnegative(),
    premiumSubscriptions: z.number().int().nonnegative(),
    expiredOrInactiveSubscriptions: z.number().int().nonnegative(),
    activeReferralGrants: z.number().int().nonnegative(),
  })
  .strict();
export type AdminTierSnapshot = z.infer<typeof adminTierSnapshotSchema>;

export const adminKpisResponseSchema = z
  .object({
    days: z.number().int().positive(),
    generatedAt: z.string(),
    daily: z.array(adminKpiDaySchema),
    tiers: adminTierSnapshotSchema,
  })
  .strict();
export type AdminKpisResponse = z.infer<typeof adminKpisResponseSchema>;

/** D4: ids/codes/counts only -- never pet names, symptom/intake text, chat content, photo keys, tokens. */
export const adminUserCountersSchema = z
  .object({
    pets: z.number().int().nonnegative(),
    symptomChecksTotal: z.number().int().nonnegative(),
    symptomChecksFallback: z.number().int().nonnegative(),
    chatThreads: z.number().int().nonnegative(),
    chatMessages: z.number().int().nonnegative(),
    reminders: z.number().int().nonnegative(),
    healthLogs: z.number().int().nonnegative(),
    devices: z.number().int().nonnegative(),
    feedbackReports: z.number().int().nonnegative(),
    accountExports: z.number().int().nonnegative(),
    referralGrantsActive: z.number().int().nonnegative(),
  })
  .strict();
export type AdminUserCounters = z.infer<typeof adminUserCountersSchema>;

export const adminUserSummarySchema = z
  .object({
    userId: z.string(),
    email: z.string(),
    createdAt: z.string(),
    locale: z.string(),
    region: z.string(),
    analyticsOptOut: z.boolean(),
    deletionScheduledAt: z.string().nullable(),
    householdIds: z.array(z.string()),
    // Reused verbatim from `BillingService.getEntitlement` (T072, read-only).
    entitlement: billingEntitlementSchema,
    counters: adminUserCountersSchema,
  })
  .strict();
export type AdminUserSummary = z.infer<typeof adminUserSummarySchema>;

/**
 * Exactly the 11 `AiAuditLog` columns (schema.prisma T090 comment: "NO
 * CONTENT COLUMNS, EVER"). `.strict()` makes an extra key a hard failure --
 * the non-vacuity proof in `admin.spec.ts` plants exactly that.
 */
export const adminAuditRowSchema = z
  .object({
    id: z.string(),
    surface: z.enum(["CHECK", "CHAT"]),
    checkId: z.string().nullable(),
    threadId: z.string().nullable(),
    promptVersion: z.string(),
    modelId: z.string(),
    detectorFlags: z.array(z.string()),
    costMicroUsd: z.number().int().nonnegative(),
    latencyMs: z.number().int().nonnegative().nullable(),
    status: z.enum(["OK", "SAFE_FALLBACK"]),
    createdAt: z.string(),
  })
  .strict();
export type AdminAuditRow = z.infer<typeof adminAuditRowSchema>;

export const adminAuditPageSchema = z
  .object({
    rows: z.array(adminAuditRowSchema),
    nextCursor: z.string().nullable(),
  })
  .strict();
export type AdminAuditPage = z.infer<typeof adminAuditPageSchema>;
