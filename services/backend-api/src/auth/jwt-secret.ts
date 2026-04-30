import { ConfigService } from "@nestjs/config";

const DEV_PLACEHOLDER = "dev-only-insecure-jwt-secret";

/** Single source for JWT signing and verification. Production requires JWT_SECRET. */
export function resolveJwtSecret(config: ConfigService): string {
  const secret = config.get<string>("JWT_SECRET")?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET must be set when NODE_ENV is production (use a long random string).",
    );
  }
  return DEV_PLACEHOLDER;
}
