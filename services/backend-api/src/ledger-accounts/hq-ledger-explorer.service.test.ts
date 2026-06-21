import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { LedgerAccountType, Prisma } from "@prisma/client";
import { HqLedgerExplorerService } from "./hq-ledger-explorer.service";

describe("HqLedgerExplorerService", () => {
  const prisma = {
    ledgerAccount: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    ledgerTransaction: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    user: { findMany: vi.fn() },
    group: { findMany: vi.fn() },
    payment: { findUnique: vi.fn() },
    payout: { findUnique: vi.fn() },
    withdrawalRequest: { findUnique: vi.fn() },
    $queryRaw: vi.fn(),
  };

  let svc: HqLedgerExplorerService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.ledgerAccount.groupBy.mockResolvedValue([
      {
        accountType: LedgerAccountType.MEMBER_WALLET_AVAILABLE,
        _sum: { balance: new Prisma.Decimal("100") },
        _count: { id: 1 },
      },
    ]);
    prisma.ledgerAccount.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    prisma.ledgerAccount.findMany.mockResolvedValue([
      {
        id: "acct-1",
        accountKey: "MEMBER_WALLET_AVAILABLE:u1:GHS",
        accountType: LedgerAccountType.MEMBER_WALLET_AVAILABLE,
        userId: "u1",
        groupId: null,
        currency: "GHS",
        balance: new Prisma.Decimal("100"),
        createdAt: new Date("2026-06-01T10:00:00.000Z"),
        updatedAt: new Date("2026-06-02T10:00:00.000Z"),
      },
    ]);
    prisma.user.findMany.mockResolvedValue([
      {
        id: "u1",
        email: "member@myturn.local",
        firstName: "Test",
        lastName: "Member",
        phone: "0244000001",
        role: "USER",
      },
    ]);
    prisma.group.findMany.mockResolvedValue([]);
    svc = new HqLedgerExplorerService(prisma as never);
  });

  it("lists ledger accounts with summary", async () => {
    const result = await svc.listAccounts({ limit: "50" });

    expect(result.summary.totalAccounts).toBe(3);
    expect(result.summary.nonZeroAccounts).toBe(2);
    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0]).toMatchObject({
      id: "acct-1",
      accountType: LedgerAccountType.MEMBER_WALLET_AVAILABLE,
      balanceGhs: "100.00",
      owner: { email: "member@myturn.local" },
    });
  });

  it("filters accounts by accountType", async () => {
    await svc.listAccounts({
      accountType: LedgerAccountType.GROUP_POOL,
      limit: "10",
    });

    expect(prisma.ledgerAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountType: LedgerAccountType.GROUP_POOL,
        }),
        take: 11,
      }),
    );
  });

  it("rejects unsupported accountType", async () => {
    await expect(
      svc.listAccounts({ accountType: "ADMIN_EARNINGS" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("lists transactions with reference filters", async () => {
    prisma.ledgerAccount.findMany.mockResolvedValueOnce([{ id: "acct-1" }]);
    prisma.ledgerTransaction.findMany.mockResolvedValue([
      {
        id: "tx-1",
        referenceType: "Payment",
        referenceId: "pay-1",
        description: "Contribution collected",
        idempotencyKey: "allocation:payment-request:pr1:1:inflow",
        metadata: { groupId: "g1" },
        createdAt: new Date("2026-06-03T10:00:00.000Z"),
        lines: [
          {
            id: "line-1",
            accountId: "acct-1",
            delta: new Prisma.Decimal("50"),
            balanceAfter: new Prisma.Decimal("50"),
            account: {
              id: "acct-1",
              accountType: LedgerAccountType.MEMBER_WALLET_AVAILABLE,
              userId: "u1",
              groupId: null,
              currency: "GHS",
            },
          },
          {
            id: "line-2",
            accountId: "acct-2",
            delta: new Prisma.Decimal("-50"),
            balanceAfter: new Prisma.Decimal("-50"),
            account: {
              id: "acct-2",
              accountType: LedgerAccountType.SYSTEM_EXTERNAL,
              userId: null,
              groupId: null,
              currency: "GHS",
            },
          },
        ],
      },
    ]);

    const result = await svc.listTransactions({
      referenceType: "Payment",
      referenceId: "pay-1",
      accountType: LedgerAccountType.MEMBER_WALLET_AVAILABLE,
      limit: "50",
    });

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toMatchObject({
      id: "tx-1",
      referenceType: "Payment",
      referenceId: "pay-1",
      lineCount: 2,
      totalMovementGhs: "50.00",
    });
    expect(prisma.ledgerTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          referenceType: "Payment",
          referenceId: "pay-1",
        }),
        take: 51,
      }),
    );
  });

  it("caps transaction list limit at 200", async () => {
    prisma.ledgerTransaction.findMany.mockResolvedValue([]);
    await svc.listTransactions({ limit: "999" });

    expect(prisma.ledgerTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 201 }),
    );
  });

  it("returns transaction detail with lines and sanitized metadata", async () => {
    prisma.ledgerTransaction.findUnique.mockResolvedValue({
      id: "tx-1",
      referenceType: "Payment",
      referenceId: "pay-1",
      description: "Contribution collected",
      idempotencyKey: "allocation:payment-request:pr1:1:inflow",
      metadata: { apiKey: "secret", groupId: "g1" },
      createdAt: new Date("2026-06-03T10:00:00.000Z"),
      lines: [
        {
          id: "line-1",
          accountId: "acct-1",
          delta: new Prisma.Decimal("50"),
          balanceAfter: new Prisma.Decimal("50"),
          account: {
            id: "acct-1",
            accountType: LedgerAccountType.MEMBER_WALLET_AVAILABLE,
            userId: "u1",
            groupId: null,
            currency: "GHS",
          },
        },
      ],
    });
    prisma.user.findMany.mockResolvedValue([
      {
        id: "u1",
        email: "member@myturn.local",
        firstName: "Test",
        lastName: "Member",
        phone: "0244000001",
        role: "USER",
      },
    ]);
    prisma.payment.findUnique.mockResolvedValue({
      id: "pay-1",
      amount: new Prisma.Decimal("50"),
      type: "CONTRIBUTION",
      status: "COMPLETED",
      userId: "u1",
      groupId: "g1",
      externalRef: "mock_1",
      completedAt: new Date(),
    });

    const result = await svc.getTransactionDetail("tx-1");

    expect(result.transaction.metadata).toEqual({
      apiKey: "[REDACTED]",
      groupId: "g1",
    });
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({
      direction: "CREDIT",
      amountGhs: "50.00",
      balanceAfterGhs: "50.00",
    });
    expect(result.related.payment).toMatchObject({ id: "pay-1" });
  });

  it("throws when transaction detail is missing", async () => {
    prisma.ledgerTransaction.findUnique.mockResolvedValue(null);
    await expect(svc.getTransactionDetail("missing")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("searches accounts by member name", async () => {
    prisma.user.findMany.mockResolvedValueOnce([{ id: "u-search" }]);
    prisma.group.findMany.mockResolvedValueOnce([]);

    await svc.listAccounts({ search: "Ama Mensah", limit: "50" });

    expect(prisma.user.findMany).toHaveBeenCalled();
    expect(prisma.ledgerAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { userId: { in: ["u-search"] } },
          ]),
        }),
      }),
    );
  });

  it("searches accounts by phone number", async () => {
    prisma.user.findMany.mockResolvedValueOnce([{ id: "u-phone" }]);
    prisma.group.findMany.mockResolvedValueOnce([]);

    await svc.listAccounts({ search: "0244123456", limit: "50" });

    expect(prisma.user.findMany).toHaveBeenCalled();
    expect(prisma.ledgerAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { userId: { in: ["u-phone"] } },
          ]),
        }),
      }),
    );
  });

  it("searches accounts by group name", async () => {
    prisma.user.findMany.mockResolvedValueOnce([]);
    prisma.group.findMany.mockResolvedValueOnce([{ id: "g-search" }]);

    await svc.listAccounts({ search: "Savings Circle", limit: "50" });

    expect(prisma.group.findMany).toHaveBeenCalled();
    expect(prisma.ledgerAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { groupId: { in: ["g-search"] } },
          ]),
        }),
      }),
    );
  });

  it("searches transactions by referenceId and metadata", async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.group.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([{ id: "tx-meta" }]);
    prisma.ledgerAccount.findMany.mockResolvedValue([]);
    prisma.ledgerTransaction.findMany.mockResolvedValue([]);

    await svc.listTransactions({ search: "pay-unique-99", limit: "50" });

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.ledgerTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { referenceId: { contains: "pay-unique-99", mode: "insensitive" } },
            { id: { in: ["tx-meta"] } },
          ]),
        }),
      }),
    );
  });

  it("searches transactions by group-linked ledger accounts", async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.group.findMany.mockResolvedValue([{ id: "g1" }]);
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.ledgerAccount.findMany.mockResolvedValue([{ id: "acct-g1" }]);
    prisma.ledgerTransaction.findMany.mockResolvedValue([]);

    await svc.listTransactions({ search: "MT-SAVE", limit: "50" });

    expect(prisma.ledgerTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            {
              lines: { some: { accountId: { in: ["acct-g1"] } } },
            },
          ]),
        }),
      }),
    );
  });
});
