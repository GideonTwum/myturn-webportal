/**
 * Provider credential checks for health and production safety.
 * Does not call external APIs except where noted (Arkesel ping).
 */

export type ProviderReadiness = {
  provider: string;
  configured: boolean;
  health: "ok" | "unconfigured" | "error";
  missing?: string[];
};

const WEAK_JWT_SECRETS = new Set([
  "change-me-in-production-use-long-random-string",
  "change-me",
  "ci-jwt-secret-not-for-production",
  "secret",
  "jwt-secret",
]);

export function isLivePaymentProvider(): boolean {
  const p = process.env.PAYMENT_PROVIDER?.trim().toLowerCase() ?? "mock";
  return p.startsWith("mtn");
}

export function isLiveDisbursementProvider(): boolean {
  const p = process.env.DISBURSEMENT_PROVIDER?.trim().toLowerCase() ?? "mock";
  return p === "mtn-momo" || p === "mtn";
}

export function getMtnCollectionReadiness(): ProviderReadiness {
  const provider =
    process.env.PAYMENT_PROVIDER?.trim().toLowerCase() ?? "mock";
  if (provider === "mock") {
    return { provider: "mock", configured: true, health: "ok" };
  }
  if (!provider.startsWith("mtn")) {
    return { provider, configured: false, health: "unconfigured" };
  }
  const missing: string[] = [];
  if (!process.env.MTN_MOMO_SUBSCRIPTION_KEY?.trim()) {
    missing.push("MTN_MOMO_SUBSCRIPTION_KEY");
  }
  if (!process.env.MTN_MOMO_API_USER?.trim()) {
    missing.push("MTN_MOMO_API_USER");
  }
  if (!process.env.MTN_MOMO_API_KEY?.trim()) {
    missing.push("MTN_MOMO_API_KEY");
  }
  const callback =
    process.env.MTN_MOMO_CALLBACK_HOST?.trim() ||
    process.env.PUBLIC_API_URL?.trim();
  if (!callback) missing.push("MTN_MOMO_CALLBACK_HOST or PUBLIC_API_URL");
  return {
    provider: "mtn-momo-collection",
    configured: missing.length === 0,
    health: missing.length === 0 ? "ok" : "unconfigured",
    ...(missing.length ? { missing } : {}),
  };
}

export function getMtnDisbursementReadiness(): ProviderReadiness {
  const provider =
    process.env.DISBURSEMENT_PROVIDER?.trim().toLowerCase() ?? "mock";
  if (provider === "mock") {
    return { provider: "mock-disbursement", configured: true, health: "ok" };
  }
  if (provider !== "mtn-momo" && provider !== "mtn") {
    return { provider, configured: false, health: "unconfigured" };
  }
  const missing: string[] = [];
  if (!process.env.MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY?.trim()) {
    missing.push("MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY");
  }
  if (!process.env.MTN_MOMO_DISBURSEMENT_API_USER?.trim()) {
    missing.push("MTN_MOMO_DISBURSEMENT_API_USER");
  }
  if (!process.env.MTN_MOMO_DISBURSEMENT_API_KEY?.trim()) {
    missing.push("MTN_MOMO_DISBURSEMENT_API_KEY");
  }
  const callback =
    process.env.MTN_MOMO_DISBURSEMENT_CALLBACK_HOST?.trim() ||
    process.env.PUBLIC_API_URL?.trim();
  if (!callback) {
    missing.push("MTN_MOMO_DISBURSEMENT_CALLBACK_HOST or PUBLIC_API_URL");
  }
  return {
    provider: "mtn-momo-disbursement",
    configured: missing.length === 0,
    health: missing.length === 0 ? "ok" : "unconfigured",
    ...(missing.length ? { missing } : {}),
  };
}

export function getArkeselReadiness(): ProviderReadiness {
  const provider = process.env.SMS_PROVIDER?.trim().toLowerCase() ?? "console";
  if (provider === "console") {
    return { provider: "console", configured: true, health: "ok" };
  }
  if (provider !== "arkesel") {
    return { provider, configured: false, health: "unconfigured" };
  }
  const missing: string[] = [];
  if (!process.env.ARKESEL_API_KEY?.trim()) missing.push("ARKESEL_API_KEY");
  if (!process.env.ARKESEL_SENDER_ID?.trim()) missing.push("ARKESEL_SENDER_ID");
  return {
    provider: "arkesel",
    configured: missing.length === 0,
    health: missing.length === 0 ? "ok" : "unconfigured",
    ...(missing.length ? { missing } : {}),
  };
}

export function isWeakJwtSecret(secret: string | undefined): boolean {
  const s = secret?.trim() ?? "";
  if (!s || s.length < 32) return true;
  return WEAK_JWT_SECRETS.has(s.toLowerCase());
}

export function hasWebhookSecret(): boolean {
  if (process.env.WEBHOOK_SECRET?.trim()) return true;
  if (process.env.WEBHOOK_SECRET_MTN?.trim()) return true;
  return false;
}
