import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

export const CORRELATION_HEADER = "x-correlation-id";

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.headers[CORRELATION_HEADER];
    const correlationId =
      (typeof incoming === "string" && incoming.trim()) || randomUUID();
    (req as Request & { correlationId: string }).correlationId = correlationId;
    res.setHeader(CORRELATION_HEADER, correlationId);
    next();
  }
}

export function getCorrelationId(req: Request): string | undefined {
  return (req as Request & { correlationId?: string }).correlationId;
}
