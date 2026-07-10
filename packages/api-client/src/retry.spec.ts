import { ApiError } from "./errors";
import { MAX_QUERY_RETRIES, shouldRetry } from "./retry";

function apiError(httpStatus: number): ApiError {
  return new ApiError({ code: "INTERNAL", message: "x", httpStatus, requestId: null });
}

describe("shouldRetry", () => {
  it.each([400, 401, 402, 403, 404, 409, 429, 499])(
    "never retries a 4xx ApiError (status %d)",
    (status) => {
      expect(shouldRetry(0, apiError(status))).toBe(false);
    },
  );

  it("retries a 5xx ApiError until MAX_QUERY_RETRIES, then stops", () => {
    for (let n = 0; n < MAX_QUERY_RETRIES; n += 1) {
      expect(shouldRetry(n, apiError(500))).toBe(true);
    }
    expect(shouldRetry(MAX_QUERY_RETRIES, apiError(500))).toBe(false);
  });

  it("retries a network ApiError (httpStatus 0) until MAX_QUERY_RETRIES, then stops", () => {
    for (let n = 0; n < MAX_QUERY_RETRIES; n += 1) {
      expect(shouldRetry(n, apiError(0))).toBe(true);
    }
    expect(shouldRetry(MAX_QUERY_RETRIES, apiError(0))).toBe(false);
  });

  it("treats a non-ApiError as a retryable transient failure until MAX_QUERY_RETRIES", () => {
    const error = new Error("boom");

    for (let n = 0; n < MAX_QUERY_RETRIES; n += 1) {
      expect(shouldRetry(n, error)).toBe(true);
    }
    expect(shouldRetry(MAX_QUERY_RETRIES, error)).toBe(false);
  });
});
