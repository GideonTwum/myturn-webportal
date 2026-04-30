import { Injectable } from "@nestjs/common";
import { GroupStatus, PayoutStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../prisma/prisma.service";

function decStr(v: Decimal | null | undefined): string {
  if (v == null) return "0.00";
  return v.toFixed(2);
}

@Injectable()
export class AdminOverviewService {
  constructor(private prisma: PrismaService) {}

  /** Live admin dashboard aggregates — no caching. */
  async getOverview(adminId: string) {
    const groups = await this.prisma.group.findMany({
      where: { adminId },
      select: {
        status: true,
        _count: { select: { members: true } },
      },
    });

    const [earningsAgg, payoutAgg] = await Promise.all([
      this.prisma.adminEarning.aggregate({
        where: { adminId },
        _sum: { adminShareAmount: true },
      }),
      this.prisma.payout.aggregate({
        where: {
          group: { adminId },
          status: PayoutStatus.COMPLETED,
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    return {
      groupsCreated: groups.length,
      activeGroups: groups.filter((g) => g.status === GroupStatus.ACTIVE)
        .length,
      completedGroups: groups.filter(
        (g) => g.status === GroupStatus.COMPLETED,
      ).length,
      totalMembers: groups.reduce((a, g) => a + g._count.members, 0),
      totalMarginEarningsGhs: decStr(earningsAgg._sum.adminShareAmount),
      completedPayoutsCount: payoutAgg._count.id,
      totalPaidToMembersGhs: decStr(payoutAgg._sum.amount),
    };
  }
}
