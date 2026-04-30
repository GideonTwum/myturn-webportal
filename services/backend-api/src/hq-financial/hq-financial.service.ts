import { Injectable } from "@nestjs/common";
import {
  AdminRequestStatus,
  GroupStatus,
  PayoutMode,
  Prisma,
  PayoutStatus,
  UserRole,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { getFixedGroupFinancePlatformSettings } from "@myturn/shared";
import { PrismaService } from "../prisma/prisma.service";
import {
  HqEarningsBreakdownQueryDto,
  HqPayoutHistoryQueryDto,
} from "./dto/hq-financial-query.dto";

function decStr(v: Decimal | null | undefined): string {
  if (v == null) return "0.00";
  return v.toFixed(2);
}

function parseDateEnd(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d;
}

function displayName(u: {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}): string {
  const n = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return n || u.email;
}

@Injectable()
export class HqFinancialService {
  constructor(private prisma: PrismaService) {}

  /** Lightweight HQ dashboard — live counts from DB. */
  async getHqOverview() {
    const [
      totalUsers,
      totalAdmins,
      activeGroups,
      completedGroups,
      pendingAdminRequests,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: UserRole.ADMIN } }),
      this.prisma.group.count({ where: { status: GroupStatus.ACTIVE } }),
      this.prisma.group.count({ where: { status: GroupStatus.COMPLETED } }),
      this.prisma.adminRequest.count({
        where: { status: AdminRequestStatus.PENDING },
      }),
    ]);
    return {
      totalUsers,
      totalAdmins,
      activeGroups,
      completedGroups,
      pendingAdminRequests,
    };
  }

  async getFinancialOverview() {
    const platform = getFixedGroupFinancePlatformSettings();
    const [marginAgg, payoutCompletedAgg, payoutCompletedCount] =
      await Promise.all([
        this.prisma.adminEarning.aggregate({
          _sum: {
            marginAmount: true,
            adminShareAmount: true,
            platformShareAmount: true,
          },
        }),
        this.prisma.payout.aggregate({
          where: { status: PayoutStatus.COMPLETED },
          _sum: { amount: true },
        }),
        this.prisma.payout.count({
          where: { status: PayoutStatus.COMPLETED },
        }),
      ]);

    return {
      totalServiceMarginGhs: decStr(marginAgg._sum.marginAmount),
      totalMyTurnEarningsGhs: decStr(marginAgg._sum.platformShareAmount),
      totalAdminEarningsGhs: decStr(marginAgg._sum.adminShareAmount),
      completedPayoutsCount: payoutCompletedCount,
      totalPaidToMembersGhs: decStr(payoutCompletedAgg._sum.amount),
      platformSplits: {
        adminSharePercentage: platform.adminSplitPercentage,
        myTurnSharePercentage: platform.myTurnSplitPercentage,
        serviceMarginPercentage: platform.serviceMarginPercentage,
      },
    };
  }

  private buildEarningsWhere(
    q: HqEarningsBreakdownQueryDto,
    groupIds?: string[],
  ): Prisma.AdminEarningWhereInput {
    const where: Prisma.AdminEarningWhereInput = {};
    if (groupIds?.length) {
      where.groupId = { in: groupIds };
    }
    if (q.dateFrom || q.dateTo) {
      where.settledAt = {};
      if (q.dateFrom) where.settledAt.gte = new Date(q.dateFrom);
      if (q.dateTo) where.settledAt.lte = parseDateEnd(q.dateTo);
    }
    return where;
  }

  async resolveEarnedGroupFilter(
    q: HqEarningsBreakdownQueryDto,
  ): Promise<string[] | undefined> {
    if (q.groupId) return [q.groupId];

    const groupWhere: Prisma.GroupWhereInput = {};
    if (q.adminId) groupWhere.adminId = q.adminId;
    if (q.search?.trim()) {
      const s = q.search.trim();
      groupWhere.OR = [
        { name: { contains: s, mode: "insensitive" } },
        {
          admin: {
            OR: [
              { email: { contains: s, mode: "insensitive" } },
              { firstName: { contains: s, mode: "insensitive" } },
              { lastName: { contains: s, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    if (q.adminId || q.search?.trim()) {
      const rows = await this.prisma.group.findMany({
        where: groupWhere,
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }

    return undefined;
  }

  async getEarningsBreakdown(q: HqEarningsBreakdownQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;

    const filteredIds = await this.resolveEarnedGroupFilter(q);
    if (filteredIds !== undefined && filteredIds.length === 0) {
      return {
        items: [] as unknown[],
        total: 0,
        page,
        pageSize,
      };
    }

    const where = this.buildEarningsWhere(q, filteredIds);

    const grouped = await this.prisma.adminEarning.groupBy({
      by: ["groupId"],
      where,
      _sum: {
        marginAmount: true,
        adminShareAmount: true,
        platformShareAmount: true,
      },
      _count: { id: true },
    });

    const sorted = [...grouped].sort((a, b) => {
      const av = new Decimal(a._sum.marginAmount?.toString() ?? "0");
      const bv = new Decimal(b._sum.marginAmount?.toString() ?? "0");
      return bv.comparedTo(av);
    });

    const total = sorted.length;
    const slice = sorted.slice((page - 1) * pageSize, page * pageSize);
    const groupIdsPage = slice
      .map((r) => r.groupId)
      .filter((id): id is string => id != null);

    const groups = await this.prisma.group.findMany({
      where: { id: { in: groupIdsPage } },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const gMap = new Map(groups.map((g) => [g.id, g]));

    const items = slice.map((row) => {
      const g = row.groupId ? gMap.get(row.groupId) : undefined;
      if (!g) {
        return {
          groupId: row.groupId,
          groupName: "—",
          adminName: "—",
          contributionAmountGhs: "0.00",
          groupSize: 0,
          totalCollectedPerCycleGhs: "0.00",
          serviceMarginTotalGhs: decStr(row._sum.marginAmount),
          adminShareTotalGhs: decStr(row._sum.adminShareAmount),
          myTurnShareTotalGhs: decStr(row._sum.platformShareAmount),
          completedCycles: row._count.id,
          totalAdminEarningsGhs: decStr(row._sum.adminShareAmount),
          totalMyTurnEarningsGhs: decStr(row._sum.platformShareAmount),
        };
      }

      const contrib = new Decimal(g.contributionAmount.toString());
      const n = g.memberSlots;
      const mult =
        g.payoutMode === PayoutMode.DAILY ? 1 : g.daysPerCycle;
      const totalCollected = contrib.mul(n).mul(mult);

      return {
        groupId: g.id,
        groupName: g.name,
        adminName: displayName(g.admin),
        contributionAmountGhs: contrib.toFixed(2),
        groupSize: n,
        totalCollectedPerCycleGhs: totalCollected.toFixed(2),
        serviceMarginTotalGhs: decStr(row._sum.marginAmount),
        adminShareTotalGhs: decStr(row._sum.adminShareAmount),
        myTurnShareTotalGhs: decStr(row._sum.platformShareAmount),
        completedCycles: row._count.id,
        totalAdminEarningsGhs: decStr(row._sum.adminShareAmount),
        totalMyTurnEarningsGhs: decStr(row._sum.platformShareAmount),
      };
    });

    return { items, total, page, pageSize };
  }

  async getPayoutHistory(q: HqPayoutHistoryQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;

    const where: Prisma.PayoutWhereInput = {};
    if (q.groupId) where.groupId = q.groupId;
    if (q.adminId) where.group = { adminId: q.adminId };
    if (q.status) where.status = q.status;
    if (q.dateFrom || q.dateTo) {
      where.paidAt = {};
      if (q.dateFrom) where.paidAt.gte = new Date(q.dateFrom);
      if (q.dateTo) where.paidAt.lte = parseDateEnd(q.dateTo);
    }
    if (q.search?.trim()) {
      const s = q.search.trim();
      where.recipient = {
        OR: [
          { email: { contains: s, mode: "insensitive" } },
          { firstName: { contains: s, mode: "insensitive" } },
          { lastName: { contains: s, mode: "insensitive" } },
        ],
      };
    }

    const [total, payouts] = await Promise.all([
      this.prisma.payout.count({ where }),
      this.prisma.payout.findMany({
        where,
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          recipient: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          group: {
            include: {
              admin: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const memberRows =
      payouts.length === 0
        ? []
        : await this.prisma.groupMember.findMany({
            where: {
              OR: payouts.map((p) => ({
                groupId: p.groupId,
                userId: p.recipientId,
              })),
            },
            select: { groupId: true, userId: true, turnOrder: true },
          });
    const turnKey = (g: string, u: string) => `${g}:${u}`;
    const turnMap = new Map(
      memberRows.map((m) => [turnKey(m.groupId, m.userId), m.turnOrder]),
    );

    const earnings =
      payouts.length === 0
        ? []
        : await this.prisma.adminEarning.findMany({
            where: {
              OR: payouts.map((p) => ({
                groupId: p.groupId,
                cycleNumber: p.cycleNumber,
              })),
            },
          });
    const earnKey = (g: string, c: number) => `${g}:${c}`;
    const earningMap = new Map(
      earnings.map((e) => [
        earnKey(e.groupId!, e.cycleNumber!),
        e,
      ]),
    );

    const items = payouts.map((p) => {
      const e = earningMap.get(earnKey(p.groupId, p.cycleNumber));
      const turnOrder =
        turnMap.get(turnKey(p.groupId, p.recipientId)) ?? null;
      return {
        payoutId: p.id,
        memberName: displayName(p.recipient),
        groupName: p.group.name,
        adminName: displayName(p.group.admin),
        payoutPosition: turnOrder,
        cycleNumber: p.cycleNumber,
        payoutAmountGhs: decStr(p.amount),
        serviceMarginGhs: e ? decStr(e.marginAmount) : "—",
        adminShareGhs: e ? decStr(e.adminShareAmount) : "—",
        myTurnShareGhs: e ? decStr(e.platformShareAmount) : "—",
        payoutDate: p.paidAt?.toISOString() ?? p.updatedAt.toISOString(),
        status: p.status,
      };
    });

    return { items, total, page, pageSize };
  }
}
