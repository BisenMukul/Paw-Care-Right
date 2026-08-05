import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { errorCodeSchema, type ErrorCode } from "@bombaypetcompany/types";
import type { Response } from "express";

import { captureApiException } from "../observability/sentry";
import { getRequestId, type RequestWithId } from "./request-id.middleware";

// T106 F1 fix: 503 is NOT exclusively a feature kill switch (see
// `health.service.ts`'s `ServiceUnavailableException` on a dependency
// outage) -- `STATUS_TO_CODE` is only the FALLBACK for a bare status with no
// explicit code, so a health-check 503 now reports the generic
// `SERVICE_UNAVAILABLE`. `FeatureFlagGuard` throws with an explicit `code:
// "FEATURE_DISABLED"` in its exception body (see `resolve`/`extractCode`
// below), which always wins over this table.
const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: "VALIDATION_FAILED",
  [HttpStatus.UNAUTHORIZED]: "UNAUTHORIZED",
  [HttpStatus.PAYMENT_REQUIRED]: "PAYMENT_REQUIRED",
  [HttpStatus.FORBIDDEN]: "FORBIDDEN",
  [HttpStatus.NOT_FOUND]: "NOT_FOUND",
  [HttpStatus.CONFLICT]: "CONFLICT",
  [HttpStatus.TOO_MANY_REQUESTS]: "RATE_LIMITED",
  [HttpStatus.SERVICE_UNAVAILABLE]: "SERVICE_UNAVAILABLE",
};

const GENERIC_INTERNAL_MESSAGE = "An unexpected error occurred. Please try again later.";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();
    const requestId = getRequestId(request);

    const { status, code, message } = this.resolve(exception);

    this.logger.error(
      `[${requestId}] ${status} ${code}: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // T089 D8: only 5xx / non-HttpException errors are reported — 4xx are
    // expected client noise. Tagged with `requestId` ONLY, never the raw
    // request. Wrapped defensively so a Sentry SDK failure can never break
    // the response envelope (`captureApiException` itself is already
    // try/catch-wrapped — this is belt-and-braces at the call site).
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      try {
        captureApiException(exception, requestId);
      } catch {
        // never let observability break the response
      }
    }

    if (response.headersSent) {
      // T082 F1: a post-header failure (e.g. SSE persistence throwing after
      // `sse.writeHead`) must never attempt a second `response.status(...)`
      // write — that raises ERR_HTTP_HEADERS_SENT and destroys the socket
      // with no terminal frame. The error is still logged above; the
      // response is just closed cleanly instead.
      if (!response.writableEnded) {
        response.end();
      }
      return;
    }

    response.status(status).json({
      error: {
        code,
        message,
        requestId,
      },
    });
  }

  private resolve(exception: unknown): { status: number; code: ErrorCode; message: string } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = this.extractExplicitCode(exception) ?? STATUS_TO_CODE[status] ?? "INTERNAL";
      const message = this.extractMessage(exception);
      return { status, code, message };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: "INTERNAL",
      message: GENERIC_INTERNAL_MESSAGE,
    };
  }

  /**
   * T106 F1 fix: an exception thrown with an object response body carrying
   * a `code` that parses as a valid `ErrorCode` (e.g. `FeatureFlagGuard`'s
   * `{ code: "FEATURE_DISABLED", message }`) always wins over the generic
   * `STATUS_TO_CODE` status-keyed fallback -- this is what lets `503` mean
   * "kill switch" for a gated route and "dependency outage" for
   * `health.service.ts`'s plain `ServiceUnavailableException` at the same
   * time, without either one guessing at the other's intent.
   */
  private extractExplicitCode(exception: HttpException): ErrorCode | undefined {
    const response = exception.getResponse();

    if (typeof response !== "object" || response === null || !("code" in response)) {
      return undefined;
    }

    const parsed = errorCodeSchema.safeParse((response as { code: unknown }).code);
    return parsed.success ? parsed.data : undefined;
  }

  private extractMessage(exception: HttpException): string {
    const response = exception.getResponse();

    if (typeof response === "string") {
      return response;
    }

    if (
      typeof response === "object" &&
      response !== null &&
      "message" in response &&
      (typeof (response as { message: unknown }).message === "string" ||
        Array.isArray((response as { message: unknown }).message))
    ) {
      const { message } = response as { message: string | string[] };
      return Array.isArray(message) ? message.join(", ") : message;
    }

    return exception.message;
  }
}
