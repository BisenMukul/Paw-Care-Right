import { type ErrorCode, errorResponseSchema } from "@pawcareright/types";

export interface ApiErrorArgs {
  code: ErrorCode;
  message: string;
  httpStatus: number;
  requestId: string | null;
}

/**
 * Typed error thrown by the api-client for every non-2xx response and every
 * network/transport failure. Callers (and TanStack Query's `retry`) branch on
 * `.code` / `.httpStatus` instead of parsing opaque `Error` messages.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly requestId: string | null;

  constructor(args: ApiErrorArgs) {
    super(args.message);
    this.name = "ApiError";
    this.code = args.code;
    this.httpStatus = args.httpStatus;
    this.requestId = args.requestId;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Fallback mapping used when the response body does not conform to the
 * shared `errorResponseSchema` (e.g. an upstream proxy/error page, or a
 * malformed payload). Keeps behavior deterministic instead of guessing.
 */
function statusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case 400:
      return "VALIDATION_FAILED";
    case 401:
      return "UNAUTHORIZED";
    case 402:
      return "PAYMENT_REQUIRED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 429:
      return "RATE_LIMITED";
    default:
      return "INTERNAL";
  }
}

/**
 * Normalizes a non-2xx HTTP response into a typed `ApiError`. Parses the
 * body against the shared `errorResponseSchema`; if parsing fails, falls
 * back to a minimal status->code map so the caller always receives a
 * well-formed `ApiError` rather than an opaque/raw failure.
 */
export function normalizeError(args: { status: number; body: unknown }): ApiError {
  const parsed = errorResponseSchema.safeParse(args.body);

  if (parsed.success) {
    return new ApiError({
      code: parsed.data.error.code,
      message: parsed.data.error.message,
      httpStatus: args.status,
      requestId: parsed.data.error.requestId,
    });
  }

  return new ApiError({
    code: statusToErrorCode(args.status),
    message: `Request failed with status ${args.status}`,
    httpStatus: args.status,
    requestId: null,
  });
}

/**
 * Normalizes a `fetch` throw (DNS failure, offline, aborted, CORS, etc.)
 * into a typed `ApiError`. `httpStatus: 0` distinguishes "never reached the
 * server" from a server-produced non-2xx response.
 */
export function normalizeNetworkError(cause: unknown): ApiError {
  const message = cause instanceof Error ? cause.message : "Network request failed";

  return new ApiError({
    code: "INTERNAL",
    message,
    httpStatus: 0,
    requestId: null,
  });
}
