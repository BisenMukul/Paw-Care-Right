import { z } from "zod";

import { checkStatusSchema } from "./check-status";
import { triageResultSchema } from "./triage";

/**
 * CheckResponse — the client-visible symptom-check resource shape (T047 plan
 * D2). Mirrors `apps/api/src/checks/checks.service.ts`'s `CheckResponse`
 * field-for-field (T042's D4 kept that interface service-local; this is the
 * single Zod source of truth the mobile client consumes, per CLAUDE §6 — no
 * hand-written duplicate interface). `createdAt` is the JSON-serialized ISO
 * string (the server's `Date` becomes a string over the wire); unused by
 * T047 but included for T048. No runtime `.parse()` of the GET response
 * happens in T047 (D3) — the hooks type via `apiClient.get<CheckResponse>`.
 */

export const checkRedFlagSchema = z.object({
  ruleId: z.string(),
  payloadKey: z.string(),
});
export type CheckRedFlag = z.infer<typeof checkRedFlagSchema>;

export const checkResponseSchema = z.object({
  id: z.string(),
  status: checkStatusSchema,
  category: z.string(),
  createdAt: z.string(),
  redFlag: checkRedFlagSchema.optional(),
  result: triageResultSchema.optional(),
});
export type CheckResponse = z.infer<typeof checkResponseSchema>;
