import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
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
    getOrCreateMemberWalletAvailable: vi.fn(),
    getOrCreateAdminEarnings: vi.fn(),
    getOrCreateWithdrawalClearing: vi.fn(),
    getOrCreateSystemExternal: vi.fn(),
  };
  const posting = { postTransferInTx: vi.fn(), postJournalInTx: vi.fn() };
  const notifications = { create: vi.fn() };
  const audit = { append: vi.fn() };
  const participation = { assertCanParticipateFinancially: vi.fn() };
  const idempotency = {
    runOnce: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => ({
      duplicate: false,
      value: await fn(),
    })),
  };

  let prisma: {
    withdrawalRequest: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findUniqueOrThrow: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    groupMember: { findMany: ReturnType<typeof vi.fn> };
    user: { findMany: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };

  let svc: WithdrawalsService;
  const prevDisbursement = process.env.DISBURSEMENT_PROVIDER;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DISBURSEMENT_PROVIDER = "mock";

    prisma = {
      withdrawalRequest: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      groupMember: { findMany: vi.fn() },
      user: { findMany: vi.fn() },
      $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
    };

    allocation.getMemberWalletSummary.mockResolvedValue({
      availableBalance: "100.00",
      accountId: "acct-member",
    });
    allocation.getAdminWalletSummary.mockResolvedValue({
      availableBalance: "50.00",
      accountId: "acct-admin",
    });
    accounts.getOrCreateMemberWallet.mockResolvedValue({ id: "wallet-member" });
    accounts.getOrCreateMemberWalletAvailable.mockResolvedValue({
      id: "wallet-member-available",
    });
    accounts.getOrCreateAdminEarnings.mockResolvedValue({ id: "wallet-admin" });
    accounts.getOrCreateWithdrawalClearing.mockResolvedValue({ id: "clearing" });
    accounts.getOrCreateSystemExternal.mockResolvedValue({ id: "external" });
    participation.assertCanParticipateFinancially.mockResolvedValue(undefined);
    prisma.withdrawalRequest.findMany.mockResolvedValue([]);

    svc = new WithdrawalsService(
      prisma as never,
      accounts as never,
      posting as never,
      allocation as never,
      notifications as never,
      audit as never,
      participation as never,
      idempotency as never,
    );
  });

  afterEach(() => {
    process.env.DISBURSEMENT_PROVIDER = prevDisbursement;
  });

  function baseRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "wd-1",
      actorId: "user-1",
      actorRole: WithdrawalActorRole.MEMBER,
      ledgerAccountId: "wallet-member",
      amount: new Prisma.Decimal("25.00"),
      status: WithdrawalStatus.PENDING,
      momoNumber: "233241234567",
      provider: null,
      providerRef: null,
      requestedAt: new Date(),
      processedAt: null,
      failureReason: null,
      createdAt: new Date(),
      metadata: { automatic: true },
      ...overrides,
    };
  }

  it("allows member withdrawal up to full available balance when no platform cap", async () => {
    allocation.getMemberWalletSummary.mockResolvedValue({
      availableBalance: "42000.00",
      reservedBalance: "18000.00",
      accountId: "acct-member",
    });

    const pending = baseRow({
      amount: new Prisma.Decimal("42000.00"),
    });
    const processing = baseRow({
      amount: new Prisma.Decimal("42000.00"),
      status: WithdrawalStatus.PROCESSING,
      provider: "mock-disbursement",
      providerRef: "disb-mock-wd-1",
    });
    const completed = baseRow({
      amount: new Prisma.Decimal("42000.00"),
      status: WithdrawalStatus.COMPLETED,
      provider: "mock-disbursement",
      providerRef: "disb-mock-wd-1",
      processedAt: new Date(),
    });

    prisma.withdrawalRequest.create.mockResolvedValue(pending);
    prisma.withdrawalRequest.findUnique.mockImplementation(async () => processing);
    prisma.withdrawalRequest.findFirst.mockResolvedValue(processing);
    prisma.withdrawalRequest.findUniqueOrThrow.mockImplementation(async () => {
      const u = prisma.withdrawalRequest.update.mock.calls.length;
      return u > 1 ? completed : processing;
    });
    prisma.withdrawalRequest.update
      .mockResolvedValueOnce(processing)
      .mockResolvedValueOnce(completed);

    const result = await svc.createMemberWithdrawal(
      "user-1",
      "42000.00",
      "233241234567",
    );

    expect(result.status).toBe("COMPLETED");
    expect(result.amount.toString()).toBe("42000");
  });

  it("rejects member withdrawal above available balance", async () => {
    allocation.getMemberWalletSummary.mockResolvedValue({
      availableBalance: "42000.00",
      reservedBalance: "18000.00",
      accountId: "acct-member",
    });

    await expect(
      svc.createMemberWithdrawal("user-1", "42001.00", "233241234567"),
    ).rejects.toThrow(/Contribution Guarantee Reserve/);
  });

  it("requires verified member before disbursement", async () => {
    participation.assertCanParticipateFinancially.mockRejectedValue(
      new ForbiddenException("Verify Ghana Card"),
    );

    await expect(
      svc.createMemberWithdrawal("user-1", "10.00", "233241234567"),
    ).rejects.toThrow(ForbiddenException);
  });

  it("auto-starts member disbursement and completes in mock mode", async () => {
    const pending = baseRow();
    const processing = baseRow({
      status: WithdrawalStatus.PROCESSING,
      provider: "mock-disbursement",
      providerRef: "disb-mock-wd-1",
    });
    const completed = baseRow({
      status: WithdrawalStatus.COMPLETED,
      provider: "mock-disbursement",
      providerRef: "disb-mock-wd-1",
      processedAt: new Date(),
    });

    prisma.withdrawalRequest.create.mockResolvedValue(pending);
    prisma.withdrawalRequest.findUnique.mockImplementation(async () => processing);
    prisma.withdrawalRequest.findFirst.mockResolvedValue(processing);
    prisma.withdrawalRequest.findUniqueOrThrow.mockImplementation(async () => {
      const u = prisma.withdrawalRequest.update.mock.calls.length;
      return u > 1 ? completed : processing;
    });
    prisma.withdrawalRequest.update
      .mockResolvedValueOnce(processing)
      .mockResolvedValueOnce(completed);

    const result = await svc.createMemberWithdrawal(
      "user-1",
      "25.00",
      "233241234567",
    );

    expect(posting.postTransferInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey: "withdrawal:hold:wd-1",
        description: "Withdrawal hold",
      }),
    );
    expect(result.status).toBe("COMPLETED");
    expect(result.providerRef).toBe("disb-mock-wd-1");
    expect(posting.postJournalInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey: "withdrawal:complete:wd-1",
      }),
    );
  });

  it("returns funds when provider transfer fails immediately", async () => {
    const pending = baseRow();
    prisma.withdrawalRequest.create.mockResolvedValue(pending);
    prisma.withdrawalRequest.findUnique.mockResolvedValue(pending);

    const original = process.env.DISBURSEMENT_PROVIDER;
    process.env.DISBURSEMENT_PROVIDER = "mtn-momo";
    const mtnSvc = new WithdrawalsService(
      prisma as never,
      accounts as never,
      posting as never,
      allocation as never,
      notifications as never,
      audit as never,
      participation as never,
      idempotency as never,
    );
    process.env.DISBURSEMENT_PROVIDER = original;

    const processing = baseRow({ status: WithdrawalStatus.PROCESSING });
    const failed = baseRow({
      status: WithdrawalStatus.FAILED,
      failureReason: "MTN MoMo disbursement not configured",
      processedAt: new Date(),
    });
    prisma.withdrawalRequest.findUnique.mockImplementation(async () => processing);
    prisma.withdrawalRequest.findUniqueOrThrow.mockResolvedValue(processing);
    prisma.withdrawalRequest.update.mockResolvedValue(failed);

    const result = await mtnSvc.createMemberWithdrawal(
      "user-1",
      "25.00",
      "233241234567",
    );

    expect(result.status).toBe("FAILED");
    expect(posting.postTransferInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey: "withdrawal:release:wd-1",
      }),
    );
  });

  it("settles disbursement webhook idempotently", async () => {
    const processing = baseRow({
      status: WithdrawalStatus.PROCESSING,
      provider: "mock-disbursement",
      providerRef: "disb-mock-wd-1",
    });
    const completed = baseRow({
      status: WithdrawalStatus.COMPLETED,
      providerRef: "disb-mock-wd-1",
      processedAt: new Date(),
    });

    prisma.withdrawalRequest.findFirst.mockResolvedValue(processing);
    prisma.withdrawalRequest.findUniqueOrThrow.mockResolvedValue(processing);
    prisma.withdrawalRequest.findUnique
      .mockResolvedValueOnce(processing)
      .mockResolvedValueOnce(completed);
    prisma.withdrawalRequest.update.mockResolvedValue(completed);

    const first = await svc.settleByProviderRef("disb-mock-wd-1", "COMPLETED");
    expect(first.settled).toBe(true);

    prisma.withdrawalRequest.findFirst.mockResolvedValue(completed);
    const second = await svc.settleByProviderRef("disb-mock-wd-1", "COMPLETED");
    expect(second.duplicate).toBe(true);
    expect(posting.postJournalInTx).toHaveBeenCalledTimes(1);
  });

  it("returns funds on failed disbursement webhook", async () => {
    const processing = baseRow({
      status: WithdrawalStatus.PROCESSING,
      providerRef: "disb-mock-wd-1",
    });
    const failed = baseRow({
      status: WithdrawalStatus.FAILED,
      failureReason: "MoMo failed",
      processedAt: new Date(),
    });

    prisma.withdrawalRequest.findFirst.mockResolvedValue(processing);
    prisma.withdrawalRequest.findUnique.mockResolvedValue(processing);
    prisma.withdrawalRequest.findUniqueOrThrow.mockResolvedValue(processing);
    prisma.withdrawalRequest.update.mockResolvedValue(failed);

    const result = await svc.settleByProviderRef(
      "disb-mock-wd-1",
      "FAILED",
      "MoMo failed",
    );
    expect(result.status).toBe("FAILED");
    expect(posting.postTransferInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey: "withdrawal:release:wd-1",
      }),
    );
  });

  it("rejects HQ manual override when withdrawal is not PROCESSING", async () => {
    prisma.withdrawalRequest.findUnique.mockResolvedValue(
      baseRow({ status: WithdrawalStatus.COMPLETED }),
    );

    await expect(
      svc.assertHqManualOverride("hq-1", "wd-1"),
    ).rejects.toThrow(ForbiddenException);
  });

  it("rejects new admin earnings withdrawals (deprecated)", async () => {
    await expect(
      svc.createAdminWithdrawal("admin-1", "25.00", "233241234567"),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.withdrawalRequest.create).not.toHaveBeenCalled();
  });

  it("webhook success completes admin earnings withdrawal", async () => {
    const processing = baseRow({
      actorRole: WithdrawalActorRole.ADMIN,
      actorId: "admin-1",
      ledgerAccountId: "wallet-admin",
      status: WithdrawalStatus.PROCESSING,
      providerRef: "disb-mock-wd-1",
    });
    const completed = baseRow({
      actorRole: WithdrawalActorRole.ADMIN,
      actorId: "admin-1",
      ledgerAccountId: "wallet-admin",
      status: WithdrawalStatus.COMPLETED,
      providerRef: "disb-mock-wd-1",
      processedAt: new Date(),
    });

    prisma.withdrawalRequest.findFirst.mockResolvedValue(processing);
    prisma.withdrawalRequest.findUniqueOrThrow.mockResolvedValue(processing);
    prisma.withdrawalRequest.findUnique
      .mockResolvedValueOnce(processing)
      .mockResolvedValueOnce(completed);
    prisma.withdrawalRequest.update.mockResolvedValue(completed);

    const result = await svc.settleByProviderRef("disb-mock-wd-1", "COMPLETED");
    expect(result.settled).toBe(true);
    expect(posting.postJournalInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey: "withdrawal:complete:wd-1",
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      "admin-1",
      "Earnings withdrawal completed",
      expect.stringContaining("MoMo wallet"),
      "WITHDRAWAL_COMPLETED",
      expect.anything(),
    );
  });

  it("webhook failure returns admin funds to ADMIN_EARNINGS", async () => {
    const processing = baseRow({
      actorRole: WithdrawalActorRole.ADMIN,
      actorId: "admin-1",
      ledgerAccountId: "wallet-admin",
      status: WithdrawalStatus.PROCESSING,
      providerRef: "disb-mock-wd-1",
    });
    const failed = baseRow({
      actorRole: WithdrawalActorRole.ADMIN,
      actorId: "admin-1",
      ledgerAccountId: "wallet-admin",
      status: WithdrawalStatus.FAILED,
      failureReason: "MoMo failed",
      processedAt: new Date(),
    });

    prisma.withdrawalRequest.findFirst.mockResolvedValue(processing);
    prisma.withdrawalRequest.findUnique.mockResolvedValue(processing);
    prisma.withdrawalRequest.findUniqueOrThrow.mockResolvedValue(processing);
    prisma.withdrawalRequest.update.mockResolvedValue(failed);

    const result = await svc.settleByProviderRef(
      "disb-mock-wd-1",
      "FAILED",
      "MoMo failed",
    );
    expect(result.status).toBe("FAILED");
    expect(posting.postTransferInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey: "withdrawal:release:wd-1",
        toAccountId: "wallet-admin",
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      "admin-1",
      "Earnings withdrawal failed",
      expect.stringContaining("admin earnings wallet"),
      "WITHDRAWAL_FAILED",
      expect.anything(),
    );
  });

  it("requires providerRef for HQ manual override confirm", async () => {
    prisma.withdrawalRequest.findUnique.mockResolvedValue(
      baseRow({
        actorRole: WithdrawalActorRole.ADMIN,
        status: WithdrawalStatus.PROCESSING,
      }),
    );

    await expect(
      svc.confirmWithdrawal("wd-1", "hq-1", "  ", "manual-override"),
    ).rejects.toThrow(BadRequestException);
  });
});
