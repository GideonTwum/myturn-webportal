/**
 * Central platform environment + feature flags.
 * Single source of truth for staging vs production safety checks.
 */

import {
  getArkeselReadiness,
  getMtnCollectionReadiness,
  getMtnDisbursementReadiness,
  hasWebhookSecret,
  isWeakJwtSecret,
} from "./provider-readiness";

export type DeploymentTier = "local" | "staging" | "production";

export type PlatformFeatureFlags = {
  tier: DeploymentTier;
  mockPayments: boolean;
  mockPayoutFinalize: boolean;
  stagingRelaxTrust: boolean;
  debugOtpInResponses: boolean;
  memberPhoneLogin: boolean;
  allowOpenCors: boolean;
};

export function getDeploymentTier(): DeploymentTier {
  const explicit = process.env.DEPLOYMENT_TIER?.trim().toLowerCase();
  if (explicit === "production" || explicit === "staging" || explicit === "local") {
    return explicit;
  }
  if (process.env.NODE_ENV === "production") return "production";
  if (process.env.RAILWAY_ENVIRONMENT || process.env.VERCEL_ENV === "preview") {
    return "staging";
  }
  return "local";
}

export function isProductionTier(): boolean {
  return getDeploymentTier() === "production";
}

export function isStagingRelaxTrust(): boolean {
  const flag = process.env.STAGING_RELAX_TRUST?.trim().toLowerCase();
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  if (flag === "false" || flag === "0" || flag === "no") return false;
  return !isProductionTier();
}

/** On-screen OTP in API responses (staging console SMS). Off when Arkesel is enabled unless forced. */
export function isDebugOtpInResponses(): boolean {
  if (isProductionTier()) return false;
  const explicit = process.env.OTP_DEBUG_IN_RESPONSES?.trim().toLowerCase();
  if (explicit === "true" || explicit === "1" || explicit === "yes") return true;
  if (explicit === "false" || explicit === "0" || explicit === "no") return false;
  const sms = process.env.SMS_PROVIDER?.trim().toLowerCase() ?? "console";
  if (sms === "arkesel") return false;
  return true;
}

export function getPlatformFeatureFlags(): PlatformFeatureFlags {
  const tier = getDeploymentTier();
  const production = tier === "production";
  return {
    tier,
    mockPayments: !production && process.env.MOCK_PAYMENTS !== "false",
    mockPayoutFinalize: !production && process.env.MOCK_PAYOUTS !== "false",
    stagingRelaxTrust: isStagingRelaxTrust(),
    debugOtpInResponses: isDebugOtpInResponses(),
    memberPhoneLogin: !production && process.env.MEMBER_PHONE_LOGIN !== "false",
    allowOpenCors: !process.env.CORS_ORIGIN?.trim(),
  };
}

/** Collect production safety violations (for tests and startup). */
export function collectProductionSafetyErrors(): string[] {
  if (getDeploymentTier() !== "production") return [];
  const errors: string[] = [];

  if (process.env.MOCK_PAYMENTS?.trim().toLowerCase() === "true") {
    errors.push("MOCK_PAYMENTS must not be true in production");
  }
  if (process.env.MOCK_PAYOUTS?.trim().toLowerCase() === "true") {
    errors.push("MOCK_PAYOUTS must not be true in production");
  }
  if (isStagingRelaxTrust()) {
    errors.push("STAGING_RELAX_TRUST must be false in production");
  }
  if (process.env.MEMBER_PHONE_LOGIN?.trim().toLowerCase() === "true") {
    errors.push("MEMBER_PHONE_LOGIN must not be true in production");
  }
  if (!process.env.DATABASE_URL?.trim()) {
    errors.push("DATABASE_URL is required in production");
  }
  if (!process.env.JWT_SECRET?.trim()) {
    errors.push("JWT_SECRET is required in production");
  } else if (isWeakJwtSecret(process.env.JWT_SECRET)) {
    errors.push("JWT_SECRET is too weak or uses a default value");
  }
  if (!process.env.CORS_ORIGIN?.trim()) {
    errors.push("CORS_ORIGIN is required in production");
  }
  if (!process.env.REDIS_URL?.trim()) {
    errors.push("REDIS_URL is required in production");
  }
  if (process.env.OTP_DEBUG_CODES?.trim().toLowerCase() === "true") {
    errors.push("OTP_DEBUG_CODES must not be true in production");
  }
  if (getPlatformFeatureFlags().debugOtpInResponses) {
    errors.push("Debug OTP in responses must be disabled in production");
  }

  const sms = process.env.SMS_PROVIDER?.trim().toLowerCase() ?? "console";
  if (sms === "console" || !process.env.SMS_PROVIDER?.trim()) {
    errors.push("SMS_PROVIDER must not be console in production (use arkesel)");
  }
  const arkesel = getArkeselReadiness();
  if (sms === "arkesel" && !arkesel.configured) {
    errors.push(
      `Arkesel credentials missing: ${(arkesel.missing ?? []).join(", ")}`,
    );
  }

  const payment =
    process.env.PAYMENT_PROVIDER?.trim().toLowerCase() ?? "mock";
  if (payment === "mock" || !process.env.PAYMENT_PROVIDER?.trim()) {
    errors.push("PAYMENT_PROVIDER must not be mock in production");
  }
  const collection = getMtnCollectionReadiness();
  if (payment.startsWith("mtn") && !collection.configured) {
    errors.push(
      `MTN collection credentials missing: ${(collection.missing ?? []).join(", ")}`,
    );
  }

  const disbursement =
    process.env.DISBURSEMENT_PROVIDER?.trim().toLowerCase() ?? "mock";
  if (disbursement === "mock" || !process.env.DISBURSEMENT_PROVIDER?.trim()) {
    errors.push("DISBURSEMENT_PROVIDER must not be mock in production");
  }
  const disb = getMtnDisbursementReadiness();
  if (
    (disbursement === "mtn-momo" || disbursement === "mtn") &&
    !disb.configured
  ) {
    errors.push(
      `MTN disbursement credentials missing: ${(disb.missing ?? []).join(", ")}`,
    );
  }

  if (!hasWebhookSecret()) {
    errors.push(
      "WEBHOOK_SECRET or WEBHOOK_SECRET_MTN is required in production",
    );
  }

  return errors;
}

/** Crash startup if production would expose staging-only behavior. */
export function assertProductionSafety(): void {
  if (getDeploymentTier() !== "production") return;
  const errors = collectProductionSafetyErrors();
  if (errors.length > 0) {
    throw new Error(
      `Production safety check failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }
}

export function getPublicApiBaseUrl(): string {
  return (
    process.env.STAGING_API_URL?.trim() ||
    process.env.PUBLIC_API_URL?.trim() ||
    `http://localhost:${process.env.PORT ?? "3001"}/api`
  ).replace(/\/+$/, "");
}
