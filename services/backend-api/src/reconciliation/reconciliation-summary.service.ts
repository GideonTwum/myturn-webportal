import { Injectable } from "@nestjs/common";
import {
  LedgerAccountType,
  PayoutStatus,
  Prisma,
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

  async getSummary() {
    const platformFloat = await this.accounts.getOrCreatePlatformFloat();
    const myturnRevenue = await this.accounts.getOrCreateMyturnRevenue();
    const clearing = await this.accounts.getOrCreateWithdrawalClearing();

    const memberWallets = await this.prisma.ledgerAccount.aggregate({
      where: { accountType: LedgerAccountType.MEMBER_WALLET },
      _sum: { balance: true },
    });
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

    const completedWithdrawals = await this.prisma.withdrawalRequest.aggregate({
      where: { status: WithdrawalStatus.COMPLETED },
      _sum: { amount: true },
      _count: { id: true },
    });

    const adminEarningsRecorded = await this.prisma.adminEarning.aggregate({
      _sum: { adminShareAmount: true, platformShareAmount: true, marginAmount: true },
    });

    const platformBalance = new Prisma.Decimal(platformFloat.balance.toString());
    const memberLiabilities = memberWallets._sum.balance ?? new Prisma.Decimal(0);
    const adminLiabilities = adminWallets._sum.balance ?? new Prisma.Decimal(0);
    const revenueBalance = new Prisma.Decimal(myturnRevenue.balance.toString());
    const groupPoolBalance = groupPools._sum.balance ?? new Prisma.Decimal(0);
    const clearingBalance = new Prisma.Decimal(clearing.balance.toString());

    const totalWalletLiabilities = memberLiabilities
      .add(adminLiabilities)
      .add(revenueBalance)
      .add(groupPoolBalance)
      .add(clearingBalance);

    const discrepancies: string[] = [];

    const marginRecorded = adminEarningsRecorded._sum.marginAmount ?? new Prisma.Decimal(0);
    const marginInRevenueWallets = adminLiabilities.add(revenueBalance);
    if (
      marginRecorded.gt(0) &&
      marginInRevenueWallets.sub(marginRecorded).abs().gt(new Prisma.Decimal("0.05"))
    ) {
      discrepancies.push(
        `AdminEarning margin total (${marginRecorded}) differs from wallet margin balances (${marginInRevenueWallets})`,
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

    const legacyWalletMismatch = await this.prisma.$queryRaw<
      Array<{ userId: string; walletBalance: string; ledgerBalance: string }>
    >`
      SELECT w."userId", w.balance::text AS "walletBalance", la.balance::text AS "ledgerBalance"
      FROM "Wallet" w
      INNER JOIN "LedgerAccount" la ON la."accountKey" = 'MEMBER_WALLET:' || w."userId" || ':GHS'
      WHERE ABS(w.balance - la.balance) > 0.01
      LIMIT 10
    `.catch(() => []);
    for (const row of legacyWalletMismatch) {
      discrepancies.push(
        `Legacy Wallet vs MEMBER_WALLET mismatch for user ${row.userId} (wallet=${row.walletBalance}, ledger=${row.ledgerBalance})`,
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
      adminEarningsLiabilities: adminLiabilities.toFixed(2),
      myturnRevenueBalance: revenueBalance.toFixed(2),
      withdrawalClearing: clearingBalance.toFixed(2),
      totalWalletLiabilities: totalWalletLiabilities.toFixed(2),
      totalWithdrawalsPending: pendingWithdrawals._sum.amount?.toFixed(2) ?? "0.00",
      pendingWithdrawalsCount: pendingWithdrawals._count.id,
      totalWithdrawalsCompleted:
        completedWithdrawals._sum.amount?.toFixed(2) ?? "0.00",
      completedWithdrawalsCount: completedWithdrawals._count.id,
      adminEarningsRecorded: adminEarningsRecorded._sum.adminShareAmount?.toFixed(2) ?? "0.00",
      platformRevenueRecorded:
        adminEarningsRecorded._sum.platformShareAmount?.toFixed(2) ?? "0.00",
      discrepancies,
    };
  }
}
