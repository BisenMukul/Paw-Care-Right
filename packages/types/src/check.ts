import { z } from "zod";

import { checkStatusSchema } from "./check-status";
import { triageResultSchema, urgencySchema } from "./triage";

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

/**
 * Follow-up loop (T051 plan "Interfaces / contracts the executor must
 * match"). Wire values are the lowercase `better|same|worse` strings; the
 * `escalatedTier` is only ever present when `response === "worse"` (set by
 * the API's `raiseUrgency`, never authored/lowered client-side).
 */
export const FOLLOW_UP_RESPONSES = ["better", "same", "worse"] as const;
export const followUpResponseSchema = z.enum(FOLLOW_UP_RESPONSES);
export type FollowUpResponse = z.infer<typeof followUpResponseSchema>;

export const followUpSchema = z.object({
  response: followUpResponseSchema,
  escalatedTier: urgencySchema.optional(),
});
export type FollowUp = z.infer<typeof followUpSchema>;

export const checkResponseSchema = z.object({
  id: z.string(),
  status: checkStatusSchema,
  category: z.string(),
  createdAt: z.string(),
  redFlag: checkRedFlagSchema.optional(),
  result: triageResultSchema.optional(),
  followUp: followUpSchema.optional(),
});
export type CheckResponse = z.infer<typeof checkResponseSchema>;
