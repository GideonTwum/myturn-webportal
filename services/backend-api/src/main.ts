import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { webcrypto } from "node:crypto";
import { AppModule } from "./app.module";

/** @nestjs/schedule expects `globalThis.crypto` (Node 20+ provides it). Polyfill for older/host runtimes. */
if (!globalThis.crypto) {
  (globalThis as typeof globalThis & { crypto: Crypto }).crypto =
    webcrypto as unknown as Crypto;
}

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(new Logger());
  const config = app.get(ConfigService);

  const corsOrigin = config.get<string>("CORS_ORIGIN")?.trim();
  if (corsOrigin) {
    const origins = corsOrigin
      .split(",")
      .map((o) => o.trim().replace(/\/+$/, ""))
      .filter(Boolean);
    app.enableCors({
      origin: origins,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    });
    logger.log(`CORS enabled for: ${origins.join(", ")}`);
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
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      disableErrorMessages: process.env.NODE_ENV === "production",
    }),
  );

  const port = config.get<string>("PORT") ?? process.env.PORT ?? "3001";
  await app.listen(port, '0.0.0.0');
  logger.log(
    `backend-api listening on port ${port} globalPrefix=/api NODE_ENV=${process.env.NODE_ENV ?? "undefined"}`,
  );
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
