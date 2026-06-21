import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  ContributionStatus,
  GroupStatus,
  MemberCycleStanding,
  PayoutMode,
  PayoutStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { selectPayoutRecipient, summarizeCycle } from "@myturn/shared";
import { memberCyclePaymentDays } from "../common/member-cycle-payment-days";
import { assertCycleContributionsReadyForFinalize } from "./payout-contribution-readiness";
import { CycleComplianceService } from "../cycle-risk/cycle-compliance.service";
import { CycleDepositsService } from "../cycle-risk/cycle-deposits.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { ContributionGuaranteeReserveService } from "../ledger-accounts/contribution-guarantee-reserve.service";
import { FinancialAllocationService } from "../ledger-accounts/financial-allocation.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

function toMinor(amount: Decimal): bigint {
  return BigInt(amount.mul(100).toFixed(0));
}

function fromMinor(minor: bigint): Decimal {
  return new Decimal(minor.toString()).div(100);
}

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private prisma: PrismaService,
    private allocation: FinancialAllocationService,
    private reserve: ContributionGuaranteeReserveService,
    private notifications: NotificationsService,
    private audit: AuditLogsService,
    private cycleCompliance: CycleComplianceService,
    private deposits: CycleDepositsService,
  ) {}

  /** Cycle finalization: wallet credits for recipient and 100% MyTurn revenue (audit row only). */
  async finalizeCycle(
    groupId: string,
    cycleNumber: number,
    finalizedByUserId: string,
    finalizedByRole: UserRole,
  ) {
    await this.cycleCompliance.syncGroupCompliance(groupId);
    const peek = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          where: { status: "ACTIVE" },
          orderBy: { turnOrder: "asc" },
        },
      },
    });
    if (!peek) {
      throw new NotFoundException("Group not found");
    }
    if (peek.payoutMode === PayoutMode.CYCLE) {
      const queue = peek.members.map((m) => ({
        userId: m.userId,
        turnOrder: m.turnOrder,
        effectivePayoutOrder: m.effectivePayoutOrder,
        cycleStanding: m.cycleStanding,
      }));
      const selection = selectPayoutRecipient(queue, cycleNumber, {
        allowOverride: peek.allowPayoutOverride,
      });
      if (!selection.recipient) {
        throw new BadRequestException(
          "Cannot finalize: no eligible payout recipient (all members are DEFAULTED). Resolve compliance or replace members.",
        );
      }
    }

    const {
      payout,
      summary: cycleSummary,
      groupCompleted,
      nextCycle,
      allocResult,
      groupFinalReserveReleases,
    } =
      await this.prisma.$transaction(async (tx) => {
        const group = await tx.group.findUnique({
          where: { id: groupId },
          include: {
            members: {
              where: { status: "ACTIVE" },
              orderBy: { turnOrder: "asc" },
            },
          },
        });
        if (!group) {
          throw new NotFoundException("Group not found");
        }
        if (
          finalizedByRole === UserRole.ADMIN &&
          group.adminId !== finalizedByUserId
        ) {
          throw new ForbiddenException();
        }
        if (group.status !== GroupStatus.ACTIVE) {
          throw new BadRequestException("Only active groups can finalize a cycle");
        }
        if (group.currentCycle !== cycleNumber) {
          throw new BadRequestException(
            `Cycle must match the group's current cycle (${group.currentCycle})`,
          );
        }

        const n = group.members.length;
        if (n === 0) {
          throw new BadRequestException("Group has no active members");
        }
        if (n !== group.memberSlots) {
          throw new BadRequestException("Member count does not match group size");
        }

        const contribs = await tx.contribution.findMany({
          where: { groupId, cycleNumber },
        });
        if (contribs.length !== n) {
          throw new BadRequestException("Contribution rows missing for cycle");
        }
        assertCycleContributionsReadyForFinalize(contribs, group.members);

        const existing = await tx.payout.findFirst({
          where: { groupId, cycleNumber },
        });
        if (existing) {
          throw new BadRequestException("Payout already recorded for this cycle");
        }

        const contributionMinor = toMinor(
          new Decimal(group.contributionAmount.toString()),
        );
        const summaryVal = summarizeCycle(
          cycleNumber,
          contributionMinor,
          n,
          group.serviceMarginBps,
          memberCyclePaymentDays(group),
        );

        const queue = group.members.map((m) => ({
          userId: m.userId,
          turnOrder: m.turnOrder,
          effectivePayoutOrder: m.effectivePayoutOrder,
          cycleStanding: m.cycleStanding,
        }));
        const selection = selectPayoutRecipient(queue, cycleNumber, {
          allowOverride: group.allowPayoutOverride,
        });
        const recipientUserId = selection.recipient?.userId;
        const recipient = group.members.find((m) => m.userId === recipientUserId);
        if (!recipient) {
          throw new BadRequestException(
            "Could not resolve payout recipient — no eligible member for this cycle",
          );
        }

        const payoutAmount = fromMinor(summaryVal.netAfterMarginMinor);
        const payoutMetadata: Prisma.InputJsonValue = {
          walletCredit: true,
          ...(selection.skippedDefaulted.length > 0
            ? {
                payoutTurnSkippedDefaulted: selection.skippedDefaulted.map(
                  (s) => s.userId,
                ),
                nominalRecipientUserId:
                  selection.nominalRecipient?.userId ?? null,
              }
            : {}),
        };

        const payoutRow = await tx.payout.create({
          data: {
            groupId,
            recipientId: recipient.userId,
            cycleNumber,
            amount: payoutAmount,
            status: PayoutStatus.CREDITED,
            creditedAt: new Date(),
            metadata: payoutMetadata,
          },
        });

        const marginAmount = fromMinor(summaryVal.serviceMarginMinor);
        await tx.adminEarning.create({
          data: {
            adminId: group.adminId,
            groupId,
            cycleNumber,
            marginAmount,
            adminShareAmount: new Prisma.Decimal(0),
            platformShareAmount: marginAmount,
            settledAt: new Date(),
          },
        });

        const allocResult = await this.allocation.allocateCycleFinalizationInTx(
          tx,
          {
            groupId,
            cycleNumber,
            payoutId: payoutRow.id,
            recipientUserId: recipient.userId,
            adminUserId: group.adminId,
            contributionPerDay: new Prisma.Decimal(
              group.contributionAmount.toString(),
            ),
            memberCount: n,
            serviceMarginBps: group.serviceMarginBps,
            daysPerCycle: memberCyclePaymentDays(group),
            /** Payout sequence position (cycle number), not turnOrder. */
            payoutPosition: cycleNumber,
            totalPositions: n,
          },
        );

        const totalCycles = group.memberSlots;
        let groupCompleted = false;
        let nextCycle: number | null = null;

        if (cycleNumber < totalCycles) {
          nextCycle = cycleNumber + 1;
          await tx.group.update({
            where: { id: groupId },
            data: { currentCycle: nextCycle },
          });
          const days = memberCyclePaymentDays(group);
          const perMemberTotal = new Prisma.Decimal(
            group.contributionAmount.toString(),
          ).mul(days);
          for (const m of group.members) {
            await tx.contribution.create({
              data: {
                groupId,
                userId: m.userId,
                cycleNumber: nextCycle,
                amount: perMemberTotal,
                expectedDayCount: days,
                paidDayCount: 0,
                status: ContributionStatus.PENDING,
              },
            });
          }
          if (group.payoutMode === PayoutMode.CYCLE) {
            await tx.groupMember.updateMany({
              where: {
                groupId,
                status: "ACTIVE",
                cycleStanding: MemberCycleStanding.LATE,
              },
              data: { cycleStanding: MemberCycleStanding.ACTIVE },
            });
          }
        } else {
          groupCompleted = true;
          await tx.group.update({
            where: { id: groupId },
            data: {
              status: GroupStatus.COMPLETED,
            },
          });
          await this.deposits.releaseAllHeldDepositsForGroup(tx, groupId);
        }

        const groupFinalReserveReleases = groupCompleted
          ? await this.reserve.releaseAllActiveReservesOnGroupCompletedInTx(
              tx,
              { groupId },
            )
          : [];

        return {
          payout: payoutRow,
          summary: summaryVal,
          groupCompleted,
          nextCycle,
          allocResult,
          groupFinalReserveReleases,
        };
      });

    const serialized = this.serializeSummary(cycleSummary);
    const payoutAmountNum = Number(payout.amount.toString());

    this.logger.log(
      `Cycle finalized groupId=${groupId} cycle=${cycleNumber} payoutId=${payout.id} recipientId=${payout.recipientId} amount=${payoutAmountNum.toFixed(2)} walletCredited=true groupCompleted=${groupCompleted}`,
    );

    const groupRow = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { adminId: true, name: true },
    });
    const groupName = groupRow?.name ?? "your group";

    const availableNum = Number(allocResult.availableAmount.toString());
    const reserveNum = Number(allocResult.reserveAmount.toString());
    const payoutBody =
      reserveNum > 0
        ? `GHS ${payoutAmountNum.toFixed(2)} has been credited to your wallet. GHS ${availableNum.toFixed(2)} is available now and GHS ${reserveNum.toFixed(2)} is reserved as your Contribution Guarantee.`
        : `GHS ${payoutAmountNum.toFixed(2)} has been credited to your MyTurn wallet from ${groupName}.`;

    await this.notifications.create(
      payout.recipientId,
      "It's Your Turn!!",
      payoutBody,
      "PAYOUT",
      {
        payoutId: payout.id,
        groupId,
        amount: payoutAmountNum.toFixed(2),
        availableAmount: availableNum.toFixed(2),
        reserveAmount: reserveNum.toFixed(2),
        walletCredit: true,
      },
    );
    if (groupRow) {
      // Admins are platform operators — margin revenue goes 100% to MyTurn (no admin earnings).
      await this.notifications.create(
        groupRow.adminId,
        "Cycle finalized",
        groupCompleted
          ? `${groupRow.name} completed all cycles.`
          : `Cycle ${cycleNumber} for ${groupRow.name} was finalized. Next cycle started.`,
        "CYCLE_FINALIZED",
        { groupId, cycleNumber, groupCompleted, nextCycle },
      );
    }

    const skippedDefaulted =
      payout.metadata &&
      typeof payout.metadata === "object" &&
      Array.isArray(
        (payout.metadata as Record<string, unknown>).payoutTurnSkippedDefaulted,
      )
        ? ((payout.metadata as Record<string, unknown>)
            .payoutTurnSkippedDefaulted as string[])
        : [];

    if (skippedDefaulted.length > 0) {
      await this.audit.append({
        actorId: finalizedByUserId,
        action: "PAYOUT_TURN_SKIPPED_DEFAULTED_MEMBER",
        entityType: "Payout",
        entityId: payout.id,
        metadata: {
          groupId,
          cycleNumber,
          skippedUserIds: skippedDefaulted,
          recipientId: payout.recipientId,
        },
      });
      for (const skippedUserId of skippedDefaulted) {
        await this.notifications.create(
          skippedUserId,
          "Payout turn skipped",
          `Your payout turn was skipped because of unresolved contributions in ${groupName}. Settle your balance to become eligible again.`,
          "PAYOUT_TURN_SKIPPED_DEFAULT",
          { groupId, cycleNumber, payoutId: payout.id },
        );
      }
    }

    await this.audit.append({
      actorId: finalizedByUserId,
      action: "FINALIZE_CYCLE_WALLET_CREDIT",
      entityType: "Payout",
      entityId: payout.id,
      metadata: {
        groupId,
        cycleNumber,
        groupCompleted,
        nextCycle,
        walletCredit: true,
        payoutTurnSkippedDefaulted: skippedDefaulted,
        finalReserveReleases: groupFinalReserveReleases.map((r) => ({
          reserveId: r.reserveId,
          userId: r.userId,
          amount: r.amount,
        })),
      },
    });

    if (groupFinalReserveReleases.length > 0) {
      for (const release of groupFinalReserveReleases) {
        await this.reserve.notifyGroupCompletedReserveRelease(release);
      }
    }

    return {
      payout,
      summary: serialized,
      groupCompleted,
      nextCycle,
    };
  }

  private serializeSummary(s: {
    cycleNumber: number;
    grossPoolAmountMinor: bigint;
    serviceMarginMinor: bigint;
    netAfterMarginMinor: bigint;
    adminShareMinor: bigint;
    platformShareMinor: bigint;
  }) {
    return {
      cycleNumber: s.cycleNumber,
      grossPoolAmountMinor: s.grossPoolAmountMinor.toString(),
      serviceMarginMinor: s.serviceMarginMinor.toString(),
      netAfterMarginMinor: s.netAfterMarginMinor.toString(),
      adminShareMinor: s.adminShareMinor.toString(),
      platformShareMinor: s.platformShareMinor.toString(),
    };
  }

  listForGroup(
    groupId: string,
    viewer: { id: string; role: UserRole },
  ) {
    if (viewer.role === UserRole.ADMIN) {
      return this.prisma.group
        .findFirst({
          where: { id: groupId, adminId: viewer.id },
          select: { id: true },
        })
        .then((g) => {
          if (!g) throw new ForbiddenException();
          return this.listForGroupQuery(groupId);
        });
    }
    return this.listForGroupQuery(groupId);
  }

  private listForGroupQuery(groupId: string) {
    return this.prisma.payout.findMany({
      where: { groupId },
      orderBy: { cycleNumber: "asc" },
    });
  }
}
