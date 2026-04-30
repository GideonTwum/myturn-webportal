import { Injectable } from "@nestjs/common";
import {
  DepositStatus,
  LedgerEntryType,
  MemberCycleStanding,
  PaymentStatus,
  PaymentType,
  PayoutMode,
  Prisma,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { WalletsService } from "../wallets/wallets.service";

export type JoinDepositResult = {
  depositAmount: Prisma.Decimal;
  depositStatus: DepositStatus;
};

@Injectable()
export class CycleDepositsService {
  constructor(
    private prisma: PrismaService,
    private wallets: WalletsService,
    private ledger: LedgerService,
  ) {}

  depositRequiredAmount(group: {
    contributionAmount: Decimal | Prisma.Decimal;
    daysPerCycle: number;
    payoutMode: PayoutMode;
  }): Prisma.Decimal {
    if (group.payoutMode !== PayoutMode.CYCLE) {
      return new Prisma.Decimal(0);
    }
    return new Prisma.Decimal(group.contributionAmount.toString()).mul(
      group.daysPerCycle,
    );
  }

  /**
   * CYCLE: lock contribution×days in wallet.lockedBalance and record a mock DEPOSIT payment.
   * DAILY: no deposit.
   */
  async applyDepositOnJoin(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      groupId: string;
      memberId: string;
      group: {
        contributionAmount: Decimal | Prisma.Decimal;
        daysPerCycle: number;
        payoutMode: PayoutMode;
        name: string;
      };
    },
  ): Promise<JoinDepositResult> {
    if (params.group.payoutMode !== PayoutMode.CYCLE) {
      return {
        depositAmount: new Prisma.Decimal(0),
        depositStatus: DepositStatus.NOT_REQUIRED,
      };
    }

    const amount = this.depositRequiredAmount(params.group);
    if (amount.lte(0)) {
      return {
        depositAmount: new Prisma.Decimal(0),
        depositStatus: DepositStatus.NOT_REQUIRED,
      };
    }

    await this.wallets.addLockedEscrow(tx, params.userId, amount);

    const pay = await tx.payment.create({
      data: {
        userId: params.userId,
        groupId: params.groupId,
        amount,
        type: PaymentType.DEPOSIT,
        status: PaymentStatus.COMPLETED,
        externalRef: `deposit_${params.memberId}_${Date.now()}`,
        completedAt: new Date(),
        metadata: {
          mockDeposit: true,
          groupMemberId: params.memberId,
        },
      },
    });

    await this.ledger.record(
      {
        type: LedgerEntryType.CREDIT,
        amount,
        userId: params.userId,
        groupId: params.groupId,
        referenceType: "Deposit",
        referenceId: pay.id,
        description: `Security deposit held in escrow for ${params.group.name} (CYCLE mode)`,
        applyToWallet: false,
      },
      tx,
    );

    return { depositAmount: amount, depositStatus: DepositStatus.HELD };
  }

  async forfeitDepositForDefaulted(
    tx: Prisma.TransactionClient,
    params: {
      memberId: string;
      userId: string;
      groupId: string;
      groupName: string;
    },
  ): Promise<void> {
    const m = await tx.groupMember.findUnique({
      where: { id: params.memberId },
    });
    if (!m || m.depositStatus !== DepositStatus.HELD) {
      return;
    }
    const amt = new Prisma.Decimal(m.depositAmount.toString());
    if (amt.lte(0)) {
      await tx.groupMember.update({
        where: { id: params.memberId },
        data: { depositStatus: DepositStatus.FORFEITED },
      });
      return;
    }

    await this.wallets.reduceLockedEscrow(tx, params.userId, amt);

    await tx.groupMember.update({
      where: { id: params.memberId },
      data: { depositStatus: DepositStatus.FORFEITED },
    });

    await tx.user.update({
      where: { id: params.userId },
      data: { cycleDefaultFlagged: true },
    });

    await this.ledger.record(
      {
        type: LedgerEntryType.DEBIT,
        amount: amt,
        userId: params.userId,
        groupId: params.groupId,
        referenceType: "DepositForfeit",
        referenceId: params.memberId,
        description: `Forfeited security deposit (DEFAULTED) for ${params.groupName}`,
        applyToWallet: false,
      },
      tx,
    );
  }

  /** When the whole group completes, return held deposits to spendable balance. */
  async releaseAllHeldDepositsForGroup(
    tx: Prisma.TransactionClient,
    groupId: string,
  ): Promise<void> {
    const members = await tx.groupMember.findMany({
      where: {
        groupId,
        depositStatus: DepositStatus.HELD,
      },
    });
    for (const m of members) {
      const amt = new Prisma.Decimal(m.depositAmount.toString());
      if (amt.lte(0)) continue;
      if (m.cycleStanding === MemberCycleStanding.DEFAULTED) continue;
      await this.wallets.releaseLockedToBalance(tx, m.userId, amt);
      await tx.groupMember.update({
        where: { id: m.id },
        data: { depositStatus: DepositStatus.RELEASED },
      });
      await this.ledger.record(
        {
          type: LedgerEntryType.CREDIT,
          amount: amt,
          userId: m.userId,
          groupId,
          referenceType: "DepositRelease",
          referenceId: m.id,
          description: "Security deposit released (group completed)",
          applyToWallet: false,
        },
        tx,
      );
    }
  }
}
