import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(new Logger());
  const config = app.get(ConfigService);

  const corsOrigin = config.get<string>("CORS_ORIGIN")?.trim();
  if (corsOrigin) {
    const origins = corsOrigin.split(",").map((o) => o.trim()).filter(Boolean);
    app.enableCors({ origin: origins, credentials: true });
    logger.log(`CORS enabled for: ${origins.join(", ")}`);
  } else {
    app.enableCors({ origin: true, credentials: true });
    logger.warn(
      "CORS_ORIGIN not set — allowing any origin (fine for local dev; set CORS_ORIGIN in staging/production).",
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
  await app.listen(port);
  logger.log(
    `backend-api listening on port ${port} globalPrefix=/api NODE_ENV=${process.env.NODE_ENV ?? "undefined"}`,
  );
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
