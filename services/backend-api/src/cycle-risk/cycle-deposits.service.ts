import { Injectable } from "@nestjs/common";
import {
  DepositStatus,
  MemberCycleStanding,
  PaymentStatus,
  PaymentType,
  PayoutMode,
  Prisma,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { LedgerAccountService } from "../ledger-accounts/ledger-account.service";
import { LedgerPostingService } from "../ledger-accounts/ledger-posting.service";
import { PrismaService } from "../prisma/prisma.service";

export type JoinDepositResult = {
  depositAmount: Prisma.Decimal;
  depositStatus: DepositStatus;
};

@Injectable()
export class CycleDepositsService {
  constructor(
    private prisma: PrismaService,
    private accounts: LedgerAccountService,
    private posting: LedgerPostingService,
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
   * One-time migration: legacy Wallet.lockedBalance → MEMBER_DEPOSIT_ESCROW ledger account.
   */
  async ensureLegacyDepositEscrowMigratedInTx(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) return;

    const locked = new Prisma.Decimal(wallet.lockedBalance.toString());
    if (locked.lte(0)) return;

    const escrow = await this.accounts.getOrCreateMemberDepositEscrow(userId, tx);
    const escrowBal = new Prisma.Decimal(escrow.balance.toString());
    const gap = locked.sub(escrowBal);
    if (gap.lte(0)) {
      if (!wallet.lockedBalance.isZero()) {
        await tx.wallet.update({
          where: { userId },
          data: { lockedBalance: 0 },
        });
      }
      return;
    }

    const external = await this.accounts.getOrCreateSystemExternal(tx);
    await this.posting.postTransferInTx(tx, {
      idempotencyKey: `migration:deposit-escrow:${userId}`,
      referenceType: "DepositEscrowMigration",
      referenceId: userId,
      description: "Migrate legacy Wallet.lockedBalance to MEMBER_DEPOSIT_ESCROW",
      fromAccountId: external.id,
      toAccountId: escrow.id,
      amount: gap,
    });

    await tx.wallet.update({
      where: { userId },
      data: { lockedBalance: 0 },
    });
  }

  /**
   * CYCLE: hold contribution×days in MEMBER_DEPOSIT_ESCROW and record a mock DEPOSIT payment.
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

    await this.ensureLegacyDepositEscrowMigratedInTx(tx, params.userId);

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

    const external = await this.accounts.getOrCreateSystemExternal(tx);
    const escrow = await this.accounts.getOrCreateMemberDepositEscrow(
      params.userId,
      tx,
    );

    await this.posting.postTransferInTx(tx, {
      idempotencyKey: `deposit:hold:${pay.id}`,
      referenceType: "Deposit",
      referenceId: pay.id,
      description: `Security deposit held in escrow for ${params.group.name} (CYCLE mode)`,
      fromAccountId: external.id,
      toAccountId: escrow.id,
      amount,
    });

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

    await this.ensureLegacyDepositEscrowMigratedInTx(tx, params.userId);

    const escrow = await this.accounts.getOrCreateMemberDepositEscrow(
      params.userId,
      tx,
    );
    const groupPool = await this.accounts.getOrCreateGroupPool(params.groupId, tx);

    await this.posting.postTransferInTx(tx, {
      idempotencyKey: `deposit:forfeit:${params.memberId}`,
      referenceType: "DepositForfeit",
      referenceId: params.memberId,
      description: `Forfeited security deposit (DEFAULTED) for ${params.groupName}`,
      fromAccountId: escrow.id,
      toAccountId: groupPool.id,
      amount: amt,
    });

    await tx.groupMember.update({
      where: { id: params.memberId },
      data: { depositStatus: DepositStatus.FORFEITED },
    });

    await tx.user.update({
      where: { id: params.userId },
      data: { cycleDefaultFlagged: true },
    });
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

      await this.ensureLegacyDepositEscrowMigratedInTx(tx, m.userId);

      const escrow = await this.accounts.getOrCreateMemberDepositEscrow(
        m.userId,
        tx,
      );
      const available = await this.accounts.getOrCreateMemberWalletAvailable(
        m.userId,
        tx,
      );

      await this.posting.postTransferInTx(tx, {
        idempotencyKey: `deposit:release:${m.id}`,
        referenceType: "DepositRelease",
        referenceId: m.id,
        description: "Security deposit released (group completed)",
        fromAccountId: escrow.id,
        toAccountId: available.id,
        amount: amt,
      });

      await tx.groupMember.update({
        where: { id: m.id },
        data: { depositStatus: DepositStatus.RELEASED },
      });
    }
  }
}
