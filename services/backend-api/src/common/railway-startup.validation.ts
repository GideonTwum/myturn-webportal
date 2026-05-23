import { Logger } from "@nestjs/common";
import {
  getDeploymentTier,
  getPlatformFeatureFlags,
  getPublicApiBaseUrl,
} from "./platform-env";

function parseDatabaseHost(url: string | undefined): string {
  if (!url?.trim()) return "not_set";
  try {
    const normalized = url.trim().replace(/^postgres(ql)?:/i, "http:");
    const u = new URL(normalized);
    return `${u.hostname}:${u.port || "5432"}`;
  } catch {
    return "unparseable";
  }
}

function smsProviderName(): string {
  return process.env.SMS_PROVIDER?.trim().toLowerCase() || "console";
}

function paymentProviderName(): string {
  return process.env.PAYMENT_PROVIDER?.trim().toLowerCase() || "mock";
}

/**
 * Logs non-secret deployment diagnostics on every boot (Railway + local).
 * Staging warnings are informational; production unsafe combos crash in assertProductionSafety().
 */
export function logDeploymentDiagnostics(logger: Logger): void {
  const tier = getDeploymentTier();
  const flags = getPlatformFeatureFlags();
  const redisConfigured = Boolean(process.env.REDIS_URL?.trim());

  logger.log(
    JSON.stringify({
      domain: "deploy",
      event: "startup.config",
      deploymentTier: tier,
      nodeEnv: process.env.NODE_ENV ?? "undefined",
      port: process.env.PORT ?? "3001 (default)",
      databaseHost: parseDatabaseHost(process.env.DATABASE_URL),
      redis: redisConfigured ? "enabled" : "disabled",
      otpStore: redisConfigured ? "redis" : "memory",
      smsProvider: smsProviderName(),
      paymentProvider: paymentProviderName(),
      mockPayments: flags.mockPayments,
      mockPayoutFinalize: flags.mockPayoutFinalize,
      stagingRelaxTrust: flags.stagingRelaxTrust,
      debugOtpInResponses: flags.debugOtpInResponses,
      memberPhoneLogin: flags.memberPhoneLogin,
      corsOriginSet: Boolean(process.env.CORS_ORIGIN?.trim()),
      allowOpenCors: flags.allowOpenCors,
      publicApiUrl: getPublicApiBaseUrl(),
      reconciliationJob:
        process.env.ENABLE_RECONCILIATION_JOB?.trim() !== "false",
    }),
  );

  if (tier === "staging") {
    if (flags.mockPayments) {
      logger.warn("Staging: MOCK_PAYMENTS active — mock MoMo endpoints enabled");
    }
    if (flags.stagingRelaxTrust) {
      logger.warn("Staging: STAGING_RELAX_TRUST active — trust gates relaxed");
    }
    if (flags.debugOtpInResponses) {
      logger.warn("Staging: debug OTP may appear in API responses");
    }
    if (flags.allowOpenCors) {
      logger.warn(
        "Staging: CORS_ORIGIN unset — any origin allowed. Set CORS_ORIGIN for Vercel.",
      );
    }
    if (smsProviderName() === "console") {
      logger.warn("Staging: SMS_PROVIDER=console — OTP logged, not sent via SMS");
    }
    if (paymentProviderName() === "mock" || !process.env.PAYMENT_PROVIDER?.trim()) {
      logger.warn("Staging: PAYMENT_PROVIDER=mock — use mock-approve for MoMo");
    }
  }
}
