import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  GroupMemberStatus,
  Prisma,
  UserRole,
  WithdrawalActorRole,
  WithdrawalStatus,
} from "@prisma/client";
import { IdempotencyService } from "../common/idempotency/idempotency.service";
import { MemberParticipationService } from "../member/member-participation.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { PrismaService } from "../prisma/prisma.service";
import { FinancialAllocationService } from "../ledger-accounts/financial-allocation.service";
import { LedgerAccountService } from "../ledger-accounts/ledger-account.service";
import { LedgerPostingService } from "../ledger-accounts/ledger-posting.service";
import {
  createDisbursementProvider,
  isMockDisbursementProvider,
} from "./providers/create-disbursement-provider";
import type { DisbursementProvider } from "./providers/disbursement-provider.interface";
import {
  assertWithdrawalWithinLimits,
  getStaleWithdrawalThresholdMs,
} from "./withdrawal-limits";

const STALE_PROCESSING_MS = 30_000;

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);
  private readonly disbursement: DisbursementProvider;

  constructor(
    private prisma: PrismaService,
    private accounts: LedgerAccountService,
    private posting: LedgerPostingService,
    private allocation: FinancialAllocationService,
    private notifications: NotificationsService,
    private audit: AuditLogsService,
    private participation: MemberParticipationService,
    private idempotency: IdempotencyService,
  ) {
    this.disbursement = createDisbursementProvider();
  }

  async createMemberWithdrawal(
    userId: string,
    amount: string,
    momoNumber: string,
    clientIdempotencyKey?: string,
  ) {
    await this.participation.assertCanParticipateFinancially(userId);

    const run = async () => {
      const row = await this.createWithdrawalHold({
        actorId: userId,
        actorRole: WithdrawalActorRole.MEMBER,
        amount,
        momoNumber,
        automatic: true,
      });
      return this.startAutomaticDisbursement(row.id);
    };

    if (clientIdempotencyKey?.trim()) {
      const key = `withdrawal:create:${userId}:${clientIdempotencyKey.trim()}`;
      const result = await this.idempotency.runOnce(key, 3600, run);
      return result.value;
    }
    return run();
  }

  /** @deprecated Admin earnings wallets removed — compensation managed separately by MyTurn. */
  async createAdminWithdrawal(
    adminId: string,
    amount: string,
    momoNumber: string,
    clientIdempotencyKey?: string,
  ) {
    void adminId;
    void amount;
    void momoNumber;
    void clientIdempotencyKey;
    throw new BadRequestException(
      "Admin earnings wallets are deprecated. Compensation is managed separately by MyTurn.",
    );
  }

  /** Member withdrawals in groups managed by this admin (monitoring only). */
  async listMemberWithdrawalsForAdmin(adminId: string, status?: WithdrawalStatus) {
    const memberIds = await this.memberIdsForAdmin(adminId);
    if (memberIds.length === 0) {
      return {
        withdrawals: [],
        disbursementMode: isMockDisbursementProvider() ? "mock" : this.disbursement.name,
      };
    }
    const rows = await this.prisma.withdrawalRequest.findMany({
      where: {
        actorId: { in: memberIds },
        actorRole: WithdrawalActorRole.MEMBER,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.actorId))] } },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameById = new Map(
      users.map((u) => [
        u.id,
        [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || "Member",
      ]),
    );
    return {
      withdrawals: rows.map((r) => ({
        ...this.toDto(r),
        actorName: nameById.get(r.actorId) ?? "Member",
        processingMode: "automatic",
      })),
      disbursementMode: isMockDisbursementProvider() ? "mock" : this.disbursement.name,
    };
  }

  private async createWithdrawalHold(params: {
    actorId: string;
    actorRole: WithdrawalActorRole;
    amount: string;
    momoNumber: string;
    automatic: boolean;
  }) {
    const amountDec = new Prisma.Decimal(params.amount.replace(/,/g, "").trim());
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

    const availableDec = new Prisma.Decimal(summary.availableBalance);
    if (availableDec.lt(amountDec)) {
      if (params.actorRole === WithdrawalActorRole.MEMBER) {
        const reservedDec = new Prisma.Decimal(
          "reservedBalance" in summary && summary.reservedBalance
            ? summary.reservedBalance
            : "0",
        );
        if (reservedDec.gt(0)) {
          throw new BadRequestException(
            `You can withdraw up to GHS ${availableDec.toFixed(2)} right now. ` +
              `GHS ${reservedDec.toFixed(2)} is held as your Contribution Guarantee Reserve — ` +
              `this protects your group and unlocks gradually as you keep paying your contributions.`,
          );
        }
        throw new BadRequestException(
          `Insufficient available balance. You can withdraw up to GHS ${availableDec.toFixed(2)}.`,
        );
      }
      throw new BadRequestException("Insufficient available balance");
    }

    await assertWithdrawalWithinLimits(
      this.prisma,
      params.actorId,
      params.actorRole,
      amountDec,
    );

    const sourceAccount =
      params.actorRole === WithdrawalActorRole.MEMBER
        ? await this.accounts.getOrCreateMemberWalletAvailable(params.actorId)
        : await this.accounts.getOrCreateAdminEarnings(params.actorId);

    return this.prisma.$transaction(async (tx) => {
      const clearing = await this.accounts.getOrCreateWithdrawalClearing(tx);
      const row = await tx.withdrawalRequest.create({
        data: {
          actorId: params.actorId,
          actorRole: params.actorRole,
          ledgerAccountId: sourceAccount.id,
          amount: amountDec,
          momoNumber: phone,
          status: WithdrawalStatus.PENDING,
          metadata: {
            automatic: params.automatic,
            disbursementProvider: params.automatic ? this.disbursement.name : "manual",
          },
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
  }

  private async startAutomaticDisbursement(withdrawalId: string) {
    const row = await this.prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });
    if (!row) throw new NotFoundException("Withdrawal not found");

    const externalRef = withdrawalId;
    const isAdmin = row.actorRole === WithdrawalActorRole.ADMIN;
    try {
      const transfer = await this.disbursement.requestTransfer({
        withdrawalId: row.id,
        amount: row.amount.toFixed(2),
        phoneDigits: row.momoNumber,
        externalRef,
      });

      const processing = await this.prisma.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: {
          status: WithdrawalStatus.PROCESSING,
          provider: transfer.provider,
          providerRef: transfer.providerRef,
          metadata: {
            ...(typeof row.metadata === "object" && row.metadata
              ? (row.metadata as Record<string, unknown>)
              : {}),
            providerRaw: transfer.raw ?? null,
          },
        },
      });

      await this.notifications.create(
        row.actorId,
        isAdmin ? "Earnings withdrawal processing" : "Withdrawal processing",
        isAdmin
          ? `Your withdrawal of GHS ${row.amount.toFixed(2)} is being processed automatically.`
          : `Your withdrawal of GHS ${row.amount.toFixed(2)} is being sent to your MoMo wallet automatically.`,
        "WITHDRAWAL_PROCESSING",
        { withdrawalId: row.id, amount: row.amount.toFixed(2) },
      );

      if (transfer.status === "FAILED") {
        return this.failWithdrawalInternal(
          withdrawalId,
          transfer.failureReason ?? "Disbursement provider rejected transfer",
          null,
        );
      }

      if (transfer.status === "COMPLETED") {
        return this.completeWithdrawalInternal(
          withdrawalId,
          transfer.providerRef,
          transfer.provider,
          null,
        );
      }

      if (isMockDisbursementProvider()) {
        await this.settleByProviderRef(
          transfer.providerRef,
          "COMPLETED",
          "Mock disbursement auto-settled",
        );
        const completed = await this.prisma.withdrawalRequest.findUniqueOrThrow({
          where: { id: withdrawalId },
        });
        return this.toDto(completed);
      }

      return this.toDto(processing);
    } catch (e) {
      const reason =
        e instanceof Error ? e.message : "Disbursement request failed";
      this.logger.error(
        `Disbursement failed withdrawalId=${withdrawalId} actorRole=${row.actorRole}: ${reason}`,
      );
      return this.failWithdrawalInternal(withdrawalId, reason.slice(0, 500), null);
    }
  }

  /** Webhook / polling settlement — idempotent. */
  async settleByProviderRef(
    providerRef: string,
    outcome: "COMPLETED" | "FAILED",
    failureReason?: string,
  ) {
    const ref = providerRef.trim();
    if (!ref) {
      throw new BadRequestException("providerRef required");
    }

    const row = await this.prisma.withdrawalRequest.findFirst({
      where: { providerRef: ref },
    });
    if (!row) {
      return { settled: false, reason: "withdrawal_not_found" };
    }
    if (row.status === WithdrawalStatus.COMPLETED) {
      return { settled: true, duplicate: true, status: row.status };
    }
    if (row.status === WithdrawalStatus.FAILED) {
      return { settled: true, duplicate: true, status: row.status };
    }

    if (outcome === "COMPLETED") {
      const dto = await this.completeWithdrawalInternal(
        row.id,
        ref,
        row.provider ?? this.disbursement.name,
        null,
      );
      return { settled: true, status: dto.status, withdrawalId: row.id };
    }

    const dto = await this.failWithdrawalInternal(
      row.id,
      failureReason ?? "MoMo disbursement failed",
      null,
    );
    return { settled: true, status: dto.status, withdrawalId: row.id };
  }

  async applyDisbursementWebhook(body: Record<string, unknown>, provider: string) {
    const parsed = await this.disbursement.parseWebhook({
      provider,
      body,
      providerRef: String(body.externalId ?? body.referenceId ?? ""),
      externalRef: String(body.externalId ?? ""),
    });
    if (!parsed) {
      return { settled: false };
    }
    const ref = String(
      body.externalId ?? body.referenceId ?? body.X_Reference_Id ?? "",
    ).trim();
    if (!ref) return { settled: false };

    if (parsed.status === "COMPLETED") {
      return this.settleByProviderRef(ref, "COMPLETED");
    }
    if (parsed.status === "FAILED") {
      return this.settleByProviderRef(
        ref,
        "FAILED",
        parsed.failureReason ?? "MoMo disbursement failed",
      );
    }
    return { settled: false };
  }

  async pollProcessingWithdrawal(withdrawalId: string) {
    const row = await this.prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });
    if (!row) throw new NotFoundException("Withdrawal not found");
    if (!row.providerRef || row.status !== WithdrawalStatus.PROCESSING) {
      return this.toDto(row);
    }
    const verified = await this.disbursement.verifyTransfer(row.providerRef);
    if (verified.status === "COMPLETED") {
      await this.settleByProviderRef(row.providerRef, "COMPLETED");
    } else if (verified.status === "FAILED") {
      await this.settleByProviderRef(
        row.providerRef,
        "FAILED",
        verified.failureReason,
      );
    }
    const refreshed = await this.prisma.withdrawalRequest.findUniqueOrThrow({
      where: { id: withdrawalId },
    });
    return this.toDto(refreshed);
  }

  async listForActor(actorId: string) {
    const rows = await this.prisma.withdrawalRequest.findMany({
      where: { actorId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    for (const row of rows) {
      if (
        row.status === WithdrawalStatus.PROCESSING &&
        row.providerRef &&
        Date.now() - row.requestedAt.getTime() > STALE_PROCESSING_MS
      ) {
        await this.pollProcessingWithdrawal(row.id).catch(() => undefined);
      }
    }

    const refreshed = await this.prisma.withdrawalRequest.findMany({
      where: { actorId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return {
      withdrawals: refreshed.map((r) => this.toDto(r)),
      disbursementMode: isMockDisbursementProvider() ? "mock" : this.disbursement.name,
    };
  }

  async listForAdmin(adminId: string, status?: WithdrawalStatus) {
    const memberIds = await this.memberIdsForAdmin(adminId);
    const actorIds = [adminId, ...memberIds];
    const rows = await this.prisma.withdrawalRequest.findMany({
      where: {
        actorId: { in: actorIds },
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.actorId))] } },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameById = new Map(
      users.map((u) => [
        u.id,
        [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || "Member",
      ]),
    );
    for (const row of rows) {
      if (
        row.actorId === adminId &&
        row.status === WithdrawalStatus.PROCESSING &&
        row.providerRef &&
        Date.now() - row.requestedAt.getTime() > STALE_PROCESSING_MS
      ) {
        await this.pollProcessingWithdrawal(row.id).catch(() => undefined);
      }
    }

    const refreshed = await this.prisma.withdrawalRequest.findMany({
      where: {
        actorId: { in: actorIds },
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return {
      withdrawals: refreshed.map((r) => ({
        ...this.toDto(r),
        actorName: nameById.get(r.actorId) ?? "Member",
        processingMode: "automatic",
        canManage: false,
      })),
      disbursementMode: isMockDisbursementProvider() ? "mock" : this.disbursement.name,
    };
  }

  async listForHq(status?: WithdrawalStatus) {
    const rows = await this.prisma.withdrawalRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.actorId))] } },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameById = new Map(
      users.map((u) => [
        u.id,
        [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || "User",
      ]),
    );
    const staleMs = getStaleWithdrawalThresholdMs();
    return {
      withdrawals: rows.map((r) => ({
        ...this.toDto(r),
        actorName: nameById.get(r.actorId) ?? "User",
        processingMode: "automatic",
        canManage: this.hqCanManageRow(r),
        canManualOverride: this.hqCanManualOverride(r),
        isStale:
          r.status === WithdrawalStatus.PROCESSING &&
          Date.now() - r.requestedAt.getTime() > staleMs,
      })),
    };
  }

  /** HQ manual override — only for stuck PROCESSING withdrawals. */
  async assertHqManualOverride(hqUserId: string, withdrawalId: string) {
    void hqUserId;
    const row = await this.prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });
    if (!row) throw new NotFoundException("Withdrawal not found");
    if (row.status !== WithdrawalStatus.PROCESSING) {
      throw new ForbiddenException(
        "Manual override is only allowed for stuck PROCESSING withdrawals",
      );
    }
    return row;
  }

  async assertHqCanFailStuck(hqUserId: string, withdrawalId: string) {
    void hqUserId;
    const row = await this.prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });
    if (!row) throw new NotFoundException("Withdrawal not found");
    if (row.status !== WithdrawalStatus.PROCESSING) {
      throw new ForbiddenException(
        "HQ may only fail withdrawals stuck in PROCESSING status",
      );
    }
    return row;
  }

  async confirmWithdrawal(
    withdrawalId: string,
    confirmedById: string,
    providerRef: string,
    provider = "manual",
  ) {
    const row = await this.prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });
    if (!row) throw new NotFoundException("Withdrawal not found");

    const ref = providerRef.trim();
    if (!ref) {
      throw new BadRequestException("providerRef is required to confirm withdrawal");
    }

    if (row.status === WithdrawalStatus.COMPLETED) {
      return this.toDto(row);
    }
    if (row.status !== WithdrawalStatus.PENDING && row.status !== WithdrawalStatus.PROCESSING) {
      throw new BadRequestException(`Cannot confirm withdrawal in status ${row.status}`);
    }

    return this.completeWithdrawalInternal(
      withdrawalId,
      ref,
      provider,
      confirmedById,
    );
  }

  async hqFailStuckWithdrawal(
    withdrawalId: string,
    hqUserId: string,
    failureReason: string,
  ) {
    await this.assertHqCanFailStuck(hqUserId, withdrawalId);
    return this.failWithdrawalInternal(
      withdrawalId,
      failureReason.slice(0, 500),
      hqUserId,
    );
  }

  private async completeWithdrawalInternal(
    withdrawalId: string,
    providerRef: string,
    provider: string,
    confirmedById: string | null,
  ) {
    const ref = providerRef.trim();
    if (!ref) {
      throw new BadRequestException("providerRef is required to complete withdrawal");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.withdrawalRequest.findUniqueOrThrow({
        where: { id: withdrawalId },
      });
      if (current.status === WithdrawalStatus.COMPLETED) {
        return current;
      }
      if (
        current.status !== WithdrawalStatus.PENDING &&
        current.status !== WithdrawalStatus.PROCESSING
      ) {
        throw new BadRequestException(`Cannot complete withdrawal in status ${current.status}`);
      }

      const clearing = await this.accounts.getOrCreateWithdrawalClearing(tx);
      const external = await this.accounts.getOrCreateSystemExternal(tx);

      await this.posting.postJournalInTx(tx, {
        idempotencyKey: `withdrawal:complete:${withdrawalId}`,
        referenceType: "WithdrawalRequest",
        referenceId: withdrawalId,
        description: "Withdrawal disbursed (automatic MoMo)",
        metadata: { providerRef: ref, provider },
        lines: [
          { accountId: clearing.id, delta: current.amount.mul(-1) },
          { accountId: external.id, delta: current.amount },
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

    const isAdmin = updated.actorRole === WithdrawalActorRole.ADMIN;
    await this.notifications.create(
      updated.actorId,
      isAdmin ? "Earnings withdrawal completed" : "Withdrawal completed",
      `GHS ${updated.amount.toFixed(2)} has been sent to your MoMo wallet.`,
      "WITHDRAWAL_COMPLETED",
      { withdrawalId: updated.id, providerRef: ref },
    );

    if (confirmedById) {
      await this.audit.append({
        actorId: confirmedById,
        action: "WITHDRAWAL_CONFIRMED",
        entityType: "WithdrawalRequest",
        entityId: updated.id,
        metadata: { providerRef: ref, provider },
      });
    }

    return this.toDto(updated);
  }

  private async failWithdrawalInternal(
    withdrawalId: string,
    failureReason: string,
    confirmedById: string | null,
  ) {
    const row = await this.prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });
    if (!row) throw new NotFoundException("Withdrawal not found");
    if (row.status === WithdrawalStatus.FAILED) {
      return this.toDto(row);
    }
    if (row.status === WithdrawalStatus.COMPLETED) {
      throw new BadRequestException("Withdrawal already COMPLETED");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.withdrawalRequest.findUniqueOrThrow({
        where: { id: withdrawalId },
      });
      if (current.status === WithdrawalStatus.FAILED) {
        return current;
      }
      if (current.status === WithdrawalStatus.COMPLETED) {
        throw new BadRequestException("Withdrawal already COMPLETED");
      }

      const clearing = await this.accounts.getOrCreateWithdrawalClearing(tx);
      await this.posting.postTransferInTx(tx, {
        idempotencyKey: `withdrawal:release:${withdrawalId}`,
        referenceType: "WithdrawalRequest",
        referenceId: withdrawalId,
        description: "Withdrawal failed — release hold",
        fromAccountId: clearing.id,
        toAccountId: current.ledgerAccountId,
        amount: current.amount,
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

    const isAdmin = updated.actorRole === WithdrawalActorRole.ADMIN;
    await this.notifications.create(
      updated.actorId,
      isAdmin ? "Earnings withdrawal failed" : "Withdrawal failed",
      isAdmin
        ? `Your withdrawal of GHS ${updated.amount.toFixed(2)} failed. Funds have been returned to your admin earnings wallet.`
        : `Withdrawal failed. Funds have been returned to your MyTurn wallet.`,
      "WITHDRAWAL_FAILED",
      { withdrawalId: updated.id, reason: updated.failureReason },
    );

    return this.toDto(updated);
  }

  private async memberIdsForAdmin(adminId: string): Promise<string[]> {
    const memberships = await this.prisma.groupMember.findMany({
      where: {
        group: { adminId },
        status: GroupMemberStatus.ACTIVE,
      },
      select: { userId: true },
      distinct: ["userId"],
    });
    return memberships.map((m) => m.userId);
  }

  private hqCanManageRow(row: {
    status: WithdrawalStatus;
    requestedAt: Date;
  }): boolean {
    return row.status === WithdrawalStatus.PROCESSING;
  }

  private hqCanManualOverride(row: {
    status: WithdrawalStatus;
    requestedAt: Date;
  }): boolean {
    return (
      row.status === WithdrawalStatus.PROCESSING &&
      Date.now() - row.requestedAt.getTime() > STALE_PROCESSING_MS
    );
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
    metadata?: Prisma.JsonValue | null;
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
      processingMode: "automatic",
      simulated: isMockDisbursementProvider(),
    };
  }
}
