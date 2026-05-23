import { createHmac, timingSafeEqual } from "crypto";

export type SignatureVerifyResult = {
  valid: boolean;
  reason?: string;
};

/**
 * HMAC-SHA256 signature verification skeleton for PSP webhooks.
 */
export function verifyWebhookSignature(opts: {
  provider: string;
  rawBody: string;
  signature?: string;
  secret?: string;
}): SignatureVerifyResult {
  const secret =
    opts.secret ??
    process.env[`WEBHOOK_SECRET_${opts.provider.toUpperCase()}`]?.trim() ??
    process.env.WEBHOOK_SECRET?.trim();

  if (!opts.signature) {
    return { valid: false, reason: "missing_signature" };
  }
  if (!secret) {
    return { valid: false, reason: "secret_not_configured" };
  }

  const expected = createHmac("sha256", secret)
    .update(opts.rawBody)
    .digest("hex");
  const provided = opts.signature.replace(/^sha256=/i, "").trim();

  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(provided, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { valid: false, reason: "signature_mismatch" };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: "compare_failed" };
  }
}
