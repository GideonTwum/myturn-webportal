import {
  BadRequestException,
  Injectable,
  Logger,
} from "@nestjs/common";
import {
  ContributionStatus,
  GroupStatus,
  PaymentStatus,
  PaymentType,
  PayoutStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import { summarizeCycle } from "@myturn/shared";
import { memberCyclePaymentDays } from "../common/member-cycle-payment-days";
import { PrismaService } from "../prisma/prisma.service";
import { WalletsService } from "../wallets/wallets.service";
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
    private wallets: WalletsService,
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
          return { payment: dup, duplicate: true as const };
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

      return { payment, duplicate: false as const };
    });

    return result;
  }

  /**
   * Allocate cycle gross pool to recipient wallet, admin earnings, and MyTurn revenue.
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

    const groupPool = await this.accounts.getOrCreateGroupPool(params.groupId, tx);
    const memberWallet = await this.accounts.getOrCreateMemberWallet(
      params.recipientUserId,
      tx,
    );
    const adminEarnings = await this.accounts.getOrCreateAdminEarnings(
      params.adminUserId,
      tx,
    );
    const myturnRevenue = await this.accounts.getOrCreateMyturnRevenue(tx);

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
        adminShare: adminShare.toString(),
        platformShare: platformShare.toString(),
      },
      lines: [
        { accountId: groupPool.id, delta: gross.mul(-1) },
        { accountId: memberWallet.id, delta: net },
        { accountId: adminEarnings.id, delta: adminShare },
        { accountId: myturnRevenue.id, delta: platformShare },
      ],
    });

    await this.syncLegacyMemberWallet(params.recipientUserId, tx);

    return { summary, gross, net, adminShare, platformShare };
  }

  async syncLegacyMemberWallet(userId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    const account = await this.accounts.getOrCreateMemberWallet(userId, tx);
    await this.wallets.getOrCreate(userId);
    await db.wallet.update({
      where: { userId },
      data: { balance: account.balance, currency: account.currency },
    });
  }

  async getMemberWalletSummary(userId: string) {
    const account = await this.accounts.getOrCreateMemberWallet(userId);
    await this.syncLegacyMemberWallet(userId);

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

    const pendingSum = pending._sum.amount ?? new Prisma.Decimal(0);
    const balance = new Prisma.Decimal(account.balance.toString());
    const available = Prisma.Decimal.max(balance.sub(pendingSum), new Prisma.Decimal(0));

    return {
      accountId: account.id,
      currency: account.currency,
      balance: balance.toFixed(2),
      availableBalance: available.toFixed(2),
      pendingWithdrawals: pendingSum.toFixed(2),
      totalPayoutsCredited: creditedPayouts._sum.amount?.toFixed(2) ?? "0.00",
      payoutsCreditedCount: creditedPayouts._count.id,
      totalWithdrawn: completedWithdrawals._sum.amount?.toFixed(2) ?? "0.00",
    };
  }

  async getAdminWalletSummary(adminId: string) {
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
      accountId: account.id,
      currency: account.currency,
      balance: balance.toFixed(2),
      availableBalance: available.toFixed(2),
      pendingWithdrawals: pendingSum.toFixed(2),
      totalEarningsRecorded:
        totalEarnings._sum.adminShareAmount?.toFixed(2) ?? "0.00",
      totalWithdrawn: completedWithdrawals._sum.amount?.toFixed(2) ?? "0.00",
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
