import { describe, expect, it, vi, beforeEach } from "vitest";
import { DepositStatus, PayoutMode, Prisma } from "@prisma/client";
import { CycleDepositsService } from "./cycle-deposits.service";

describe("CycleDepositsService", () => {
  const accounts = {
    getOrCreateSystemExternal: vi.fn(),
    getOrCreateMemberDepositEscrow: vi.fn(),
    getOrCreateMemberWalletAvailable: vi.fn(),
    getOrCreateGroupPool: vi.fn(),
  };
  const posting = { postTransferInTx: vi.fn() };
  const prisma = { wallet: { findUnique: vi.fn(), update: vi.fn() } };

  let svc: CycleDepositsService;

  beforeEach(() => {
    vi.clearAllMocks();
    accounts.getOrCreateSystemExternal.mockResolvedValue({ id: "ext" });
    accounts.getOrCreateMemberDepositEscrow.mockResolvedValue({ id: "escrow" });
    accounts.getOrCreateMemberWalletAvailable.mockResolvedValue({ id: "avail" });
    accounts.getOrCreateGroupPool.mockResolvedValue({ id: "pool" });
    posting.postTransferInTx.mockResolvedValue({});
    prisma.wallet.findUnique.mockResolvedValue(null);

    svc = new CycleDepositsService(
      prisma as never,
      accounts as never,
      posting as never,
    );
  });

  it("posts deposit hold to MEMBER_DEPOSIT_ESCROW on CYCLE join", async () => {
    const tx = {
      payment: { create: vi.fn().mockResolvedValue({ id: "pay-1" }) },
      wallet: { findUnique: vi.fn().mockResolvedValue(null) },
    };

    const result = await svc.applyDepositOnJoin(tx as never, {
      userId: "u1",
      groupId: "g1",
      memberId: "m1",
      group: {
        contributionAmount: new Prisma.Decimal("10"),
        daysPerCycle: 30,
        payoutMode: PayoutMode.CYCLE,
        name: "Test Group",
      },
    });

    expect(result.depositStatus).toBe(DepositStatus.HELD);
    expect(result.depositAmount.toString()).toBe("300");
    expect(posting.postTransferInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        fromAccountId: "ext",
        toAccountId: "escrow",
        amount: new Prisma.Decimal("300"),
        referenceType: "Deposit",
      }),
    );
  });

  it("skips deposit for DAILY groups", async () => {
    const tx = { payment: { create: vi.fn() } };
    const result = await svc.applyDepositOnJoin(tx as never, {
      userId: "u1",
      groupId: "g1",
      memberId: "m1",
      group: {
        contributionAmount: new Prisma.Decimal("10"),
        daysPerCycle: 30,
        payoutMode: PayoutMode.DAILY,
        name: "Daily",
      },
    });

    expect(result.depositStatus).toBe(DepositStatus.NOT_REQUIRED);
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(posting.postTransferInTx).not.toHaveBeenCalled();
  });
});
