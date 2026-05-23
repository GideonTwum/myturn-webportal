import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "./webhook-signature";

describe("verifyWebhookSignature", () => {
  it("validates matching HMAC", () => {
    const secret = "test-secret";
    const raw = JSON.stringify({ externalRef: "pay-1" });
    const sig = createHmac("sha256", secret).update(raw).digest("hex");
    process.env.WEBHOOK_SECRET = secret;
    const result = verifyWebhookSignature({
      provider: "mtn",
      rawBody: raw,
      signature: sig,
      secret,
    });
    expect(result.valid).toBe(true);
    delete process.env.WEBHOOK_SECRET;
  });

  it("rejects missing signature", () => {
    const result = verifyWebhookSignature({
      provider: "mtn",
      rawBody: "{}",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("missing_signature");
  });
});
