import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { ErrorCode } from "@pawcareright/types";
import type { Response } from "express";

import { captureApiException } from "../observability/sentry";
import { getRequestId, type RequestWithId } from "./request-id.middleware";

const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: "VALIDATION_FAILED",
  [HttpStatus.UNAUTHORIZED]: "UNAUTHORIZED",
  [HttpStatus.PAYMENT_REQUIRED]: "PAYMENT_REQUIRED",
  [HttpStatus.FORBIDDEN]: "FORBIDDEN",
  [HttpStatus.NOT_FOUND]: "NOT_FOUND",
  [HttpStatus.CONFLICT]: "CONFLICT",
  [HttpStatus.TOO_MANY_REQUESTS]: "RATE_LIMITED",
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
      const code = STATUS_TO_CODE[status] ?? "INTERNAL";
      const message = this.extractMessage(exception);
      return { status, code, message };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: "INTERNAL",
      message: GENERIC_INTERNAL_MESSAGE,
    };
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
