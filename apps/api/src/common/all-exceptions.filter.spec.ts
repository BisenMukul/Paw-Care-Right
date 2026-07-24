import type { ArgumentsHost, HttpException } from "@nestjs/common";
import { ConflictException } from "@nestjs/common";

import { AllExceptionsFilter } from "./all-exceptions.filter";
import type { RequestWithId } from "./request-id.middleware";

describe("AllExceptionsFilter", () => {
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
});
