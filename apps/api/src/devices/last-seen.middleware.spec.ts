import type { NextFunction, Request, Response } from "express";

import type { PrismaService } from "../prisma/prisma.service";
import { DEVICE_TOKEN_HEADER, LastSeenMiddleware } from "./last-seen.middleware";

describe("LastSeenMiddleware", () => {
  function buildRequest(headerValue: string | undefined): Request {
    return {
      header: jest.fn((name: string) => (name === DEVICE_TOKEN_HEADER ? headerValue : undefined)),
    } as unknown as Request;
  }

  it("header present → updateMany fired, next called synchronously", () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = { device: { updateMany } } as unknown as PrismaService;
    const middleware = new LastSeenMiddleware(prisma);
    const next = jest.fn() as unknown as NextFunction;
    const req = buildRequest("ExponentPushToken[abc123]");

    middleware.use(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { expoPushToken: "ExponentPushToken[abc123]" },
      data: { lastSeenAt: expect.any(Date) },
    });
  });

  it("no header → updateMany not called, next still called", () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const prisma = { device: { updateMany } } as unknown as PrismaService;
    const middleware = new LastSeenMiddleware(prisma);
    const next = jest.fn() as unknown as NextFunction;
    const req = buildRequest(undefined);

    middleware.use(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("updateMany rejection is swallowed (no throw), next still called", async () => {
    const updateMany = jest.fn().mockRejectedValue(new Error("db down"));
    const prisma = { device: { updateMany } } as unknown as PrismaService;
    const middleware = new LastSeenMiddleware(prisma);
    const next = jest.fn() as unknown as NextFunction;
    const req = buildRequest("ExponentPushToken[abc123]");

    expect(() => middleware.use(req, {} as Response, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);

    // Flush the rejected promise's microtask queue so the .catch() handler
    // runs before the suite exits (otherwise Jest may report an unhandled
    // rejection from a prior run's dangling promise).
    await Promise.resolve();
    await Promise.resolve();
  });
});
