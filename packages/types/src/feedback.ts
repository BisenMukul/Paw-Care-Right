import { z } from "zod";

/**
 * In-app feedback + bug report (T104 plan D3/D4/step 1). Mirrors
 * `account-privacy.ts`'s `.strict()` + exported-constant style.
 *
 * SAFETY (T089 PII posture / plan D3): `feedbackLogEntrySchema` is a CLOSED
 * structural shape -- there is no free-text field anywhere in it. It cannot
 * carry an owner's symptom text, a pet's name, or a token, so shipping a
 * device log buffer through this schema can never reopen the breadcrumb
 * leak `packages/analytics/src/sentry/scrub.ts` closes. `submitFeedbackSchema`
 * additionally REFINES so a payload claiming `attachLogs: false` can never
 * carry a non-empty `logs` array -- the shared contract itself encodes the
 * server-side consent gate (`FeedbackService.submit` re-checks it
 * independently; this is belt-and-braces at the type layer).
 */

export const FEEDBACK_CATEGORIES = ["BUG", "IDEA", "OTHER"] as const;
export const feedbackCategorySchema = z.enum(FEEDBACK_CATEGORIES);
export type FeedbackCategory = z.infer<typeof feedbackCategorySchema>;

export const FEEDBACK_MESSAGE_MAX = 2000;
export const FEEDBACK_LOG_ENTRIES_MAX = 50;

/** Closed vocabulary of log-buffer sinks (D3) -- never a free-text "reason". */
export const FEEDBACK_LOG_EVENT_CODES = [
  "startup_fatal",
  "startup_nonfatal",
  "render_error",
  "captured_error",
] as const;
export const feedbackLogEventCodeSchema = z.enum(FEEDBACK_LOG_EVENT_CODES);
export type FeedbackLogEventCode = z.infer<typeof feedbackLogEventCodeSchema>;

/** A bare identifier shape only (e.g. `TypeError`) -- never free text. */
const ERROR_NAME_PATTERN = /^[A-Za-z0-9_$]{1,64}$/;

export const feedbackLogEntrySchema = z
  .object({
    at: z.string().datetime(),
    level: z.enum(["error", "warn"]),
    code: feedbackLogEventCodeSchema,
    errorName: z.string().regex(ERROR_NAME_PATTERN).optional(),
  })
  .strict();
export type FeedbackLogEntry = z.infer<typeof feedbackLogEntrySchema>;

const SENTRY_EVENT_ID_PATTERN = /^[0-9a-f]{32}$/;

export const submitFeedbackSchema = z
  .object({
    category: feedbackCategorySchema,
    message: z.string().min(1).max(FEEDBACK_MESSAGE_MAX),
    platform: z.enum(["ios", "android"]),
    appVersion: z.string().min(1).max(32),
    attachLogs: z.boolean(),
    logs: z.array(feedbackLogEntrySchema).max(FEEDBACK_LOG_ENTRIES_MAX).optional(),
    screenshotKey: z.string().max(512).optional(),
    sentryEventId: z.string().regex(SENTRY_EVENT_ID_PATTERN).optional(),
    sentryRelease: z.string().max(128).optional(),
  })
  .strict()
  .refine((value) => value.attachLogs === true || (value.logs?.length ?? 0) === 0, {
    message: "logs must be empty or absent unless attachLogs is true",
    path: ["logs"],
  });
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

export const feedbackReportCreatedSchema = z
  .object({
    reportId: z.string().uuid(),
    createdAt: z.string().datetime(),
  })
  .strict();
export type FeedbackReportCreated = z.infer<typeof feedbackReportCreatedSchema>;

export const feedbackScreenshotUploadUrlSchema = z
  .object({
    uploadUrl: z.string(),
    key: z.string(),
  })
  .strict();
export type FeedbackScreenshotUploadUrl = z.infer<typeof feedbackScreenshotUploadUrlSchema>;
