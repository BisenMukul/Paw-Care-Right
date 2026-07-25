import type { ArgumentsHost, HttpException } from "@nestjs/common";
import { ConflictException, NotFoundException } from "@nestjs/common";

import { captureApiException } from "../observability/sentry";

import { AllExceptionsFilter } from "./all-exceptions.filter";
import type { RequestWithId } from "./request-id.middleware";

// T089 D8: the filter's Sentry wiring is unit-tested against a mock of our
// own `../observability/sentry` module (never the real SDK here — that's
// covered end to end by `observability/sentry.spec.ts`'s mock-transport
// proof). This keeps the filter's existing behavior (T082 F1 headersSent
// guard, error envelope) untouched and independently verifiable.
jest.mock("../observability/sentry", () => ({
  captureApiException: jest.fn(),
}));

describe("AllExceptionsFilter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function buildHost(requestId: string): {
    host: ArgumentsHost;
    status: jest.Mock;
    json: jest.Mock;
  } {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const request: Partial<RequestWithId> = { requestId };

    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;

    return { host, status, json };
  }

  it("maps a 409 HttpException to CONFLICT and copies the requestId", () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = buildHost("req-123");

    filter.catch(new ConflictException("already exists") as HttpException, host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: "CONFLICT",
        message: "already exists",
        requestId: "req-123",
      },
    });
  });

  it("maps a plain Error to 500 INTERNAL with a generic message", () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = buildHost("req-456");

    filter.catch(new Error("some internal secret detail"), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: "INTERNAL",
        message: expect.not.stringContaining("secret") as string,
        requestId: "req-456",
      },
    });
  });

  it("does not write a JSON envelope once headers are sent (T082 F1)", () => {
    const filter = new AllExceptionsFilter();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const end = jest.fn();
    const request: Partial<RequestWithId> = { requestId: "req-789" };

    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status, json, headersSent: true, writableEnded: false, end }),
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;

    filter.catch(new Error("post-header persistence failure"), host);

    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
    expect(end).toHaveBeenCalledTimes(1);
  });

  it("a 500 is reported to Sentry with requestId only", () => {
    const filter = new AllExceptionsFilter();
    const { host } = buildHost("req-500");
    const error = new Error("db exploded");

    filter.catch(error, host);

    expect(captureApiException).toHaveBeenCalledTimes(1);
    expect(captureApiException).toHaveBeenCalledWith(error, "req-500");
  });

  it("a 404 is NOT reported", () => {
    const filter = new AllExceptionsFilter();
    const { host } = buildHost("req-404");

    filter.catch(new NotFoundException("not here") as HttpException, host);

    expect(captureApiException).not.toHaveBeenCalled();
  });

  it("a capture failure never breaks the response", () => {
    (captureApiException as jest.Mock).mockImplementation(() => {
      throw new Error("sentry sdk exploded");
    });
    const filter = new AllExceptionsFilter();
    const { host, status, json } = buildHost("req-501");

    filter.catch(new Error("db exploded"), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: "INTERNAL",
        message: expect.any(String) as string,
        requestId: "req-501",
      },
    });
  });
});
