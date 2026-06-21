import {
  BadRequestException,
  Injectable,
  Logger,
} from "@nestjs/common";
import {
  ContributionStatus,
  PaymentStatus,
  PaymentType,
  PayoutStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import { summarizeCycle } from "@myturn/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ContributionGuaranteeReserveService } from "./contribution-guarantee-reserve.service";
import { LedgerAccountService } from "./ledger-account.service";
import { LedgerPostingService } from "./ledger-posting.service";

export type ContributionSettlementContext = {
  contributionId: string;
  recordedByUserId: string;
  recordedByRole: UserRole;
  amount: Prisma.Decimal;
  paidDayIndex: number;
  expectedDayCount: number;
  provider?: string;
  externalRef?: string;
  paymentRequestId?: string;
  mock?: boolean;
};

function toMinor(amount: Prisma.Decimal): bigint {
  return BigInt(amount.mul(100).toFixed(0));
}

function fromMinor(minor: bigint): Prisma.Decimal {
  return new Prisma.Decimal(minor.toString()).div(100);
}

@Injectable()
export class FinancialAllocationService {
  private readonly logger = new Logger(FinancialAllocationService.name);

  constructor(
    private prisma: PrismaService,
    private accounts: LedgerAccountService,
    private posting: LedgerPostingService,
    private reserve: ContributionGuaranteeReserveService,
  ) {}

  /**
   * Record one contribution day payment + allocate to platform float and group pool.
   */
  async recordContributionSettlement(ctx: ContributionSettlementContext) {
    const contribution = await this.prisma.contribution.findUnique({
      where: { id: ctx.contributionId },
      include: { group: true },
    });
    if (!contribution) {
      throw new BadRequestException("Contribution not found");
    }

    const complete = ctx.paidDayIndex >= ctx.expectedDayCount;
    const idempotencyBase = ctx.paymentRequestId
      ? `allocation:payment-request:${ctx.paymentRequestId}:${ctx.paidDayIndex}`
      : `allocation:contribution:${ctx.contributionId}:day:${ctx.paidDayIndex}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.contribution.updateMany({
        where: {
          id: ctx.contributionId,
          status: { not: ContributionStatus.PAID },
          paidDayCount: ctx.paidDayIndex - 1,
        },
        data: {
          paidDayCount: ctx.paidDayIndex,
          status: complete ? ContributionStatus.PAID : ContributionStatus.PENDING,
          paidAt: complete ? new Date() : null,
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException(
          "Could not record payment (already updated or completed)",
        );
      }

      const externalRef =
        ctx.externalRef?.trim() ||
        (ctx.mock ? `mock_${Date.now()}` : `pay_${contribution.id}_${ctx.paidDayIndex}`);

      if (ctx.externalRef) {
        const dup = await tx.payment.findUnique({
          where: { externalRef: ctx.externalRef },
        });
        if (dup) {
          return { payment: dup, duplicate: true as const, reserveRelease: null };
        }
      }

      const payment = await tx.payment.create({
        data: {
          userId: contribution.userId,
          groupId: contribution.groupId,
          contributionId: contribution.id,
          amount: ctx.amount,
          type: PaymentType.CONTRIBUTION,
          status: PaymentStatus.COMPLETED,
          externalRef,
          completedAt: new Date(),
          metadata: {
            paidDayIndex: ctx.paidDayIndex,
            expectedDayCount: ctx.expectedDayCount,
            provider: ctx.provider ?? (ctx.mock ? "mock" : "unknown"),
            paymentRequestId: ctx.paymentRequestId ?? null,
            memberId: contribution.userId,
            groupId: contribution.groupId,
            mockContributionPayment: ctx.mock ?? false,
          },
        },
      });

      const external = await this.accounts.getOrCreateSystemExternal(tx);
      const platformFloat = await this.accounts.getOrCreatePlatformFloat(tx);
      const groupPool = await this.accounts.getOrCreateGroupPool(
        contribution.groupId,
        tx,
      );

      await this.posting.postJournalInTx(tx, {
        idempotencyKey: `${idempotencyBase}:inflow`,
        referenceType: "Payment",
        referenceId: payment.id,
        description: `Contribution collected (${ctx.provider ?? "mock"})`,
        metadata: {
          contributionId: contribution.id,
          groupId: contribution.groupId,
          externalRef,
        },
        lines: [
          { accountId: external.id, delta: ctx.amount.mul(-1) },
          { accountId: platformFloat.id, delta: ctx.amount },
          { accountId: platformFloat.id, delta: ctx.amount.mul(-1) },
          { accountId: groupPool.id, delta: ctx.amount },
        ],
      });

      const reserveRelease =
        await this.reserve.tryReleaseOnPaymentSettledInTx(tx, {
          userId: contribution.userId,
          groupId: contribution.groupId,
          contributionId: contribution.id,
          paymentId: payment.id,
          cycleNumber: contribution.cycleNumber,
          paidDayIndex: ctx.paidDayIndex,
        });

      return { payment, duplicate: false as const, reserveRelease };
    });

    if (result.reserveRelease?.released) {
      await this.reserve.notifyReserveReleased(result.reserveRelease);
    }

    return result;
  }

  /**
   * Allocate cycle gross pool to recipient available/reserved wallets and MyTurn revenue.
   */
  async allocateCycleFinalizationInTx(
    tx: Prisma.TransactionClient,
    params: {
      groupId: string;
      cycleNumber: number;
      payoutId: string;
      recipientUserId: string;
      adminUserId: string;
      contributionPerDay: Prisma.Decimal;
      memberCount: number;
      serviceMarginBps: number;
      daysPerCycle: number;
      payoutPosition: number;
      totalPositions: number;
    },
  ) {
    const contributionMinor = toMinor(params.contributionPerDay);
    const summary = summarizeCycle(
      params.cycleNumber,
      contributionMinor,
      params.memberCount,
      params.serviceMarginBps,
      params.daysPerCycle,
    );

    const gross = fromMinor(summary.grossPoolAmountMinor);
    const net = fromMinor(summary.netAfterMarginMinor);
    const adminShare = fromMinor(summary.adminShareMinor);
    const platformShare = fromMinor(summary.platformShareMinor);

    const split = this.reserve.computeSplit(
      summary.netAfterMarginMinor,
      params.payoutPosition,
      params.totalPositions,
      params.daysPerCycle,
    );
    const available = fromMinor(split.availableMinor);
    const reserveAmount = fromMinor(split.reserveMinor);

    await this.reserve.ensureLegacyWalletMigratedInTx(tx, params.recipientUserId);

    const groupPool = await this.accounts.getOrCreateGroupPool(params.groupId, tx);
    const memberAvailable = await this.accounts.getOrCreateMemberWalletAvailable(
      params.recipientUserId,
      tx,
    );
    const memberReserved = await this.accounts.getOrCreateMemberWalletReserved(
      params.recipientUserId,
      tx,
    );
    const myturnRevenue = await this.accounts.getOrCreateMyturnRevenue(tx);

    const lines: { accountId: string; delta: Prisma.Decimal }[] = [
      { accountId: groupPool.id, delta: gross.mul(-1) },
      { accountId: memberAvailable.id, delta: available },
      { accountId: myturnRevenue.id, delta: platformShare },
    ];
    if (split.reserveMinor > 0n) {
      lines.push({ accountId: memberReserved.id, delta: reserveAmount });
    }

    await this.posting.postJournalInTx(tx, {
      idempotencyKey: `allocation:cycle-finalize:${params.payoutId}`,
      referenceType: "Payout",
      referenceId: params.payoutId,
      description: `Cycle ${params.cycleNumber} wallet allocation`,
      metadata: {
        groupId: params.groupId,
        cycleNumber: params.cycleNumber,
        gross: gross.toString(),
        net: net.toString(),
        available: available.toString(),
        reserved: reserveAmount.toString(),
        reserveBps: split.reserveBps,
        adminShare: "0",
        platformShare: platformShare.toString(),
        marginModel: "myturn-100",
      },
      lines,
    });

    const reserveRecord = await this.reserve.createReserveOnPayoutInTx(tx, {
      userId: params.recipientUserId,
      groupId: params.groupId,
      payoutId: params.payoutId,
      cycleNumber: params.cycleNumber,
      payoutPosition: params.payoutPosition,
      totalPositions: params.totalPositions,
      paymentUnitsPerCycle: params.daysPerCycle,
      netPayoutMinor: summary.netAfterMarginMinor,
      split,
    });

    return {
      summary,
      gross,
      net,
      adminShare,
      platformShare,
      availableAmount: available,
      reserveAmount,
      reserveBps: split.reserveBps,
      reserveRecordId: reserveRecord?.id ?? null,
    };
  }

  async getMemberWalletSummary(userId: string) {
    await this.prisma.$transaction((tx) =>
      this.reserve.ensureLegacyWalletMigratedInTx(tx, userId),
    );

    const [availableAcct, reservedAcct, depositEscrowAcct] = await Promise.all([
      this.accounts.getOrCreateMemberWalletAvailable(userId),
      this.accounts.getOrCreateMemberWalletReserved(userId),
      this.accounts.getOrCreateMemberDepositEscrow(userId),
    ]);

    const pending = await this.prisma.withdrawalRequest.aggregate({
      where: {
        actorId: userId,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      _sum: { amount: true },
    });

    const creditedPayouts = await this.prisma.payout.aggregate({
      where: {
        recipientId: userId,
        status: { in: [PayoutStatus.CREDITED, PayoutStatus.COMPLETED] },
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const completedWithdrawals = await this.prisma.withdrawalRequest.aggregate({
      where: { actorId: userId, status: "COMPLETED" },
      _sum: { amount: true },
    });

    const activeReserves = await this.reserve.listActiveForUser(userId);

    const availableBal = new Prisma.Decimal(availableAcct.balance.toString());
    const reservedBal = new Prisma.Decimal(reservedAcct.balance.toString());
    const depositEscrowBal = new Prisma.Decimal(depositEscrowAcct.balance.toString());
    const totalBal = availableBal.add(reservedBal).add(depositEscrowBal);
    const pendingSum = pending._sum.amount ?? new Prisma.Decimal(0);
    const withdrawable = Prisma.Decimal.max(
      availableBal.sub(pendingSum),
      new Prisma.Decimal(0),
    );

    const reserveDetails = activeReserves.map((r) => ({
      groupId: r.groupId,
      groupName: r.group.name,
      payoutCycle: r.cycleNumber,
      ...this.reserve.mapReserveRow(r),
    }));

    const nextReserveUnlockAmount =
      reserveDetails.length > 0
        ? reserveDetails[0]!.nextUnlockAmount
        : "0.00";

    const totalOriginal = activeReserves.reduce(
      (s, r) => s + Number(r.originalReserveAmount),
      0,
    );
    const totalReleased = activeReserves.reduce(
      (s, r) => s + Number(r.releasedAmount),
      0,
    );
    const reserveProgress =
      totalOriginal > 0
        ? Math.round((totalReleased / totalOriginal) * 100)
        : 100;

    return {
      accountId: availableAcct.id,
      currency: availableAcct.currency,
      balance: totalBal.toFixed(2),
      availableBalance: withdrawable.toFixed(2),
      reservedBalance: reservedBal.toFixed(2),
      depositEscrowBalance: depositEscrowBal.toFixed(2),
      totalBalance: totalBal.toFixed(2),
      pendingWithdrawals: pendingSum.toFixed(2),
      nextReserveUnlockAmount,
      activeReserveCount: activeReserves.length,
      reserveProgress,
      reserveDetails,
      totalPayoutsCredited: creditedPayouts._sum.amount?.toFixed(2) ?? "0.00",
      payoutsCreditedCount: creditedPayouts._count.id,
      totalWithdrawn: completedWithdrawals._sum.amount?.toFixed(2) ?? "0.00",
    };
  }

  /**
   * @deprecated Admin earnings wallets removed. Returns zeros + deprecation notice.
   */
  async getAdminWalletSummary(adminId: string) {
    void adminId;
    const account = await this.accounts.getOrCreateAdminEarnings(adminId);

    const pending = await this.prisma.withdrawalRequest.aggregate({
      where: {
        actorId: adminId,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      _sum: { amount: true },
    });

    const totalEarnings = await this.prisma.adminEarning.aggregate({
      where: { adminId },
      _sum: { adminShareAmount: true },
    });

    const completedWithdrawals = await this.prisma.withdrawalRequest.aggregate({
      where: { actorId: adminId, status: "COMPLETED" },
      _sum: { amount: true },
    });

    const pendingSum = pending._sum.amount ?? new Prisma.Decimal(0);
    const balance = new Prisma.Decimal(account.balance.toString());
    const available = Prisma.Decimal.max(balance.sub(pendingSum), new Prisma.Decimal(0));

    return {
      deprecated: true,
      message:
        "Admin earnings wallets are deprecated. Compensation is managed separately by MyTurn.",
      accountId: account.id,
      currency: account.currency,
      balance: "0.00",
      availableBalance: "0.00",
      pendingWithdrawals: "0.00",
      totalEarningsRecorded: "0.00",
      totalWithdrawn: completedWithdrawals._sum.amount?.toFixed(2) ?? "0.00",
      legacyBalance: balance.toFixed(2),
      legacyEarningsRecorded:
        totalEarnings._sum.adminShareAmount?.toFixed(2) ?? "0.00",
    };
  }

  async listAccountActivity(accountId: string, take = 50) {
    const lines = await this.prisma.ledgerLine.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        transaction: {
          select: {
            id: true,
            referenceType: true,
            referenceId: true,
            description: true,
            createdAt: true,
          },
        },
      },
    });
    return {
      activity: lines.map((l) => ({
        id: l.id,
        delta: l.delta.toString(),
        balanceAfter: l.balanceAfter.toString(),
        referenceType: l.transaction.referenceType,
        referenceId: l.transaction.referenceId,
        description: l.transaction.description,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  }
}
