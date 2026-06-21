import { describe, expect, it } from "vitest";
import {
  getWebhookAuthMode,
  isMtnWebhookProvider,
  shouldRejectWebhook,
  webhookSignatureRequired,
} from "./webhook-auth";

describe("webhook-auth", () => {
  it("detects MTN webhook providers", () => {
    expect(isMtnWebhookProvider("mtn")).toBe(true);
    expect(isMtnWebhookProvider("mtn-disbursement")).toBe(true);
    expect(isMtnWebhookProvider("vodafone")).toBe(false);
  });

  it("uses MTN API verify mode for MTN callbacks", () => {
    expect(getWebhookAuthMode("mtn")).toBe("mtn_api_verify");
    expect(getWebhookAuthMode("mtn-disbursement")).toBe("mtn_api_verify");
  });

  it("accepts MTN callback without x-signature in staging and production", () => {
    expect(
      shouldRejectWebhook({
        tier: "staging",
        authMode: "mtn_api_verify",
        signature: { valid: false, reason: "missing_signature" },
      }),
    ).toBe(false);
    expect(
      shouldRejectWebhook({
        tier: "production",
        authMode: "mtn_api_verify",
        signature: { valid: false, reason: "missing_signature" },
      }),
    ).toBe(false);
  });

  it("rejects non-MTN unsigned webhooks in production", () => {
    expect(
      shouldRejectWebhook({
        tier: "production",
        authMode: "hmac_required",
        signature: { valid: false, reason: "missing_signature" },
      }),
    ).toBe(true);
  });

  it("allows staging unsigned non-MTN for manual testing", () => {
    expect(
      shouldRejectWebhook({
        tier: "staging",
        authMode: "hmac_required",
        signature: { valid: false, reason: "missing_signature" },
      }),
    ).toBe(false);
  });

  it("does not require HMAC for MTN providers", () => {
    expect(
      webhookSignatureRequired({
        tier: "production",
        authMode: "mtn_api_verify",
      }),
    ).toBe(false);
  });
});
