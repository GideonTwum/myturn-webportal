import "./bootstrap-env";
import {
  assertProductionSafety,
  getPlatformFeatureFlags,
} from "./common/platform-env";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory, Reflector } from "@nestjs/core";
import { ApiExceptionFilter } from "./common/filters/api-exception.filter";
import { ApiResponseInterceptor } from "./common/interceptors/api-response.interceptor";
import { RequestLoggingInterceptor } from "./common/interceptors/request-logging.interceptor";
import { webcrypto } from "node:crypto";
import { AppModule } from "./app.module";
import { validateStagingEcosystem } from "./common/staging-ecosystem.validation";
import { logDeploymentDiagnostics } from "./common/railway-startup.validation";
import { PrismaService } from "./prisma/prisma.service";

/** @nestjs/schedule expects `globalThis.crypto` (Node 20+ provides it). Polyfill for older/host runtimes. */
if (!globalThis.crypto) {
  (globalThis as typeof globalThis & { crypto: Crypto }).crypto =
    webcrypto as unknown as Crypto;
}

async function bootstrap() {
  assertProductionSafety();
  const flags = getPlatformFeatureFlags();
  const logger = new Logger("Bootstrap");
  logDeploymentDiagnostics(logger);
  logger.log(`Deployment tier: ${flags.tier}`);
  if (flags.mockPayments) {
    logger.warn("Mock payment endpoints ENABLED (staging/local only)");
  }
  if (flags.stagingRelaxTrust) {
    logger.warn("STAGING_RELAX_TRUST active — Ghana Card gates relaxed");
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(new Logger());
  const config = app.get(ConfigService);

  try {
    await validateStagingEcosystem(app.get(PrismaService));
  } catch (e) {
    logger.warn(`Staging validation: ${e instanceof Error ? e.message : e}`);
  }

  const corsOrigin = config.get<string>("CORS_ORIGIN")?.trim();
  const stagingExtra = config.get<string>("STAGING_CORS_EXTRA")?.trim();
  const tier = flags.tier;

  if (corsOrigin || (tier === "staging" && stagingExtra)) {
    const origins = new Set<string>();
    if (corsOrigin) {
      for (const o of corsOrigin.split(",")) {
        const trimmed = o.trim().replace(/\/+$/, "");
        if (trimmed) origins.add(trimmed);
      }
    }
    if (tier === "staging" && stagingExtra) {
      for (const o of stagingExtra.split(",")) {
        const trimmed = o.trim().replace(/\/+$/, "");
        if (trimmed) origins.add(trimmed);
      }
    }
    const originList = [...origins];
    app.enableCors({
      origin: originList,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    });
    logger.log(`CORS enabled for: ${originList.join(", ")}`);
  } else {
    app.enableCors({
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    });
    logger.warn(
      "CORS_ORIGIN not set — allowing any origin (dev fallback only).",
    );
  }

  app.setGlobalPrefix("api");
  app.useGlobalInterceptors(
    new RequestLoggingInterceptor(),
    new ApiResponseInterceptor(app.get(Reflector)),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      disableErrorMessages: process.env.NODE_ENV === "production",
    }),
  );

  const portRaw = config.get<string>("PORT") ?? process.env.PORT ?? "3001";
  const port = Number.parseInt(String(portRaw), 10);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid PORT: ${portRaw}`);
  }
  await app.listen(port, "0.0.0.0");
  logger.log(
    `backend-api listening on 0.0.0.0:${port} globalPrefix=/api NODE_ENV=${process.env.NODE_ENV ?? "undefined"}`,
  );
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
