import { z } from "zod";

import { slugSchema } from "../breeds/schema";

export const emergencyPayloadSchema = z.strictObject({
  key: slugSchema, // kebab; equals a rules-table emergencyPayloadKey
  title: z.string().min(1).max(120), // urgent, go-now framing
  detected: z.string().min(1).max(300), // neutral "what you told us" — no diagnosis wording
  guidance: z.string().min(1).max(600), // go-now actions — never "wait", no dosing
});
export type EmergencyPayload = z.infer<typeof emergencyPayloadSchema>;
