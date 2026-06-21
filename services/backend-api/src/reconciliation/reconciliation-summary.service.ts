import { Injectable } from "@nestjs/common";
import {
  LedgerAccountType,
  PayoutStatus,
  Prisma,
  WithdrawalActorRole,
  WithdrawalStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerAccountService } from "../ledger-accounts/ledger-account.service";

@Injectable()
export class ReconciliationSummaryService {
  constructor(
    private prisma: PrismaService,
    private accounts: LedgerAccountService,
  ) {}

  async getLatestSnapshot() {
    const snap = await this.prisma.reconciliationSnapshot.findFirst({
      orderBy: { createdAt: "desc" },
    });
    if (!snap) return null;
    return {
      id: snap.id,
      status: snap.status,
      discrepancyCount: snap.discrepancyCount,
      summary: snap.summary,
      createdAt: snap.createdAt.toISOString(),
    };
  }

  async getSummary() {
    const platformFloat = await this.accounts.getOrCreatePlatformFloat();
    const myturnRevenue = await this.accounts.getOrCreateMyturnRevenue();
    const clearing = await this.accounts.getOrCreateWithdrawalClearing();

    const [memberAvailable, memberReserved, memberDepositEscrow, legacyMemberWallets] =
      await Promise.all([
        this.prisma.ledgerAccount.aggregate({
          where: { accountType: LedgerAccountType.MEMBER_WALLET_AVAILABLE },
          _sum: { balance: true },
        }),
        this.prisma.ledgerAccount.aggregate({
          where: { accountType: LedgerAccountType.MEMBER_WALLET_RESERVED },
          _sum: { balance: true },
        }),
        this.prisma.ledgerAccount.aggregate({
          where: { accountType: LedgerAccountType.MEMBER_DEPOSIT_ESCROW },
          _sum: { balance: true },
        }),
        this.prisma.ledgerAccount.aggregate({
          where: { accountType: LedgerAccountType.MEMBER_WALLET },
          _sum: { balance: true },
        }),
      ]);
    const adminWallets = await this.prisma.ledgerAccount.aggregate({
      where: { accountType: LedgerAccountType.ADMIN_EARNINGS },
      _sum: { balance: true },
    });
    const groupPools = await this.prisma.ledgerAccount.aggregate({
      where: { accountType: LedgerAccountType.GROUP_POOL },
      _sum: { balance: true },
    });

    const totalCollected = await this.prisma.payment.aggregate({
      where: { type: "CONTRIBUTION", status: "COMPLETED" },
      _sum: { amount: true },
    });

    const pendingWithdrawals = await this.prisma.withdrawalRequest.aggregate({
      where: { status: { in: [WithdrawalStatus.PENDING, WithdrawalStatus.PROCESSING] } },
      _sum: { amount: true },
      _count: { id: true },
    });

    const memberProcessing = await this.prisma.withdrawalRequest.aggregate({
      where: {
        actorRole: WithdrawalActorRole.MEMBER,
        status: WithdrawalStatus.PROCESSING,
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const memberCompleted = await this.prisma.withdrawalRequest.aggregate({
      where: {
        actorRole: WithdrawalActorRole.MEMBER,
        status: WithdrawalStatus.COMPLETED,
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const memberFailed = await this.prisma.withdrawalRequest.aggregate({
      where: {
        actorRole: WithdrawalActorRole.MEMBER,
        status: WithdrawalStatus.FAILED,
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const adminProcessing = await this.prisma.withdrawalRequest.aggregate({
      where: {
        actorRole: WithdrawalActorRole.ADMIN,
        status: WithdrawalStatus.PROCESSING,
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const adminCompleted = await this.prisma.withdrawalRequest.aggregate({
      where: {
        actorRole: WithdrawalActorRole.ADMIN,
        status: WithdrawalStatus.COMPLETED,
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const adminFailed = await this.prisma.withdrawalRequest.aggregate({
      where: {
        actorRole: WithdrawalActorRole.ADMIN,
        status: WithdrawalStatus.FAILED,
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const completedWithdrawals = await this.prisma.withdrawalRequest.aggregate({
      where: { status: WithdrawalStatus.COMPLETED },
      _sum: { amount: true },
      _count: { id: true },
    });

    const staleThreshold = new Date(Date.now() - 30 * 60 * 1000);
    const staleMemberProcessingCount = await this.prisma.withdrawalRequest.count({
      where: {
        actorRole: WithdrawalActorRole.MEMBER,
        status: WithdrawalStatus.PROCESSING,
        requestedAt: { lt: staleThreshold },
      },
    });

    const staleAdminProcessingCount = await this.prisma.withdrawalRequest.count({
      where: {
        actorRole: WithdrawalActorRole.ADMIN,
        status: WithdrawalStatus.PROCESSING,
        requestedAt: { lt: staleThreshold },
      },
    });

    const adminCompletedWithoutRef = await this.prisma.withdrawalRequest.count({
      where: {
        actorRole: WithdrawalActorRole.ADMIN,
        status: WithdrawalStatus.COMPLETED,
        OR: [{ providerRef: null }, { providerRef: "" }],
      },
    });

    const memberHeldInClearing = await this.prisma.withdrawalRequest.aggregate({
      where: {
        actorRole: WithdrawalActorRole.MEMBER,
        status: { in: [WithdrawalStatus.PENDING, WithdrawalStatus.PROCESSING] },
      },
      _sum: { amount: true },
    });

    const adminHeldInClearing = await this.prisma.withdrawalRequest.aggregate({
      where: {
        actorRole: WithdrawalActorRole.ADMIN,
        status: { in: [WithdrawalStatus.PENDING, WithdrawalStatus.PROCESSING] },
      },
      _sum: { amount: true },
    });

    const failedWithoutRelease = await this.prisma.withdrawalRequest.count({
      where: {
        status: WithdrawalStatus.FAILED,
        processedAt: { not: null },
      },
    });

    const adminEarningsRecorded = await this.prisma.adminEarning.aggregate({
      _sum: { adminShareAmount: true, platformShareAmount: true, marginAmount: true },
    });

    const platformBalance = new Prisma.Decimal(platformFloat.balance.toString());
    const memberAvailableLiabilities =
      memberAvailable._sum.balance ?? new Prisma.Decimal(0);
    const memberReservedLiabilities =
      memberReserved._sum.balance ?? new Prisma.Decimal(0);
    const memberDepositEscrowLiabilities =
      memberDepositEscrow._sum.balance ?? new Prisma.Decimal(0);
    const legacyMemberLiabilities =
      legacyMemberWallets._sum.balance ?? new Prisma.Decimal(0);
    const memberLiabilities = memberAvailableLiabilities
      .add(memberReservedLiabilities)
      .add(memberDepositEscrowLiabilities)
      .add(legacyMemberLiabilities);
    const adminLiabilities = adminWallets._sum.balance ?? new Prisma.Decimal(0);
    const revenueBalance = new Prisma.Decimal(myturnRevenue.balance.toString());
    const groupPoolBalance = groupPools._sum.balance ?? new Prisma.Decimal(0);
    const clearingBalance = new Prisma.Decimal(clearing.balance.toString());

    // Float ≈ Group Pools + Member Available + Member Reserved + MyTurn Revenue + Clearing
    const totalWalletLiabilities = memberAvailableLiabilities
      .add(memberReservedLiabilities)
      .add(memberDepositEscrowLiabilities)
      .add(legacyMemberLiabilities)
      .add(revenueBalance)
      .add(groupPoolBalance)
      .add(clearingBalance);

    const discrepancies: string[] = [];

    const marginRecorded = adminEarningsRecorded._sum.marginAmount ?? new Prisma.Decimal(0);
    const marginInRevenueWallets = revenueBalance;
    if (
      marginRecorded.gt(0) &&
      marginInRevenueWallets.sub(marginRecorded).abs().gt(new Prisma.Decimal("0.05"))
    ) {
      discrepancies.push(
        `Recorded margin total (${marginRecorded}) differs from MyTurn revenue wallet (${marginInRevenueWallets})`,
      );
    }

    if (adminLiabilities.gt(new Prisma.Decimal("0.01"))) {
      discrepancies.push(
        `Legacy ADMIN_EARNINGS balance ${adminLiabilities} — should not grow after wallet simplification`,
      );
    }

    const recentAdminShare = await this.prisma.adminEarning.count({
      where: {
        adminShareAmount: { gt: 0 },
        settledAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });
    if (recentAdminShare > 0) {
      discrepancies.push(
        `${recentAdminShare} AdminEarning row(s) with non-zero admin share in last 7 days (unexpected)`,
      );
    }

    const collected = totalCollected._sum.amount ?? new Prisma.Decimal(0);
    const allocatedApprox = groupPoolBalance
      .add(memberLiabilities)
      .add(adminLiabilities)
      .add(revenueBalance);

    if (groupPoolBalance.lt(0)) {
      discrepancies.push(`Group pool aggregate balance is negative (${groupPoolBalance})`);
    }

    const negativeAccounts = await this.prisma.ledgerAccount.findMany({
      where: {
        accountType: { not: LedgerAccountType.SYSTEM_EXTERNAL },
        balance: { lt: 0 },
      },
      select: { accountKey: true, balance: true },
      take: 10,
    });
    for (const acct of negativeAccounts) {
      discrepancies.push(
        `Negative ledger balance on ${acct.accountKey}: ${acct.balance}`,
      );
    }

    const completedWithoutRef = await this.prisma.withdrawalRequest.count({
      where: {
        status: WithdrawalStatus.COMPLETED,
        OR: [{ providerRef: null }, { providerRef: "" }],
      },
    });
    if (completedWithoutRef > 0) {
      discrepancies.push(
        `${completedWithoutRef} completed withdrawal(s) missing providerRef`,
      );
    }

    if (staleMemberProcessingCount > 0) {
      discrepancies.push(
        `${staleMemberProcessingCount} member withdrawal(s) stuck in PROCESSING (>30m)`,
      );
    }

    if (staleAdminProcessingCount > 0) {
      discrepancies.push(
        `${staleAdminProcessingCount} admin earnings withdrawal(s) stuck in PROCESSING (>30m)`,
      );
    }

    if (adminCompletedWithoutRef > 0) {
      discrepancies.push(
        `${adminCompletedWithoutRef} completed admin withdrawal(s) missing providerRef`,
      );
    }

    const memberHeldAmount = memberHeldInClearing._sum.amount ?? new Prisma.Decimal(0);
    const adminHeldAmount = adminHeldInClearing._sum.amount ?? new Prisma.Decimal(0);
    const expectedClearingHeld = memberHeldAmount.add(adminHeldAmount);
    if (expectedClearingHeld.sub(clearingBalance).abs().gt(new Prisma.Decimal("0.01"))) {
      discrepancies.push(
        `Withdrawal clearing balance ${clearingBalance} mismatches held withdrawals ${expectedClearingHeld} (member=${memberHeldAmount}, admin=${adminHeldAmount})`,
      );
    }

    if (clearingBalance.gt(0) && pendingWithdrawals._count.id === 0) {
      discrepancies.push(
        `Withdrawal clearing has balance ${clearingBalance} but no pending/processing withdrawals`,
      );
    }

    const duplicatePayoutCycles = await this.prisma.payout.groupBy({
      by: ["groupId", "cycleNumber"],
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
    });
    if (duplicatePayoutCycles.length > 0) {
      discrepancies.push(
        `${duplicatePayoutCycles.length} group/cycle pair(s) have duplicate payout records`,
      );
    }

    const creditedPayouts = await this.prisma.payout.findMany({
      where: { status: { in: [PayoutStatus.CREDITED, PayoutStatus.COMPLETED] } },
      select: { id: true },
      take: 500,
    });
    if (creditedPayouts.length > 0) {
      const payoutIds = creditedPayouts.map((p) => p.id);
      const ledgerLinks = await this.prisma.ledgerTransaction.findMany({
        where: {
          referenceType: "Payout",
          referenceId: { in: payoutIds },
        },
        select: { referenceId: true },
      });
      const linked = new Set(ledgerLinks.map((l) => l.referenceId));
      const missing = payoutIds.filter((id) => !linked.has(id));
      if (missing.length > 0) {
        discrepancies.push(
          `${missing.length} credited payout(s) have no matching ledger transaction`,
        );
      }
    }

    const staleLegacyWalletRows = await this.prisma.$queryRaw<
      Array<{ userId: string; balance: string; lockedBalance: string }>
    >`
      SELECT "userId", balance::text, "lockedBalance"::text AS "lockedBalance"
      FROM "Wallet"
      WHERE ABS(balance) > 0.01 OR ABS("lockedBalance") > 0.01
      LIMIT 10
    `.catch(() => []);
    for (const row of staleLegacyWalletRows) {
      discrepancies.push(
        `Legacy Wallet row has non-zero balance for user ${row.userId} (balance=${row.balance}, locked=${row.lockedBalance}) — financial truth is LedgerAccount only`,
      );
    }

    const unbalancedJournals = await this.prisma.$queryRaw<
      Array<{ transactionId: string; netDelta: string }>
    >`
      SELECT ll."transactionId", SUM(ll.delta)::text AS "netDelta"
      FROM "LedgerLine" ll
      GROUP BY ll."transactionId"
      HAVING ABS(SUM(ll.delta)) > 0.001
      LIMIT 5
    `.catch(() => []);
    for (const row of unbalancedJournals) {
      discrepancies.push(
        `Unbalanced ledger transaction ${row.transactionId} (net=${row.netDelta})`,
      );
    }

    return {
      status: discrepancies.length === 0 ? "ok" : "discrepancies_detected",
      totalCollected: collected.toFixed(2),
      totalAllocated: allocatedApprox.toFixed(2),
      platformFloat: platformBalance.toFixed(2),
      groupPoolTotal: groupPoolBalance.toFixed(2),
      memberWalletLiabilities: memberLiabilities.toFixed(2),
      memberWalletAvailable: memberAvailableLiabilities.toFixed(2),
      memberWalletReserved: memberReservedLiabilities.toFixed(2),
      memberDepositEscrow: memberDepositEscrowLiabilities.toFixed(2),
      /** @deprecated Use legacyAdminEarningsLiabilities — not part of active liability formula. */
      adminEarningsLiabilities: adminLiabilities.toFixed(2),
      myturnRevenueBalance: revenueBalance.toFixed(2),
      withdrawalClearing: clearingBalance.toFixed(2),
      totalWalletLiabilities: totalWalletLiabilities.toFixed(2),
      totalWithdrawalsPending: pendingWithdrawals._sum.amount?.toFixed(2) ?? "0.00",
      pendingWithdrawalsCount: pendingWithdrawals._count.id,
      totalWithdrawalsCompleted:
        completedWithdrawals._sum.amount?.toFixed(2) ?? "0.00",
      completedWithdrawalsCount: completedWithdrawals._count.id,
      memberWithdrawalsProcessing:
        memberProcessing._sum.amount?.toFixed(2) ?? "0.00",
      memberWithdrawalsProcessingCount: memberProcessing._count.id,
      memberWithdrawalsCompleted:
        memberCompleted._sum.amount?.toFixed(2) ?? "0.00",
      memberWithdrawalsCompletedCount: memberCompleted._count.id,
      memberWithdrawalsFailed:
        memberFailed._sum.amount?.toFixed(2) ?? "0.00",
      memberWithdrawalsFailedCount: memberFailed._count.id,
      staleMemberProcessingCount: staleMemberProcessingCount,
      adminWithdrawalsProcessing:
        adminProcessing._sum.amount?.toFixed(2) ?? "0.00",
      adminWithdrawalsProcessingCount: adminProcessing._count.id,
      adminWithdrawalsCompleted:
        adminCompleted._sum.amount?.toFixed(2) ?? "0.00",
      adminWithdrawalsCompletedCount: adminCompleted._count.id,
      adminWithdrawalsFailed:
        adminFailed._sum.amount?.toFixed(2) ?? "0.00",
      adminWithdrawalsFailedCount: adminFailed._count.id,
      staleAdminProcessingCount,
      failedWithdrawalsWithoutReleaseCount: failedWithoutRelease,
      legacyAdminEarningsLiabilities: adminLiabilities.toFixed(2),
      legacyAdminEarningsRecorded:
        adminEarningsRecorded._sum.adminShareAmount?.toFixed(2) ?? "0.00",
      /** @deprecated Use legacyAdminEarningsRecorded */
      adminEarningsRecorded:
        adminEarningsRecorded._sum.adminShareAmount?.toFixed(2) ?? "0.00",
      platformRevenueRecorded:
        adminEarningsRecorded._sum.platformShareAmount?.toFixed(2) ??
        adminEarningsRecorded._sum.marginAmount?.toFixed(2) ??
        "0.00",
      marginModel: "myturn-100",
      discrepancies,
    };
  }
}
