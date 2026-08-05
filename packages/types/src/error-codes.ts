import { z } from "zod";

export const errorCodeSchema = z.enum([
  "VALIDATION_FAILED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "PAYMENT_REQUIRED",
  "INTERNAL",
  "FEATURE_DISABLED",
  // T106 checker F1 fix: 503 is not exclusively a feature kill switch (e.g.
  // health.service.ts's dependency-outage 503) — this is the generic
  // fallback for a bare 503 with no explicit code.
  "SERVICE_UNAVAILABLE",
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    requestId: z.string(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
