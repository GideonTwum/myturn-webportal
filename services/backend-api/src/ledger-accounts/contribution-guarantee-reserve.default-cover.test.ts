import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ContributionGuaranteeReserveStatus,
  ContributionStatus,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { ContributionGuaranteeReserveService } from "./contribution-guarantee-reserve.service";

vi.mock("../config/contribution-reserve.config", () => ({
  getContributionReserveConfig: () => ({
    enabled: true,
    maxBps: 3000,
    minBps: 0,
  }),
}));

describe("ContributionGuaranteeReserveService.coverDefaultFromReserveInTx", () => {
  let posting: { postTransferInTx: ReturnType<typeof vi.fn> };
  let accounts: {
    getOrCreateMemberWalletReserved: ReturnType<typeof vi.fn>;
    getOrCreateGroupPool: ReturnType<typeof vi.fn>;
  };
  let svc: ContributionGuaranteeReserveService;

  beforeEach(() => {
    posting = {
      postTransferInTx: vi.fn().mockResolvedValue({ duplicate: false }),
    };
    accounts = {
      getOrCreateMemberWalletReserved: vi
        .fn()
        .mockResolvedValue({ id: "reserved-acct" }),
      getOrCreateGroupPool: vi.fn().mockResolvedValue({ id: "pool-acct" }),
    };
    svc = new ContributionGuaranteeReserveService(
      {} as never,
      accounts as never,
      posting as never,
      { create: vi.fn() } as never,
    );
  });

  it("transfers reserved funds to group pool without releasing to available wallet", async () => {
    const tx = {
      contribution: {
        findUnique: vi.fn().mockResolvedValue({
          id: "c1",
          userId: "u1",
          groupId: "g1",
          amount: new Prisma.Decimal("1000.00"),
          expectedDayCount: 10,
          paidDayCount: 0,
          status: ContributionStatus.PENDING,
        }),
        update: vi.fn(),
      },
      contributionGuaranteeReserve: {
        findFirst: vi.fn().mockResolvedValue({
          id: "r1",
          remainingReserveAmount: new Prisma.Decimal("18000.00"),
          usedForDefaultAmount: new Prisma.Decimal(0),
        }),
        update: vi.fn(),
      },
      defaultCoverage: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    };

    const result = await svc.coverDefaultFromReserveInTx(tx as never, {
      userId: "u1",
      groupId: "g1",
      contributionId: "c1",
    });

    expect(result.covered).toBe(true);
    expect(result.fullyCovered).toBe(true);
    expect(posting.postTransferInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        fromAccountId: "reserved-acct",
        toAccountId: "pool-acct",
        idempotencyKey: "reserve:default-cover:r1:contribution:c1",
        metadata: expect.objectContaining({ reason: "DEFAULT_COVER" }),
      }),
    );
    expect(tx.contribution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ContributionStatus.PAID }),
      }),
    );
  });

  it("is idempotent for the same contribution", async () => {
    const tx = {
      contribution: {
        findUnique: vi.fn().mockResolvedValue({
          id: "c1",
          userId: "u1",
          groupId: "g1",
          amount: new Prisma.Decimal("500.00"),
          expectedDayCount: 1,
          paidDayCount: 0,
          status: ContributionStatus.PENDING,
        }),
      },
      contributionGuaranteeReserve: {
        findFirst: vi.fn().mockResolvedValue({
          id: "r1",
          remainingReserveAmount: new Prisma.Decimal("1000.00"),
          usedForDefaultAmount: new Prisma.Decimal(0),
        }),
      },
      defaultCoverage: {
        findUnique: vi.fn().mockResolvedValue({
          coveredAmount: new Prisma.Decimal("500.00"),
          missedAmount: new Prisma.Decimal("500.00"),
        }),
      },
    };

    const result = await svc.coverDefaultFromReserveInTx(tx as never, {
      userId: "u1",
      groupId: "g1",
      contributionId: "c1",
    });

    expect(result.duplicate).toBe(true);
    expect(posting.postTransferInTx).not.toHaveBeenCalled();
  });
});
