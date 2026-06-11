import { describe, expect, it, vi, beforeEach } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { HqFinancialService } from "./hq-financial.service";

describe("HqFinancialService", () => {
  const prisma = {
    user: { count: vi.fn() },
    adminRequest: { count: vi.fn() },
    adminEarning: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    payout: {
      aggregate: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    ledgerAccount: { findFirst: vi.fn() },
    groupMember: { findMany: vi.fn() },
    group: { findMany: vi.fn(), count: vi.fn() },
  };

  let svc: HqFinancialService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new HqFinancialService(prisma as never);
  });

  describe("getFinancialOverview", () => {
    beforeEach(() => {
      prisma.adminEarning.aggregate.mockResolvedValue({
        _sum: {
          marginAmount: new Decimal("1000"),
          adminShareAmount: new Decimal("50"),
          platformShareAmount: new Decimal("950"),
        },
      });
      prisma.payout.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal("5000") },
      });
      prisma.payout.count.mockResolvedValue(12);
      prisma.ledgerAccount.findFirst.mockResolvedValue({
        balance: new Decimal("950"),
      });
    });

    it("does not treat admin share as active revenue", async () => {
      const overview = await svc.getFinancialOverview();

      expect(overview.marginModel).toBe("myturn-100");
      expect(overview.platformSplits.adminSharePercentage).toBe(0);
      expect(overview.platformSplits.myTurnRevenuePercentage).toBe(100);
      expect(overview.totalMyTurnRevenueGhs).toBe("950.00");
      expect(overview.legacyAdminEarningsGhs).toBe("50.00");
    });

    it("separates legacy admin earnings from MyTurn revenue", async () => {
      const overview = await svc.getFinancialOverview();

      expect(overview.totalMyTurnRevenueGhs).not.toBe(
        overview.legacyAdminEarningsGhs,
      );
      expect(Number(overview.totalMyTurnRevenueGhs)).toBeGreaterThan(
        Number(overview.legacyAdminEarningsGhs),
      );
    });
  });

  describe("getEarningsBreakdown", () => {
    it("returns 100% MyTurn revenue per group with legacy admin separate", async () => {
      prisma.adminEarning.groupBy.mockResolvedValue([
        {
          groupId: "g1",
          _sum: {
            marginAmount: new Decimal("100"),
            adminShareAmount: new Decimal("10"),
            platformShareAmount: new Decimal("90"),
          },
          _count: { id: 2 },
        },
      ]);
      prisma.group.findMany.mockResolvedValue([
        {
          id: "g1",
          name: "Test Group",
          contributionAmount: new Decimal("10"),
          memberSlots: 5,
          payoutMode: "MONTHLY",
          daysPerCycle: 30,
          admin: {
            id: "a1",
            email: "admin@test.local",
            firstName: "Ada",
            lastName: "Min",
          },
        },
      ]);

      const result = await svc.getEarningsBreakdown({ page: 1, pageSize: 10 });

      expect(result.marginModel).toBe("myturn-100");
      expect(result.items).toHaveLength(1);
      const row = result.items[0] as {
        myTurnRevenueTotalGhs: string;
        legacyAdminShareTotalGhs: string;
        serviceMarginTotalGhs: string;
      };
      expect(row.myTurnRevenueTotalGhs).toBe("90.00");
      expect(row.legacyAdminShareTotalGhs).toBe("10.00");
      expect(row.serviceMarginTotalGhs).toBe("100.00");
    });
  });
});
