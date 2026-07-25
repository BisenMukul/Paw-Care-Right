import { z } from "zod";

/**
 * Account privacy: consent, export & deletion (T091 plan D2/D4/D6).
 *
 * `ACCOUNT_DELETION_GRACE_DAYS` is a FRESH decision (the shipped T086 policy
 * pins no figure) — flagged for C3 counsel review (plan R2). It is a single
 * exported constant so api/mobile/web all read the same number; the web
 * legal copy MUST import it rather than hardcoding "30" (plan step 41).
 */
export const ACCOUNT_DELETION_GRACE_DAYS = 30;

/** D6: the same daily sweep that hard-deletes due accounts purges `AccountExport` rows/objects older than this. */
export const ACCOUNT_EXPORT_RETENTION_DAYS = 7;

/** 7d — S3 presign maximum; also the export bundle's own on-disk lifetime (D6). */
export const EXPORT_LINK_TTL_SECONDS = 604_800;

export const accountPrivacySettingsSchema = z
  .object({
    analyticsOptOut: z.boolean(),
    deletionScheduledAt: z.string().datetime().nullable(),
  })
  .strict();
export type AccountPrivacySettings = z.infer<typeof accountPrivacySettingsSchema>;

export const updateAccountPrivacySettingsSchema = z.object({ analyticsOptOut: z.boolean() }).strict();
export type UpdateAccountPrivacySettingsInput = z.infer<typeof updateAccountPrivacySettingsSchema>;

export const ACCOUNT_EXPORT_STATUSES = ["PENDING", "DONE", "FAILED"] as const;
export const accountExportStatusSchema = z.enum(ACCOUNT_EXPORT_STATUSES);
export type AccountExportStatus = z.infer<typeof accountExportStatusSchema>;

export const accountExportRequestSchema = z
  .object({
    exportId: z.string().uuid(),
    status: accountExportStatusSchema,
    requestedAt: z.string().datetime(),
  })
  .strict();
export type AccountExportRequest = z.infer<typeof accountExportRequestSchema>;

export const accountDeletionStatusSchema = z
  .object({
    deletionScheduledAt: z.string().datetime().nullable(),
  })
  .strict();
export type AccountDeletionStatus = z.infer<typeof accountDeletionStatusSchema>;
