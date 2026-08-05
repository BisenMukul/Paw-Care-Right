import { z } from "zod";

/**
 * T117 step 13: `/v1/meta/client-versions` (admin-read) response contract
 * (docs/OTA_UPDATES.md §7). Aggregates the `Device` table's `appVersion`/
 * `otaUpdateId` columns per day, per D5's honestly-scoped freshness
 * limitation: a device's reported pair is "as of its last push
 * registration" (JIT, not per-launch), so PostHog `ota_applied` remains the
 * authoritative adoption curve -- this endpoint is a coarse cross-check
 * over push-registered devices only.
 */
export const clientVersionRowSchema = z
  .object({
    day: z.string(),
    appVersion: z.string().nullable(),
    updateId: z.string().nullable(),
    deviceCount: z.number().int().nonnegative(),
  })
  .strict();
export type ClientVersionRow = z.infer<typeof clientVersionRowSchema>;

export const clientVersionsResponseSchema = z
  .object({
    days: z.number().int().positive(),
    generatedAt: z.string(),
    rows: z.array(clientVersionRowSchema),
  })
  .strict();
export type ClientVersionsResponse = z.infer<typeof clientVersionsResponseSchema>;
