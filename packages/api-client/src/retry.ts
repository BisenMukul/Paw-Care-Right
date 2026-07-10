import { isApiError } from "./errors";

/** Maximum retry attempts for retryable (non-4xx) failures. */
export const MAX_QUERY_RETRIES = 3;

/**
 * Shared TanStack Query `retry` predicate: never retries a client error
 * (4xx) since retrying will not change the outcome; retries transient
 * failures (5xx, network errors, and any other unrecognized error) up to
 * `MAX_QUERY_RETRIES` times.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.httpStatus >= 400 && error.httpStatus <= 499) {
    return false;
  }

  return failureCount < MAX_QUERY_RETRIES;
}
