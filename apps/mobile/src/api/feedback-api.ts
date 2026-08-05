import type {
  FeedbackReportCreated,
  FeedbackScreenshotUploadUrl,
  SubmitFeedbackInput,
} from "@bombaypetcompany/types";
import { useMutation } from "@tanstack/react-query";

import { apiClient } from "./client";

/** POST `/v1/feedback/screenshot-upload-url` (T104): a presigned PUT URL + object key to upload a feedback screenshot to. Mirrors `privacy-api.ts`'s idiom. */
export function requestScreenshotUploadUrl(): Promise<FeedbackScreenshotUploadUrl> {
  return apiClient.post<FeedbackScreenshotUploadUrl>("/v1/feedback/screenshot-upload-url");
}

/** POST `/v1/feedback` (T104): submits an in-app feedback/bug report. */
export function useSubmitFeedback() {
  return useMutation({
    mutationFn: (input: SubmitFeedbackInput) => apiClient.post<FeedbackReportCreated>("/v1/feedback", input),
  });
}
