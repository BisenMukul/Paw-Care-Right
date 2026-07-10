import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

export const REQUEST_ID_HEADER = "x-request-id";

export interface RequestWithId extends Request {
  requestId?: string;
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestWithId = req as RequestWithId;
  const incoming = req.header(REQUEST_ID_HEADER);
  const requestId = incoming && incoming.length > 0 ? incoming : randomUUID();

  requestWithId.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  next();
}

export function getRequestId(req: RequestWithId): string {
  return req.requestId ?? "unknown";
}
