import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { getCorrelationId } from "../correlation/correlation.middleware";
import { getDeploymentTier } from "../platform-env";
import type { Request } from "express";

/** Structured request logging for staging diagnostics and future observability. */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method?: string;
      url?: string;
      route?: { path?: string };
    }>();
    const correlationId = getCorrelationId(req as import("express").Request);
    const method = req.method ?? "UNKNOWN";
    const path = req.route?.path ?? req.url ?? "";
    const tier = getDeploymentTier();
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - started;
          this.logger.log(
            JSON.stringify({
              tier,
              correlationId,
              method,
              path,
              status: "ok",
              ms,
            }),
          );
        },
        error: (err: { status?: number; message?: string }) => {
          const ms = Date.now() - started;
          this.logger.warn(
            JSON.stringify({
              tier,
              correlationId,
              method,
              path,
              status: err?.status ?? "error",
              ms,
              message: err?.message,
            }),
          );
        },
      }),
    );
  }
}
