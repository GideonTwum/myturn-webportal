import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentRequestStatus, UserRole } from "@prisma/client";
import { PaymentRequestsService } from "./payment-requests.service";

describe("PaymentRequestsService settlement", () => {
  const prisma = {
    paymentRequest: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  const idempotency = {
    runOnce: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => ({
      duplicate: false,
      value: await fn(),
    })),
  };
  const payments = {
    recordContributionPayment: vi.fn(),
  };
  const intents = {
    transitionIntent: vi.fn(),
    metadataPatch: vi.fn((_m: unknown, patch: unknown) => patch),
  };

  let svc: PaymentRequestsService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new PaymentRequestsService(
      prisma as never,
      { assertCanParticipateFinancially: vi.fn() } as never,
      payments as never,
      idempotency as never,
      intents as never,
    );
  });

  it("settles approved payment idempotently preserving metadata", async () => {
    const req = {
      id: "pr-1",
      userId: "user-1",
      contributionId: "c-1",
      externalRef: "ext-ref-1",
      metadata: { provider: "mtn-momo", channel: "momo" },
      amount: { toString: () => "25.00" },
      providerRef: "mtn-ref-1",
      status: PaymentRequestStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
    };
    prisma.paymentRequest.findUnique.mockResolvedValue(req);
    prisma.paymentRequest.update.mockResolvedValue({
      ...req,
      status: PaymentRequestStatus.APPROVED,
    });

    const first = await svc.settleByExternalRef("ext-ref-1", "APPROVED");
    expect(first.settled).toBe(true);
    expect(payments.recordContributionPayment).toHaveBeenCalledWith(
      "c-1",
      "user-1",
      UserRole.USER,
      expect.objectContaining({
        provider: "mtn-momo",
        externalRef: "ext-ref-1",
        paymentRequestId: "pr-1",
        mock: false,
      }),
    );

    prisma.paymentRequest.findUnique.mockResolvedValue({
      ...req,
      status: PaymentRequestStatus.APPROVED,
    });
    const second = await svc.settleByExternalRef("ext-ref-1", "APPROVED");
    expect(second.settled).toBe(false);
    expect(payments.recordContributionPayment).toHaveBeenCalledTimes(1);
  });
});
