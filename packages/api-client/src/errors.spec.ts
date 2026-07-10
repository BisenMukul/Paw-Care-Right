import type { ErrorCode } from "@pawcareright/types";
import { ApiError, isApiError, normalizeError, normalizeNetworkError } from "./errors";

describe("normalizeError", () => {
  const statuses: Array<{ status: number; code: ErrorCode }> = [
    { status: 400, code: "VALIDATION_FAILED" },
    { status: 401, code: "UNAUTHORIZED" },
    { status: 402, code: "PAYMENT_REQUIRED" },
    { status: 403, code: "FORBIDDEN" },
    { status: 404, code: "NOT_FOUND" },
    { status: 409, code: "CONFLICT" },
    { status: 429, code: "RATE_LIMITED" },
    { status: 500, code: "INTERNAL" },
  ];

  it.each(statuses)("maps a schema-valid body at status $status to an ApiError", ({ status, code }) => {
    const body = { error: { code, message: "something went wrong", requestId: "req-1" } };

    const result = normalizeError({ status, body });

    expect(result).toBeInstanceOf(ApiError);
    expect(result.code).toBe(code);
    expect(result.httpStatus).toBe(status);
    expect(result.requestId).toBe("req-1");
    expect(result.message).toBe("something went wrong");
  });

  it.each(statuses)(
    "falls back to statusToErrorCode($status) -> $code when the body is unparseable",
    ({ status, code }) => {
      const result = normalizeError({ status, body: {} });

      expect(result.code).toBe(code);
      expect(result.httpStatus).toBe(status);
      expect(result.requestId).toBeNull();
    },
  );

  it("falls back for a non-object body", () => {
    const result = normalizeError({ status: 404, body: "boom" });

    expect(result.code).toBe("NOT_FOUND");
    expect(result.requestId).toBeNull();
  });

  it("falls back when requestId is missing", () => {
    const result = normalizeError({
      status: 409,
      body: { error: { code: "CONFLICT", message: "dup" } },
    });

    expect(result.code).toBe("CONFLICT");
    expect(result.requestId).toBeNull();
  });

  it("falls back to INTERNAL for an unmapped status", () => {
    const result = normalizeError({ status: 418, body: {} });

    expect(result.code).toBe("INTERNAL");
  });
});

describe("normalizeNetworkError", () => {
  it("normalizes a thrown network error to INTERNAL with httpStatus 0", () => {
    const result = normalizeNetworkError(new TypeError("fail"));

    expect(result).toBeInstanceOf(ApiError);
    expect(result.code).toBe("INTERNAL");
    expect(result.httpStatus).toBe(0);
    expect(result.requestId).toBeNull();
    expect(result.message).toBe("fail");
  });

  it("normalizes a non-Error cause with a generic message", () => {
    const result = normalizeNetworkError("offline");

    expect(result.code).toBe("INTERNAL");
    expect(result.httpStatus).toBe(0);
    expect(result.message).toBe("Network request failed");
  });
});

describe("isApiError", () => {
  it("returns true for an ApiError instance", () => {
    const error = new ApiError({ code: "INTERNAL", message: "x", httpStatus: 500, requestId: null });

    expect(isApiError(error)).toBe(true);
  });

  it("returns false for a plain Error", () => {
    expect(isApiError(new Error("x"))).toBe(false);
  });

  it("returns false for a non-error value", () => {
    expect(isApiError({ code: "INTERNAL" })).toBe(false);
  });
});
