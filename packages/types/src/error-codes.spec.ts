import { errorCodeSchema, errorResponseSchema } from "./error-codes";

describe("errorCodeSchema", () => {
  it("contains exactly the seeded starter codes", () => {
    expect(errorCodeSchema.options).toEqual([
      "VALIDATION_FAILED",
      "UNAUTHORIZED",
      "FORBIDDEN",
      "NOT_FOUND",
      "CONFLICT",
      "RATE_LIMITED",
      "PAYMENT_REQUIRED",
      "INTERNAL",
    ]);
  });
});

describe("errorResponseSchema", () => {
  it("accepts a valid error response", () => {
    const input = {
      error: {
        code: "NOT_FOUND",
        message: "Pet not found",
        requestId: "req-123",
      },
    };

    expect(errorResponseSchema.parse(input)).toEqual(input);
  });

  it("rejects an unknown error code", () => {
    const input = {
      error: {
        code: "SOMETHING_ELSE",
        message: "Pet not found",
        requestId: "req-123",
      },
    };

    expect(() => errorResponseSchema.parse(input)).toThrow();
  });

  it("rejects a missing requestId", () => {
    const input = {
      error: {
        code: "NOT_FOUND",
        message: "Pet not found",
      },
    };

    expect(() => errorResponseSchema.parse(input)).toThrow();
  });
});
