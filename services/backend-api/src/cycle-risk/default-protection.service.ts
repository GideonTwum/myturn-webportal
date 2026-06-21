import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import {
  ContributionGuaranteeReserveStatus,
  ContributionStatus,
  GroupStatus,
  MemberCycleStanding,
  PayoutStatus,
  Prisma,
} from "@prisma/client";
import { missedContributionMinor } from "@myturn/shared";
import { ContributionGuaranteeReserveService } from "../ledger-accounts/contribution-guarantee-reserve.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  RESERVE_DEFAULT_COVER_WALLET_PROMPT,
  RESERVE_FULL_COVER_TITLE,
  RESERVE_PARTIAL_COVER_TITLE,
  reserveFullCoverNotificationBody,
  reservePartialCoverNotificationBody,
} from "./default-protection.messages";

const RECENT_RESERVE_COVER_DAYS = 30;

export type ReserveDefaultCoverPrompt = {
  groupId: string;
  groupName: string;
  fullyCovered: boolean;
  message: string;
};

export type UnresolvedDefaultRestriction = {
  groupId: string;
  groupName: string;
  cycleNumber: number;
  contributionId: string | null;
};

function toMinor(amount: Prisma.Decimal): bigint {
  return BigInt(amount.mul(100).toFixed(0));
}

function fromMinor(minor: bigint): Prisma.Decimal {
  return new Prisma.Decimal(minor.toString()).div(100);
}

@Injectable()
export class DefaultProtectionService {
  private readonly logger = new Logger(DefaultProtectionService.name);

  constructor(
    private prisma: PrismaService,
    private reserve: ContributionGuaranteeReserveService,
    private notifications: NotificationsService,
  ) {}

  /** Active DEFAULTED participation with outstanding obligation in any group. */
  async findUnresolvedDefaultRestrictions(
    userId: string,
  ): Promise<UnresolvedDefaultRestriction[]> {
    const memberships = await this.prisma.groupMember.findMany({
      where: {
        userId,
        status: "ACTIVE",
        cycleStanding: MemberCycleStanding.DEFAULTED,
        group: { status: GroupStatus.ACTIVE },
      },
      include: {
        group: { select: { id: true, name: true, currentCycle: true } },
      },
    });

    const results: UnresolvedDefaultRestriction[] = [];
    for (const m of memberships) {
      const c = await this.prisma.contribution.findFirst({
        where: {
          groupId: m.groupId,
          userId,
          cycleNumber: m.group.currentCycle,
        },
      });
      if (!c || c.status !== ContributionStatus.PAID) {
        results.push({
          groupId: m.groupId,
          groupName: m.group.name,
          cycleNumber: m.group.currentCycle,
          contributionId: c?.id ?? null,
        });
      }
    }
    return results;
  }

  async assertWithdrawalNotRestricted(userId: string): Promise<void> {
    const restrictions = await this.findUnresolvedDefaultRestrictions(userId);
    if (restrictions.length === 0) return;
    const g = restrictions[0]!;
    throw new BadRequestException(
      `Your withdrawal is temporarily restricted because you have an unresolved contribution in ${g.groupName}. Please settle it or submit an appeal.`,
    );
  }

  async assertCanJoinNewGroup(userId: string): Promise<void> {
    const restrictions = await this.findUnresolvedDefaultRestrictions(userId);
    if (restrictions.length === 0) return;
    const g = restrictions[0]!;
    throw new BadRequestException(
      `You cannot join a new group while you have an unresolved contribution in ${g.groupName}.`,
    );
  }

  /** Whether member has received a credited/completed payout in this group. */
  async hasReceivedPayoutInGroup(
    tx: Prisma.TransactionClient,
    userId: string,
    groupId: string,
  ): Promise<boolean> {
    const payout = await tx.payout.findFirst({
      where: {
        groupId,
        recipientId: userId,
        status: { in: [PayoutStatus.CREDITED, PayoutStatus.COMPLETED] },
      },
      select: { id: true },
    });
    return payout != null;
  }

  /**
   * Apply default-protection policy when a member newly becomes DEFAULTED.
   * Post-payout: cover from reserve. Pre-payout: dequeue to end of payout queue.
   */
  async onMemberNewlyDefaulted(
    tx: Prisma.TransactionClient,
    params: {
      memberId: string;
      userId: string;
      groupId: string;
      groupName: string;
      cycleNumber: number;
      contributionId: string;
    },
  ): Promise<void> {
    const now = new Date();
    const hasPayout = await this.hasReceivedPayoutInGroup(
      tx,
      params.userId,
      params.groupId,
    );

    if (hasPayout) {
      const cover = await this.reserve.coverDefaultFromReserveInTx(tx, {
        userId: params.userId,
        groupId: params.groupId,
        contributionId: params.contributionId,
      });

      await tx.groupMember.update({
        where: { id: params.memberId },
        data: { defaultedAt: now },
      });

      if (cover.covered && cover.amount) {
        const fullyCovered = cover.fullyCovered === true;
        const partial = cover.partial === true || !fullyCovered;
        if (fullyCovered) {
          await this.notifications.create(
            params.userId,
            RESERVE_FULL_COVER_TITLE,
            reserveFullCoverNotificationBody(params.groupName),
            "RESERVE_USED_FOR_DEFAULT",
            {
              groupId: params.groupId,
              contributionId: params.contributionId,
              reserveId: cover.reserveId,
              coveredAmount: cover.amount,
              fullyCovered: true,
            },
          );
        } else if (partial) {
          await this.notifications.create(
            params.userId,
            RESERVE_PARTIAL_COVER_TITLE,
            reservePartialCoverNotificationBody(params.groupName),
            "RESERVE_PARTIAL_DEFAULT_COVER",
            {
              groupId: params.groupId,
              contributionId: params.contributionId,
              reserveId: cover.reserveId,
              coveredAmount: cover.amount,
              fullyCovered: false,
            },
          );
        }
      }
      return;
    }

    const members = await tx.groupMember.findMany({
      where: { groupId: params.groupId, status: "ACTIVE" },
      select: { effectivePayoutOrder: true },
    });
    const maxOrder = members.reduce(
      (max, row) => Math.max(max, row.effectivePayoutOrder),
      0,
    );

    await tx.groupMember.update({
      where: { id: params.memberId },
      data: {
        defaultedAt: now,
        effectivePayoutOrder: maxOrder + 1,
      },
    });

    await this.notifications.create(
      params.userId,
      "Payout turn skipped",
      `Your payout turn was skipped because of unresolved contributions in ${params.groupName}. Settle your balance to become eligible again.`,
      "PAYOUT_TURN_SKIPPED_DEFAULT",
      { groupId: params.groupId, cycle: params.cycleNumber },
    );
  }

  /** Restore standing when a previously defaulted member fully settles. */
  async onContributionFullySettled(
    tx: Prisma.TransactionClient,
    params: {
      memberId: string;
      userId: string;
      groupId: string;
      groupName: string;
    },
  ): Promise<void> {
    const member = await tx.groupMember.findUnique({
      where: { id: params.memberId },
    });
    if (!member || member.cycleStanding !== MemberCycleStanding.DEFAULTED) {
      return;
    }

    await tx.groupMember.update({
      where: { id: params.memberId },
      data: {
        cycleStanding: MemberCycleStanding.ACTIVE,
        resolvedAt: new Date(),
      },
    });

    this.logger.log(
      `Default resolved memberId=${params.memberId} groupId=${params.groupId}`,
    );
  }

  /** Recent reserve default-cover event for wallet/group informational prompts. */
  async getRecentReserveDefaultCoverPrompt(
    userId: string,
    groupId?: string,
  ): Promise<ReserveDefaultCoverPrompt | null> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - RECENT_RESERVE_COVER_DAYS);

    const cover = await this.prisma.defaultCoverage.findFirst({
      where: {
        userId,
        ...(groupId ? { groupId } : {}),
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!cover) return null;

    const group = await this.prisma.group.findUnique({
      where: { id: cover.groupId },
      select: { name: true },
    });
    if (!group) return null;

    const meta =
      cover.metadata && typeof cover.metadata === "object"
        ? (cover.metadata as { fullyCovered?: boolean })
        : {};
    const fullyCovered =
      meta.fullyCovered === true ||
      cover.coveredAmount.gte(cover.missedAmount);

    return {
      groupId: cover.groupId,
      groupName: group.name,
      fullyCovered,
      message: fullyCovered
        ? RESERVE_DEFAULT_COVER_WALLET_PROMPT
        : reservePartialCoverNotificationBody(group.name),
    };
  }

  async getRecentReserveDefaultCoverPromptsByGroup(
    userId: string,
  ): Promise<Map<string, ReserveDefaultCoverPrompt>> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - RECENT_RESERVE_COVER_DAYS);

    const covers = await this.prisma.defaultCoverage.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
    });

    const map = new Map<string, ReserveDefaultCoverPrompt>();
    const groupIds = [...new Set(covers.map((c) => c.groupId))];
    const groups = await this.prisma.group.findMany({
      where: { id: { in: groupIds } },
      select: { id: true, name: true },
    });
    const groupNames = new Map(groups.map((g) => [g.id, g.name]));

    for (const cover of covers) {
      if (map.has(cover.groupId)) continue;
      const groupName = groupNames.get(cover.groupId);
      if (!groupName) continue;
      const meta =
        cover.metadata && typeof cover.metadata === "object"
          ? (cover.metadata as { fullyCovered?: boolean })
          : {};
      const fullyCovered =
        meta.fullyCovered === true ||
        cover.coveredAmount.gte(cover.missedAmount);
      map.set(cover.groupId, {
        groupId: cover.groupId,
        groupName,
        fullyCovered,
        message: fullyCovered
          ? RESERVE_DEFAULT_COVER_WALLET_PROMPT
          : reservePartialCoverNotificationBody(groupName),
      });
    }
    return map;
  }

  /** HQ summary: defaulted members and reserve used for default coverage. */
  async getHqDefaultProtectionSummary() {
    const [defaultedCount, coverageAgg, groupsWithDefaults] = await Promise.all([
      this.prisma.groupMember.count({
        where: {
          status: "ACTIVE",
          cycleStanding: MemberCycleStanding.DEFAULTED,
          group: { status: GroupStatus.ACTIVE },
        },
      }),
      this.prisma.defaultCoverage.aggregate({
        _sum: { coveredAmount: true },
        _count: { id: true },
      }),
      this.prisma.groupMember.findMany({
        where: {
          status: "ACTIVE",
          cycleStanding: MemberCycleStanding.DEFAULTED,
          group: { status: GroupStatus.ACTIVE },
        },
        select: {
          groupId: true,
          group: { select: { name: true } },
        },
        distinct: ["groupId"],
      }),
    ]);

    return {
      activeDefaultedMemberCount: defaultedCount,
      totalReserveUsedForDefault:
        coverageAgg._sum.coveredAmount?.toFixed(2) ?? "0.00",
      defaultCoverageEventCount: coverageAgg._count.id,
      groupsWithUnresolvedDefaults: groupsWithDefaults.map((g) => ({
        groupId: g.groupId,
        groupName: g.group.name,
      })),
    };
  }
}
