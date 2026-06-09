import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { ContributionStatus, GroupStatus, UserRole } from "@prisma/client";
import { PaymentsService } from "./payments.service";

describe("PaymentsService live settlement guards", () => {
  const env = { ...process.env };
  const prisma = {
    contribution: {
      findUnique: vi.fn(),
    },
  };
  const allocation = { recordContributionSettlement: vi.fn() };
  const participation = { assertCanParticipateFinancially: vi.fn() };

  let svc: PaymentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PAYMENT_PROVIDER = "mtn-momo";
    prisma.contribution.findUnique.mockResolvedValue({
      id: "c-1",
      userId: "user-1",
      paidDayCount: 0,
      expectedDayCount: 10,
      cycleNumber: 1,
      status: ContributionStatus.PENDING,
      group: {
        id: "g-1",
        adminId: "admin-1",
        status: GroupStatus.ACTIVE,
        currentCycle: 1,
        contributionAmount: "25",
        name: "Test",
      },
      user: { id: "user-1" },
    });
    participation.assertCanParticipateFinancially.mockResolvedValue(undefined);
    svc = new PaymentsService(
      prisma as never,
      allocation as never,
      { create: vi.fn() } as never,
      { append: vi.fn() } as never,
      { syncGroupCompliance: vi.fn() } as never,
      participation as never,
    );
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it("rejects mock flag when live MTN provider is configured", async () => {
    await expect(
      svc.recordContributionPayment("c-1", "user-1", UserRole.USER, {
        mock: true,
        provider: "mock",
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("requires externalRef and paymentRequestId for live settlement", async () => {
    await expect(
      svc.recordContributionPayment("c-1", "user-1", UserRole.USER, {
        mock: false,
        provider: "mtn-momo",
      }),
    ).rejects.toThrow(/externalRef/);
  });
});
