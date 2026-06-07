import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  UserRole,
  WithdrawalActorRole,
  WithdrawalStatus,
} from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { PrismaService } from "../prisma/prisma.service";
import { FinancialAllocationService } from "../ledger-accounts/financial-allocation.service";
import { LedgerAccountService } from "../ledger-accounts/ledger-account.service";
import { LedgerPostingService } from "../ledger-accounts/ledger-posting.service";

@Injectable()
export class WithdrawalsService {
  constructor(
    private prisma: PrismaService,
    private accounts: LedgerAccountService,
    private posting: LedgerPostingService,
    private allocation: FinancialAllocationService,
    private notifications: NotificationsService,
    private audit: AuditLogsService,
  ) {}

  async createMemberWithdrawal(userId: string, amount: string, momoNumber: string) {
    return this.createWithdrawal({
      actorId: userId,
      actorRole: WithdrawalActorRole.MEMBER,
      amount,
      momoNumber,
    });
  }

  async createAdminWithdrawal(adminId: string, amount: string, momoNumber: string) {
    return this.createWithdrawal({
      actorId: adminId,
      actorRole: WithdrawalActorRole.ADMIN,
      amount,
      momoNumber,
    });
  }

  private async createWithdrawal(params: {
    actorId: string;
    actorRole: WithdrawalActorRole;
    amount: string;
    momoNumber: string;
  }) {
    const amountDec = new Prisma.Decimal(params.amount);
    if (amountDec.lte(0)) {
      throw new BadRequestException("Amount must be positive");
    }
    const phone = params.momoNumber.replace(/\D/g, "");
    if (phone.length < 9) {
      throw new BadRequestException("Valid MoMo number required");
    }

    const summary =
      params.actorRole === WithdrawalActorRole.MEMBER
        ? await this.allocation.getMemberWalletSummary(params.actorId)
        : await this.allocation.getAdminWalletSummary(params.actorId);

    if (new Prisma.Decimal(summary.availableBalance).lt(amountDec)) {
      throw new BadRequestException("Insufficient available balance");
    }

    const sourceAccount =
      params.actorRole === WithdrawalActorRole.MEMBER
        ? await this.accounts.getOrCreateMemberWallet(params.actorId)
        : await this.accounts.getOrCreateAdminEarnings(params.actorId);

    const withdrawal = await this.prisma.$transaction(async (tx) => {
      const clearing = await this.accounts.getOrCreateWithdrawalClearing(tx);
      const row = await tx.withdrawalRequest.create({
        data: {
          actorId: params.actorId,
          actorRole: params.actorRole,
          ledgerAccountId: sourceAccount.id,
          amount: amountDec,
          momoNumber: phone,
          status: WithdrawalStatus.PENDING,
          metadata: { manualProcessing: true },
        },
      });

      await this.posting.postTransferInTx(tx, {
        idempotencyKey: `withdrawal:hold:${row.id}`,
        referenceType: "WithdrawalRequest",
        referenceId: row.id,
        description: "Withdrawal hold",
        fromAccountId: sourceAccount.id,
        toAccountId: clearing.id,
        amount: amountDec,
      });

      return row;
    });

    await this.notifications.create(
      params.actorId,
      "Withdrawal requested",
      `Your withdrawal of GHS ${amountDec.toFixed(2)} is being processed.`,
      "WITHDRAWAL_REQUESTED",
      { withdrawalId: withdrawal.id, amount: amountDec.toFixed(2) },
    );

    return this.toDto(withdrawal);
  }

  async listForActor(actorId: string) {
    const rows = await this.prisma.withdrawalRequest.findMany({
      where: { actorId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { withdrawals: rows.map((r) => this.toDto(r)) };
  }

  async listForHq(status?: WithdrawalStatus) {
    const rows = await this.prisma.withdrawalRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return { withdrawals: rows.map((r) => this.toDto(r)) };
  }

  async confirmWithdrawal(
    withdrawalId: string,
    confirmedById: string,
    providerRef: string,
    provider = "manual",
  ) {
    const ref = providerRef.trim();
    if (!ref) {
      throw new BadRequestException("providerRef is required to confirm withdrawal");
    }

    const row = await this.prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });
    if (!row) throw new NotFoundException("Withdrawal not found");
    if (row.status === WithdrawalStatus.COMPLETED) {
      return this.toDto(row);
    }
    if (row.status !== WithdrawalStatus.PENDING && row.status !== WithdrawalStatus.PROCESSING) {
      throw new BadRequestException(`Cannot confirm withdrawal in status ${row.status}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.withdrawalRequest.findUniqueOrThrow({
        where: { id: withdrawalId },
      });
      if (current.status === WithdrawalStatus.COMPLETED) {
        return current;
      }

      await tx.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: { status: WithdrawalStatus.PROCESSING },
      });

      const clearing = await this.accounts.getOrCreateWithdrawalClearing(tx);
      const external = await this.accounts.getOrCreateSystemExternal(tx);

      await this.posting.postJournalInTx(tx, {
        idempotencyKey: `withdrawal:complete:${withdrawalId}`,
        referenceType: "WithdrawalRequest",
        referenceId: withdrawalId,
        description: "Withdrawal disbursed (manual/MoMo)",
        metadata: { providerRef: ref, provider },
        lines: [
          {
            accountId: clearing.id,
            delta: current.amount.mul(-1),
          },
          {
            accountId: external.id,
            delta: current.amount,
          },
        ],
      });

      return tx.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: {
          status: WithdrawalStatus.COMPLETED,
          provider,
          providerRef: ref,
          confirmedById,
          processedAt: new Date(),
        },
      });
    });

    await this.allocation.syncLegacyMemberWallet(updated.actorId);

    await this.notifications.create(
      updated.actorId,
      "Withdrawal completed",
      `GHS ${updated.amount.toFixed(2)} has been sent to your MoMo wallet.`,
      "WITHDRAWAL_COMPLETED",
      { withdrawalId: updated.id, providerRef: ref },
    );

    await this.audit.append({
      actorId: confirmedById,
      action: "WITHDRAWAL_CONFIRMED",
      entityType: "WithdrawalRequest",
      entityId: updated.id,
      metadata: { providerRef: ref, provider },
    });

    return this.toDto(updated);
  }

  async failWithdrawal(
    withdrawalId: string,
    confirmedById: string,
    failureReason: string,
  ) {
    const row = await this.prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });
    if (!row) throw new NotFoundException("Withdrawal not found");
    if (row.status === WithdrawalStatus.FAILED || row.status === WithdrawalStatus.COMPLETED) {
      throw new BadRequestException(`Withdrawal already ${row.status}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const clearing = await this.accounts.getOrCreateWithdrawalClearing(tx);
      await this.posting.postTransferInTx(tx, {
        idempotencyKey: `withdrawal:release:${withdrawalId}`,
        referenceType: "WithdrawalRequest",
        referenceId: withdrawalId,
        description: "Withdrawal failed — release hold",
        fromAccountId: clearing.id,
        toAccountId: row.ledgerAccountId,
        amount: row.amount,
      });

      return tx.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: {
          status: WithdrawalStatus.FAILED,
          failureReason: failureReason.slice(0, 500),
          confirmedById,
          processedAt: new Date(),
        },
      });
    });

    await this.allocation.syncLegacyMemberWallet(updated.actorId);

    await this.notifications.create(
      updated.actorId,
      "Withdrawal failed",
      `Your withdrawal of GHS ${updated.amount.toFixed(2)} could not be completed. Please contact support.`,
      "WITHDRAWAL_FAILED",
      { withdrawalId: updated.id, reason: updated.failureReason },
    );

    return this.toDto(updated);
  }

  private toDto(row: {
    id: string;
    actorId: string;
    actorRole: WithdrawalActorRole;
    amount: Prisma.Decimal;
    status: WithdrawalStatus;
    momoNumber: string;
    provider: string | null;
    providerRef: string | null;
    requestedAt: Date;
    processedAt: Date | null;
    failureReason: string | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      actorId: row.actorId,
      actorRole: row.actorRole,
      amount: row.amount.toString(),
      status: row.status,
      momoNumber: row.momoNumber,
      provider: row.provider,
      providerRef: row.providerRef,
      requestedAt: row.requestedAt.toISOString(),
      processedAt: row.processedAt?.toISOString() ?? null,
      failureReason: row.failureReason,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
