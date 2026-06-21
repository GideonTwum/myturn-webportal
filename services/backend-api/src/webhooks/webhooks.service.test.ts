import { describe, expect, it, vi, beforeEach } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { WebhooksService } from "./webhooks.service";

vi.mock("../common/platform-env", () => ({
  getDeploymentTier: vi.fn(() => "production"),
}));

vi.mock("./webhook-signature", () => ({
  verifyWebhookSignature: vi.fn(() => ({ valid: false, reason: "missing_signature" })),
}));

describe("WebhooksService.processInbound", () => {
  const idempotency = {
    runOnce: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => ({
      duplicate: false,
      value: await fn(),
    })),
  };
  const paymentRequests = {
    settleByExternalRef: vi.fn(),
  };
  const withdrawals = {
    applyDisbursementWebhook: vi.fn(),
  };

  let service: WebhooksService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WebhooksService(
      idempotency as never,
      paymentRequests as never,
      withdrawals as never,
    );
  });

  it("accepts MTN callback without x-signature in production", async () => {
    const result = await service.processInbound({
      provider: "mtn",
      body: { externalId: "unknown-ref", status: "PENDING" },
    });
    expect(result.accepted).toBe(true);
    expect(result.provider).toBe("mtn");
  });

  it("rejects non-MTN unsigned webhook in production", async () => {
    await expect(
      service.processInbound({
        provider: "internal",
        body: { externalRef: "x" },
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("deduplicates callbacks via idempotency", async () => {
    idempotency.runOnce.mockResolvedValueOnce({
      duplicate: true,
      value: { accepted: true, provider: "mtn", status: "logged" },
    });
    const result = await service.processInbound({
      provider: "mtn",
      body: { externalId: "dup-1" },
      idempotencyKey: "idem-1",
    });
    expect(result.accepted).toBe(true);
    expect(idempotency.runOnce).toHaveBeenCalledWith(
      "webhook:idem-1",
      86400,
      expect.any(Function),
    );
  });
});
