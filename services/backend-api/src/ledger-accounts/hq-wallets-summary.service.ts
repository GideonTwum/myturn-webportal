import { Injectable } from "@nestjs/common";
import { LedgerAccountType, Prisma, WithdrawalStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ContributionGuaranteeReserveService } from "./contribution-guarantee-reserve.service";
import { LedgerAccountService } from "./ledger-account.service";

@Injectable()
export class HqWalletsSummaryService {
  constructor(
    private prisma: PrismaService,
    private accounts: LedgerAccountService,
    private reserves: ContributionGuaranteeReserveService,
  ) {}

  async getSummary() {
    const [platformFloat, myturnRevenue, clearing, reserveSummary] =
      await Promise.all([
        this.accounts.getOrCreatePlatformFloat(),
        this.accounts.getOrCreateMyturnRevenue(),
        this.accounts.getOrCreateWithdrawalClearing(),
        this.reserves.getHqSummary(),
      ]);

    const [
      memberAvailable,
      memberReserved,
      legacyMemberWallets,
      legacyAdminWallets,
      groupPools,
      pendingWithdrawals,
      completedWithdrawals,
    ] = await Promise.all([
      this.prisma.ledgerAccount.aggregate({
        where: { accountType: LedgerAccountType.MEMBER_WALLET_AVAILABLE },
        _sum: { balance: true },
      }),
      this.prisma.ledgerAccount.aggregate({
        where: { accountType: LedgerAccountType.MEMBER_WALLET_RESERVED },
        _sum: { balance: true },
      }),
      this.prisma.ledgerAccount.aggregate({
        where: { accountType: LedgerAccountType.MEMBER_WALLET },
        _sum: { balance: true },
      }),
      this.prisma.ledgerAccount.aggregate({
        where: { accountType: LedgerAccountType.ADMIN_EARNINGS },
        _sum: { balance: true },
      }),
      this.prisma.ledgerAccount.aggregate({
        where: { accountType: LedgerAccountType.GROUP_POOL },
        _sum: { balance: true },
      }),
      this.prisma.withdrawalRequest.aggregate({
        where: {
          status: {
            in: [WithdrawalStatus.PENDING, WithdrawalStatus.PROCESSING],
          },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.withdrawalRequest.aggregate({
        where: { status: WithdrawalStatus.COMPLETED },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    const availableLiabilities =
      memberAvailable._sum.balance ?? new Prisma.Decimal(0);
    const reservedLiabilities =
      memberReserved._sum.balance ?? new Prisma.Decimal(0);
    const legacyMemberLiabilities =
      legacyMemberWallets._sum.balance ?? new Prisma.Decimal(0);
    const memberLiabilities = availableLiabilities
      .add(reservedLiabilities)
      .add(legacyMemberLiabilities);
    const legacyAdminLiabilities =
      legacyAdminWallets._sum.balance ?? new Prisma.Decimal(0);
    const groupPoolBalance = groupPools._sum.balance ?? new Prisma.Decimal(0);

    return {
      marginModel: "myturn-100",
      platformFloatBalance: new Prisma.Decimal(
        platformFloat.balance.toString(),
      ).toFixed(2),
      myturnRevenueBalance: new Prisma.Decimal(
        myturnRevenue.balance.toString(),
      ).toFixed(2),
      totalMemberWalletAvailable: availableLiabilities.toFixed(2),
      totalMemberWalletReserved: reservedLiabilities.toFixed(2),
      totalMemberWalletLiabilities: memberLiabilities.toFixed(2),
      legacyAdminEarningsLiabilities: legacyAdminLiabilities.toFixed(2),
      totalAdminEarningsLiabilities: legacyAdminLiabilities.toFixed(2),
      totalGroupPoolBalance: groupPoolBalance.toFixed(2),
      withdrawalClearingBalance: new Prisma.Decimal(
        clearing.balance.toString(),
      ).toFixed(2),
      totalPendingWithdrawals:
        pendingWithdrawals._sum.amount?.toFixed(2) ?? "0.00",
      pendingWithdrawalsCount: pendingWithdrawals._count.id,
      totalCompletedWithdrawals:
        completedWithdrawals._sum.amount?.toFixed(2) ?? "0.00",
      completedWithdrawalsCount: completedWithdrawals._count.id,
      contributionGuaranteeReserves: reserveSummary,
    };
  }
}
