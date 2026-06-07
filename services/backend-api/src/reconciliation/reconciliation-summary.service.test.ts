import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { ReconciliationSummaryService } from "./reconciliation-summary.service";

describe("ReconciliationSummaryService", () => {
  const accounts = {
    getOrCreatePlatformFloat: vi.fn(),
    getOrCreateMyturnRevenue: vi.fn(),
    getOrCreateWithdrawalClearing: vi.fn(),
  };

  const prisma = {
    ledgerAccount: { aggregate: vi.fn(), findMany: vi.fn() },
    payment: { aggregate: vi.fn() },
    withdrawalRequest: { aggregate: vi.fn(), count: vi.fn() },
    adminEarning: { aggregate: vi.fn() },
    payout: { groupBy: vi.fn(), findMany: vi.fn() },
    ledgerTransaction: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  };

  let svc: ReconciliationSummaryService;

  beforeEach(() => {
    vi.clearAllMocks();
    accounts.getOrCreatePlatformFloat.mockResolvedValue({ balance: new Prisma.Decimal("0") });
    accounts.getOrCreateMyturnRevenue.mockResolvedValue({ balance: new Prisma.Decimal("40") });
    accounts.getOrCreateWithdrawalClearing.mockResolvedValue({ balance: new Prisma.Decimal("0") });

    prisma.ledgerAccount.aggregate.mockImplementation(({ where }: { where: { accountType: string } }) => {
      if (where.accountType === "MEMBER_WALLET") return { _sum: { balance: new Prisma.Decimal("100") } };
      if (where.accountType === "ADMIN_EARNINGS") return { _sum: { balance: new Prisma.Decimal("60") } };
      if (where.accountType === "GROUP_POOL") return { _sum: { balance: new Prisma.Decimal("200") } };
      return { _sum: { balance: new Prisma.Decimal("0") } };
    });
    prisma.ledgerAccount.findMany.mockResolvedValue([]);
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal("500") } });
    prisma.withdrawalRequest.aggregate.mockResolvedValue({ _sum: { amount: null }, _count: { id: 0 } });
    prisma.adminEarning.aggregate.mockResolvedValue({
      _sum: {
        marginAmount: new Prisma.Decimal("100"),
        adminShareAmount: new Prisma.Decimal("60"),
        platformShareAmount: new Prisma.Decimal("40"),
      },
    });
    prisma.withdrawalRequest.count.mockResolvedValue(0);
    prisma.payout.groupBy.mockResolvedValue([]);
    prisma.payout.findMany.mockResolvedValue([]);
    prisma.ledgerTransaction.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);

    svc = new ReconciliationSummaryService(prisma as never, accounts as never);
  });

  it("returns ok when no discrepancies detected", async () => {
    const summary = await svc.getSummary();
    expect(summary.status).toBe("ok");
    expect(summary.totalCollected).toBe("500.00");
    expect(summary.discrepancies).toEqual([]);
  });

  it("flags negative group pool aggregate", async () => {
    prisma.ledgerAccount.aggregate.mockImplementation(({ where }: { where: { accountType: string } }) => {
      if (where.accountType === "GROUP_POOL") return { _sum: { balance: new Prisma.Decimal("-5") } };
      return { _sum: { balance: new Prisma.Decimal("0") } };
    });

    const summary = await svc.getSummary();
    expect(summary.status).toBe("discrepancies_detected");
    expect(summary.discrepancies.some((d) => d.includes("Group pool"))).toBe(true);
  });

  it("flags completed withdrawals missing providerRef", async () => {
    prisma.withdrawalRequest.count.mockResolvedValue(2);

    const summary = await svc.getSummary();
    expect(summary.discrepancies.some((d) => d.includes("providerRef"))).toBe(true);
  });
});
