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

  /** Payments for groups owned by this admin only. */
  async listPayments(adminId: string) {
    const rows = await this.prisma.payment.findMany({
      where: { group: { adminId } },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        group: { select: { id: true, name: true } },
      },
    });

    return {
      payments: rows.map((p) => {
        const meta =
          p.metadata && typeof p.metadata === "object" && !Array.isArray(p.metadata)
            ? (p.metadata as Record<string, unknown>)
            : {};
        const memberName = p.user
          ? [p.user.firstName, p.user.lastName].filter(Boolean).join(" ").trim() ||
            "Member"
          : null;
        return {
          id: p.id,
          reference: p.externalRef ?? p.id,
          memberName,
          memberId: p.userId,
          groupId: p.groupId,
          groupName: p.group?.name ?? null,
          amount: p.amount.toString(),
          status: p.status,
          type: p.type,
          provider: typeof meta.provider === "string" ? meta.provider : meta.mockContributionPayment ? "MOCK" : "MOMO",
          createdAt: p.createdAt.toISOString(),
          settledAt: p.completedAt?.toISOString() ?? null,
        };
      }),
    };
  }
}
