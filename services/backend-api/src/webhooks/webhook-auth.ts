import type { DeploymentTier } from "../common/platform-env";
import type { SignatureVerifyResult } from "./webhook-signature";

export type WebhookAuthMode = "hmac_required" | "mtn_api_verify" | "mock_lenient";

export function isMtnWebhookProvider(provider: string): boolean {
  const p = provider.trim().toLowerCase();
  return (
    p === "mtn" ||
    p.startsWith("mtn-") ||
    p === "mtn-disbursement" ||
    p === "mtn-disburse"
  );
}

/** How inbound webhook authenticity is evaluated per provider. */
export function getWebhookAuthMode(provider: string): WebhookAuthMode {
  if (isMtnWebhookProvider(provider)) return "mtn_api_verify";
  if (provider.trim().toLowerCase() === "mock") return "mock_lenient";
  return "hmac_required";
}

export function shouldRejectWebhook(opts: {
  tier: DeploymentTier;
  authMode: WebhookAuthMode;
  signature: SignatureVerifyResult;
}): boolean {
  if (opts.authMode === "mtn_api_verify") {
    // MTN native callbacks do not use MyTurn HMAC — settlement verifies via MTN API.
    return false;
  }
  if (opts.authMode === "mock_lenient" && opts.tier !== "production") {
    return false;
  }
  if (opts.tier === "production" && !opts.signature.valid) {
    return true;
  }
  // Staging non-MTN: allow unsigned manual callbacks; production requires HMAC.
  return false;
}

export function webhookSignatureRequired(opts: {
  tier: DeploymentTier;
  authMode: WebhookAuthMode;
}): boolean {
  if (opts.authMode === "mtn_api_verify" || opts.authMode === "mock_lenient") {
    return false;
  }
  return opts.tier === "production";
}
