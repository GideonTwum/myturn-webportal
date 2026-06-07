import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { Prisma, WithdrawalActorRole, WithdrawalStatus } from "@prisma/client";
import { WithdrawalsService } from "./withdrawals.service";

describe("WithdrawalsService", () => {
  const allocation = {
    getMemberWalletSummary: vi.fn(),
    getAdminWalletSummary: vi.fn(),
    syncLegacyMemberWallet: vi.fn(),
  };
  const accounts = {
    getOrCreateMemberWallet: vi.fn(),
    getOrCreateAdminEarnings: vi.fn(),
    getOrCreateWithdrawalClearing: vi.fn(),
    getOrCreateSystemExternal: vi.fn(),
  };
  const posting = { postTransferInTx: vi.fn(), postJournalInTx: vi.fn() };
  const notifications = { create: vi.fn() };
  const audit = { append: vi.fn() };

  let prisma: {
    withdrawalRequest: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      findUniqueOrThrow: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  let svc: WithdrawalsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = {
      withdrawalRequest: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    svc = new WithdrawalsService(
      prisma as never,
      accounts as never,
      posting as never,
      allocation as never,
      notifications as never,
      audit as never,
    );
  });

  it("rejects withdrawal above available balance", async () => {
    allocation.getMemberWalletSummary.mockResolvedValue({
      availableBalance: "5.00",
      accountId: "acct-1",
    });

    await expect(
      svc.createMemberWithdrawal("user-1", "10.00", "233241234567"),
    ).rejects.toThrow(BadRequestException);
  });

  it("requires providerRef to confirm withdrawal", async () => {
    await expect(
      svc.confirmWithdrawal("wd-1", "hq-1", "  ", "manual"),
    ).rejects.toThrow(BadRequestException);
  });

  it("returns existing row when confirming already completed withdrawal", async () => {
    const row = {
      id: "wd-1",
      actorId: "user-1",
      actorRole: WithdrawalActorRole.MEMBER,
      amount: new Prisma.Decimal("10.00"),
      status: WithdrawalStatus.COMPLETED,
      momoNumber: "233241234567",
      provider: "manual",
      providerRef: "REF1",
      requestedAt: new Date(),
      processedAt: new Date(),
      failureReason: null,
      createdAt: new Date(),
    };
    prisma.withdrawalRequest.findUnique.mockResolvedValue(row);

    const result = await svc.confirmWithdrawal("wd-1", "hq-1", "REF2", "manual");
    expect(result.status).toBe("COMPLETED");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects fail on already completed withdrawal", async () => {
    prisma.withdrawalRequest.findUnique.mockResolvedValue({
      id: "wd-1",
      status: WithdrawalStatus.COMPLETED,
      ledgerAccountId: "acct-1",
      amount: new Prisma.Decimal("10.00"),
    });

    await expect(
      svc.failWithdrawal("wd-1", "hq-1", "Network error"),
    ).rejects.toThrow(BadRequestException);
  });
});
