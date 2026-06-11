import { Injectable, Logger } from "@nestjs/common";
import {
  ContributionGuaranteeReserveStatus,
  GroupStatus,
  Prisma,
} from "@prisma/client";
import {
  computeReleasePerUnitMinor,
  computeReserveAmountMinor,
  computeReserveBps,
  nextReserveReleaseMinor,
  postPayoutContributionUnits,
} from "@myturn/shared";
import { getContributionReserveConfig } from "../config/contribution-reserve.config";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerAccountService } from "./ledger-account.service";
import { LedgerPostingService } from "./ledger-posting.service";

function fromMinor(minor: bigint): Prisma.Decimal {
  return new Prisma.Decimal(minor.toString()).div(100);
}

function toMinor(amount: Prisma.Decimal): bigint {
  return BigInt(amount.mul(100).toFixed(0));
}

export type ReserveSplitResult = {
  reserveBps: number;
  reserveMinor: bigint;
  availableMinor: bigint;
  /** Payment units (days or lump payments) remaining after payout. */
  postPayoutContributionUnits: number;
};

export type GroupCompletedReserveRelease = {
  released: boolean;
  userId: string;
  amount: string;
  groupName: string;
  reserveId: string;
  payoutId: string;
};

@Injectable()
export class ContributionGuaranteeReserveService {
  private readonly logger = new Logger(ContributionGuaranteeReserveService.name);

  constructor(
    private prisma: PrismaService,
    private accounts: LedgerAccountService,
    private posting: LedgerPostingService,
    private notifications: NotificationsService,
  ) {}

  computeSplit(
    netPayoutMinor: bigint,
    payoutPosition: number,
    totalPositions: number,
    paymentUnitsPerCycle: number,
  ): ReserveSplitResult {
    const units = postPayoutContributionUnits(
      payoutPosition,
      totalPositions,
      paymentUnitsPerCycle,
    );
    const config = getContributionReserveConfig();
    if (!config.enabled) {
      return {
        reserveBps: 0,
        reserveMinor: 0n,
        availableMinor: netPayoutMinor,
        postPayoutContributionUnits: units,
      };
    }

    const reserveBps = computeReserveBps(
      payoutPosition,
      totalPositions,
      config.maxBps,
      config.minBps,
    );
    const reserveMinor = computeReserveAmountMinor(netPayoutMinor, reserveBps);
    const availableMinor = netPayoutMinor - reserveMinor;

    return {
      reserveBps,
      reserveMinor,
      availableMinor,
      postPayoutContributionUnits: units,
    };
  }

  /** One-time migration: legacy MEMBER_WALLET → MEMBER_WALLET_AVAILABLE. */
  async ensureLegacyWalletMigratedInTx(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    const legacy = await this.accounts.getOrCreateMemberWallet(userId, tx);
    const available = await this.accounts.getOrCreateMemberWalletAvailable(
      userId,
      tx,
    );
    const legacyBal = new Prisma.Decimal(legacy.balance.toString());
    if (legacyBal.lte(0)) return;

    const availBal = new Prisma.Decimal(available.balance.toString());
    if (availBal.gt(0)) return;

    await this.posting.postTransferInTx(tx, {
      idempotencyKey: `migration:member-wallet:${userId}`,
      referenceType: "WalletMigration",
      referenceId: userId,
      description: "Migrate legacy MEMBER_WALLET to available balance",
      fromAccountId: legacy.id,
      toAccountId: available.id,
      amount: legacyBal,
    });
  }

  async createReserveOnPayoutInTx(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      groupId: string;
      payoutId: string;
      cycleNumber: number;
      payoutPosition: number;
      totalPositions: number;
      paymentUnitsPerCycle: number;
      netPayoutMinor: bigint;
      split: ReserveSplitResult;
    },
  ) {
    await this.ensureLegacyWalletMigratedInTx(tx, params.userId);

    if (params.split.reserveMinor <= 0n) return null;

    const units = params.split.postPayoutContributionUnits;
    const releasePerMinor = computeReleasePerUnitMinor(
      params.split.reserveMinor,
      units || 1,
    );

    return tx.contributionGuaranteeReserve.create({
      data: {
        userId: params.userId,
        groupId: params.groupId,
        payoutId: params.payoutId,
        cycleNumber: params.cycleNumber,
        payoutPosition: params.payoutPosition,
        originalReserveAmount: fromMinor(params.split.reserveMinor),
        remainingReserveAmount: fromMinor(params.split.reserveMinor),
        releasedAmount: new Prisma.Decimal(0),
        releasePerContributionAmount: fromMinor(releasePerMinor),
        remainingContributionCountAtCreation: units,
        reserveBps: params.split.reserveBps,
        status: ContributionGuaranteeReserveStatus.ACTIVE,
        metadata: {
          netPayoutMinor: params.netPayoutMinor.toString(),
          availableMinor: params.split.availableMinor.toString(),
          paymentUnitsPerCycle: params.paymentUnitsPerCycle,
          remainingContributionUnitsAtCreation: units,
        },
      },
    });
  }

  /**
   * Release one unit after each successful contribution payment settlement (post-payout).
   * Idempotent per paymentId — does not double-release on retries.
   */
  async tryReleaseOnPaymentSettledInTx(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      groupId: string;
      contributionId: string;
      paymentId: string;
      cycleNumber: number;
      paidDayIndex: number;
    },
  ): Promise<{
    released: boolean;
    amount?: string;
    fullyReleased?: boolean;
    groupName?: string;
    userId?: string;
  }> {
    if (!getContributionReserveConfig().enabled) {
      return { released: false };
    }

    const reserve = await tx.contributionGuaranteeReserve.findFirst({
      where: {
        userId: params.userId,
        groupId: params.groupId,
        status: ContributionGuaranteeReserveStatus.ACTIVE,
      },
      include: { group: { select: { name: true } } },
    });
    if (!reserve) return { released: false };

    // Post-payout only — payout cycle contributions are complete before finalize.
    if (params.cycleNumber <= reserve.cycleNumber) return { released: false };

    const remainingMinor = toMinor(
      new Prisma.Decimal(reserve.remainingReserveAmount.toString()),
    );
    if (remainingMinor <= 0n) return { released: false };

    const totalUnits = reserve.remainingContributionCountAtCreation;
    const unitsReleased = reserve.contributionsReleasedCount;
    if (unitsReleased >= totalUnits) return { released: false };

    const releaseMinor = nextReserveReleaseMinor(
      toMinor(new Prisma.Decimal(reserve.originalReserveAmount.toString())),
      remainingMinor,
      totalUnits,
      unitsReleased,
    );
    if (releaseMinor <= 0n) return { released: false };

    const releaseAmount = fromMinor(releaseMinor);
    const reservedAcct = await this.accounts.getOrCreateMemberWalletReserved(
      params.userId,
      tx,
    );
    const availableAcct = await this.accounts.getOrCreateMemberWalletAvailable(
      params.userId,
      tx,
    );

    const transfer = await this.posting.postTransferInTx(tx, {
      idempotencyKey: `reserve:release:${reserve.id}:payment:${params.paymentId}`,
      referenceType: "Payment",
      referenceId: params.paymentId,
      description: `Reserve release (cycle ${params.cycleNumber} day ${params.paidDayIndex})`,
      metadata: {
        reserveId: reserve.id,
        groupId: params.groupId,
        contributionId: params.contributionId,
        paidDayIndex: params.paidDayIndex,
      },
      fromAccountId: reservedAcct.id,
      toAccountId: availableAcct.id,
      amount: releaseAmount,
    });

    if (transfer.duplicate) {
      return { released: false };
    }

    const newRemaining = new Prisma.Decimal(
      reserve.remainingReserveAmount.toString(),
    ).sub(releaseAmount);
    const newReleased = new Prisma.Decimal(
      reserve.releasedAmount.toString(),
    ).add(releaseAmount);
    const newUnitsReleased = unitsReleased + 1;
    const fullyReleased =
      newRemaining.lte(0) || newUnitsReleased >= totalUnits;

    await tx.contributionGuaranteeReserve.update({
      where: { id: reserve.id },
      data: {
        remainingReserveAmount: Prisma.Decimal.max(
          newRemaining,
          new Prisma.Decimal(0),
        ),
        releasedAmount: newReleased,
        contributionsReleasedCount: newUnitsReleased,
        status: fullyReleased
          ? ContributionGuaranteeReserveStatus.RELEASED
          : ContributionGuaranteeReserveStatus.ACTIVE,
      },
    });

    return {
      released: true,
      amount: releaseAmount.toFixed(2),
      fullyReleased,
      groupName: reserve.group.name,
      userId: params.userId,
    };
  }

  /** @deprecated Use tryReleaseOnPaymentSettledInTx */
  async tryReleaseOnContributionPaidInTx(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      groupId: string;
      contributionId: string;
      cycleNumber: number;
    },
  ) {
    void params;
    return { released: false as const };
  }

  mapReserveRow(r: {
    originalReserveAmount: Prisma.Decimal;
    remainingReserveAmount: Prisma.Decimal;
    releasedAmount: Prisma.Decimal;
    releasePerContributionAmount: Prisma.Decimal;
    remainingContributionCountAtCreation: number;
    contributionsReleasedCount: number;
  }) {
    const original = Number(r.originalReserveAmount);
    const released = Number(r.releasedAmount);
    const progress =
      original > 0 ? Math.round((released / original) * 100) : 100;
    const remainingUnits = Math.max(
      0,
      r.remainingContributionCountAtCreation - r.contributionsReleasedCount,
    );
    return {
      originalReserveAmount: r.originalReserveAmount.toFixed(2),
      remainingReserveAmount: r.remainingReserveAmount.toFixed(2),
      releasedAmount: r.releasedAmount.toFixed(2),
      releasePerUnitAmount: r.releasePerContributionAmount.toFixed(2),
      nextUnlockAmount: r.releasePerContributionAmount.toFixed(2),
      remainingContributionUnits: remainingUnits,
      releasedUnits: r.contributionsReleasedCount,
      releaseProgressPercent: progress,
      /** @deprecated Use remainingContributionUnits */
      remainingContributionCount: remainingUnits,
    };
  }

  /**
   * Release all remaining ACTIVE reserves when a group completes successfully.
   * Idempotent per reserve via ledger idempotency key.
   */
  async releaseAllActiveReservesOnGroupCompletedInTx(
    tx: Prisma.TransactionClient,
    params: { groupId: string },
  ): Promise<GroupCompletedReserveRelease[]> {
    const group = await tx.group.findUnique({
      where: { id: params.groupId },
      select: { status: true, name: true },
    });
    if (!group || group.status !== GroupStatus.COMPLETED) {
      return [];
    }

    const reserves = await tx.contributionGuaranteeReserve.findMany({
      where: {
        groupId: params.groupId,
        status: ContributionGuaranteeReserveStatus.ACTIVE,
        remainingReserveAmount: { gt: 0 },
      },
    });

    const results: GroupCompletedReserveRelease[] = [];
    for (const reserve of reserves) {
      const result = await this.releaseFinalReserveOnGroupCompletedInTx(
        tx,
        reserve,
        group.name,
      );
      if (result.released) {
        results.push(result);
      }
    }
    return results;
  }

  private async releaseFinalReserveOnGroupCompletedInTx(
    tx: Prisma.TransactionClient,
    reserve: {
      id: string;
      userId: string;
      groupId: string;
      payoutId: string;
      remainingReserveAmount: Prisma.Decimal;
      releasedAmount: Prisma.Decimal;
      remainingContributionCountAtCreation: number;
      contributionsReleasedCount: number;
      metadata: Prisma.JsonValue;
    },
    groupName: string,
  ): Promise<GroupCompletedReserveRelease> {
    const base = {
      released: false as const,
      userId: reserve.userId,
      amount: "0.00",
      groupName,
      reserveId: reserve.id,
      payoutId: reserve.payoutId,
    };

    const remaining = new Prisma.Decimal(
      reserve.remainingReserveAmount.toString(),
    );
    if (remaining.lte(0)) {
      return base;
    }

    const reservedAcct = await this.accounts.getOrCreateMemberWalletReserved(
      reserve.userId,
      tx,
    );
    const availableAcct = await this.accounts.getOrCreateMemberWalletAvailable(
      reserve.userId,
      tx,
    );

    const transfer = await this.posting.postTransferInTx(tx, {
      idempotencyKey: `reserve:final-release:${reserve.id}:group-completed`,
      referenceType: "ContributionGuaranteeReserve",
      referenceId: reserve.id,
      description: `Final Contribution Guarantee Reserve release — group completed`,
      metadata: {
        releaseReason: "GROUP_COMPLETED",
        groupId: reserve.groupId,
        reserveId: reserve.id,
        payoutId: reserve.payoutId,
      },
      fromAccountId: reservedAcct.id,
      toAccountId: availableAcct.id,
      amount: remaining,
    });

    if (transfer.duplicate) {
      const fresh = await tx.contributionGuaranteeReserve.findUnique({
        where: { id: reserve.id },
      });
      if (
        !fresh ||
        fresh.status !== ContributionGuaranteeReserveStatus.ACTIVE ||
        new Prisma.Decimal(fresh.remainingReserveAmount.toString()).lte(0)
      ) {
        return base;
      }
      await this.markReserveFullyReleasedInTx(tx, fresh, remaining);
      this.logger.log(
        `Final reserve release (idempotent retry) reserveId=${reserve.id} groupId=${reserve.groupId} amount=${remaining.toFixed(2)}`,
      );
      return {
        released: true,
        userId: reserve.userId,
        amount: remaining.toFixed(2),
        groupName,
        reserveId: reserve.id,
        payoutId: reserve.payoutId,
      };
    }

    await this.markReserveFullyReleasedInTx(tx, reserve, remaining);
    this.logger.log(
      `Final reserve release reserveId=${reserve.id} groupId=${reserve.groupId} userId=${reserve.userId} amount=${remaining.toFixed(2)}`,
    );

    return {
      released: true,
      userId: reserve.userId,
      amount: remaining.toFixed(2),
      groupName,
      reserveId: reserve.id,
      payoutId: reserve.payoutId,
    };
  }

  private async markReserveFullyReleasedInTx(
    tx: Prisma.TransactionClient,
    reserve: {
      id: string;
      groupId: string;
      payoutId: string;
      releasedAmount: Prisma.Decimal;
      remainingContributionCountAtCreation: number;
      metadata: Prisma.JsonValue;
    },
    releaseAmount: Prisma.Decimal,
  ) {
    const priorMeta =
      reserve.metadata && typeof reserve.metadata === "object"
        ? (reserve.metadata as Record<string, unknown>)
        : {};

    await tx.contributionGuaranteeReserve.update({
      where: { id: reserve.id },
      data: {
        remainingReserveAmount: new Prisma.Decimal(0),
        releasedAmount: new Prisma.Decimal(reserve.releasedAmount.toString()).add(
          releaseAmount,
        ),
        contributionsReleasedCount: reserve.remainingContributionCountAtCreation,
        status: ContributionGuaranteeReserveStatus.RELEASED,
        metadata: {
          ...priorMeta,
          releaseReason: "GROUP_COMPLETED",
          groupId: reserve.groupId,
          reserveId: reserve.id,
          payoutId: reserve.payoutId,
          finalReleasedAt: new Date().toISOString(),
        },
      },
    });
  }

  async notifyGroupCompletedReserveRelease(
    result: Pick<
      GroupCompletedReserveRelease,
      "userId" | "amount" | "groupName" | "reserveId" | "payoutId"
    >,
  ) {
    await this.notifications.create(
      result.userId,
      "Reserve fully unlocked",
      `Your remaining Contribution Guarantee Reserve for ${result.groupName} has been released because the group is complete.`,
      "RESERVE_GROUP_COMPLETED_RELEASE",
      {
        amount: result.amount,
        groupName: result.groupName,
        reserveId: result.reserveId,
        payoutId: result.payoutId,
        releaseReason: "GROUP_COMPLETED",
      },
    );
  }

  async notifyReserveReleased(result: {
    released: boolean;
    amount?: string;
    fullyReleased?: boolean;
    groupName?: string;
    userId?: string;
  }) {
    if (!result.released || !result.amount || !result.userId) return;

    if (result.fullyReleased && result.groupName) {
      await this.notifications.create(
        result.userId,
        "Reserve fully unlocked",
        `Your Contribution Guarantee Reserve for ${result.groupName} has been fully released.`,
        "RESERVE_FULLY_RELEASED",
        { amount: result.amount, groupName: result.groupName },
      );
    } else {
      await this.notifications.create(
        result.userId,
        "Reserve unlocked",
        `GHS ${result.amount} has been released from your Contribution Guarantee Reserve after your successful contribution.`,
        "RESERVE_RELEASED",
        { amount: result.amount },
      );
    }
  }

  async listActiveForUser(userId: string) {
    return this.prisma.contributionGuaranteeReserve.findMany({
      where: {
        userId,
        status: ContributionGuaranteeReserveStatus.ACTIVE,
      },
      include: { group: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async listForGroup(groupId: string, adminId?: string) {
    if (adminId) {
      const group = await this.prisma.group.findFirst({
        where: { id: groupId, adminId },
      });
      if (!group) return [];
    }
    const rows = await this.prisma.contributionGuaranteeReserve.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            cycleDefaultFlagged: true,
          },
        },
        group: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      memberName:
        [r.user.firstName, r.user.lastName].filter(Boolean).join(" ").trim() ||
        r.user.email,
      groupId: r.groupId,
      groupName: r.group.name,
      payoutCycle: r.cycleNumber,
      payoutPosition: r.payoutPosition,
      status: r.status,
      defaultRisk: r.user.cycleDefaultFlagged ? "high" : "normal",
      ...this.mapReserveRow(r),
    }));
  }

  async getHqSummary() {
    const [activeAgg, releasedAgg, activeCount, releasedCount] =
      await Promise.all([
        this.prisma.contributionGuaranteeReserve.aggregate({
          where: { status: ContributionGuaranteeReserveStatus.ACTIVE },
          _sum: { remainingReserveAmount: true },
        }),
        this.prisma.contributionGuaranteeReserve.aggregate({
          where: { status: ContributionGuaranteeReserveStatus.RELEASED },
          _sum: { releasedAmount: true },
        }),
        this.prisma.contributionGuaranteeReserve.count({
          where: { status: ContributionGuaranteeReserveStatus.ACTIVE },
        }),
        this.prisma.contributionGuaranteeReserve.count({
          where: { status: ContributionGuaranteeReserveStatus.RELEASED },
        }),
      ]);

    const byGroup = await this.prisma.contributionGuaranteeReserve.groupBy({
      by: ["groupId"],
      where: { status: ContributionGuaranteeReserveStatus.ACTIVE },
      _sum: { remainingReserveAmount: true },
      _count: { id: true },
    });

    const groupIds = byGroup.map((g) => g.groupId);
    const groups =
      groupIds.length > 0
        ? await this.prisma.group.findMany({
            where: { id: { in: groupIds } },
            select: { id: true, name: true },
          })
        : [];
    const gMap = new Map(groups.map((g) => [g.id, g.name]));

    return {
      totalReservedLiabilities:
        activeAgg._sum.remainingReserveAmount?.toFixed(2) ?? "0.00",
      totalReleasedAmount:
        releasedAgg._sum.releasedAmount?.toFixed(2) ?? "0.00",
      activeReserveCount: activeCount,
      releasedReserveCount: releasedCount,
      reservesByGroup: byGroup.map((g) => ({
        groupId: g.groupId,
        groupName: gMap.get(g.groupId) ?? "—",
        activeCount: g._count.id,
        remainingReserveAmount:
          g._sum.remainingReserveAmount?.toFixed(2) ?? "0.00",
      })),
    };
  }
}
