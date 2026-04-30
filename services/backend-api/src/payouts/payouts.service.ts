import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  ContributionStatus,
  GroupStatus,
  LedgerEntryType,
  MemberCycleStanding,
  PayoutMode,
  PayoutStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { summarizeCycle } from "@myturn/shared";
import { memberCyclePaymentDays } from "../common/member-cycle-payment-days";
import { CycleComplianceService } from "../cycle-risk/cycle-compliance.service";
import { CycleDepositsService } from "../cycle-risk/cycle-deposits.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { LedgerService } from "../ledger/ledger.service";
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
    private ledger: LedgerService,
    private notifications: NotificationsService,
    private audit: AuditLogsService,
    private cycleCompliance: CycleComplianceService,
    private deposits: CycleDepositsService,
  ) {}

  /** Mock/manual settlement: payout + margin + ledger + wallet; advances cycle or completes group. */
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
      const rows = peek.members.map((m) => ({
        userId: m.userId,
        cycleStanding: m.cycleStanding,
      }));
      if (
        this.cycleCompliance.hasBlockingDefaults(
          rows,
          peek.allowPayoutOverride,
        )
      ) {
        throw new BadRequestException(
          "Cannot finalize: one or more members are DEFAULTED. Resolve compliance, replace members, or enable payout override in cycle risk settings.",
        );
      }
      const n = peek.members.length;
      const turnIndex = (cycleNumber - 1) % n;
      const recipient = peek.members[turnIndex];
      if (
        recipient &&
        this.cycleCompliance.recipientBlocked(
          recipient.userId,
          rows,
          peek.allowPayoutOverride,
        )
      ) {
        throw new BadRequestException(
          "Cannot finalize: payout recipient is DEFAULTED. Use override or replace the member.",
        );
      }
    }

    const { payout, summary: cycleSummary, groupCompleted, nextCycle } =
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
        if (!contribs.every((c) => c.status === ContributionStatus.PAID)) {
          throw new BadRequestException("All contributions must be paid first");
        }

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

        const turnIndex = (cycleNumber - 1) % n;
        const recipient = group.members[turnIndex];
        if (!recipient) {
          throw new BadRequestException("Could not resolve payout recipient");
        }

        const payoutAmount = fromMinor(summaryVal.netAfterMarginMinor);

        const payoutRow = await tx.payout.create({
          data: {
            groupId,
            recipientId: recipient.userId,
            cycleNumber,
            amount: payoutAmount,
            status: PayoutStatus.COMPLETED,
            paidAt: new Date(),
          },
        });

        await tx.adminEarning.create({
          data: {
            adminId: group.adminId,
            groupId,
            cycleNumber,
            marginAmount: fromMinor(summaryVal.serviceMarginMinor),
            adminShareAmount: fromMinor(summaryVal.adminShareMinor),
            platformShareAmount: fromMinor(summaryVal.platformShareMinor),
            settledAt: new Date(),
          },
        });

        await this.ledger.record(
          {
            type: LedgerEntryType.DEBIT,
            amount: new Prisma.Decimal(payoutAmount.toString()),
            groupId,
            userId: recipient.userId,
            referenceType: "Payout",
            referenceId: payoutRow.id,
            description: `Mock finalize cycle ${cycleNumber}: payout to member (MoMo not integrated)`,
          },
          tx,
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
              where: { groupId, status: "ACTIVE" },
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

        return {
          payout: payoutRow,
          summary: summaryVal,
          groupCompleted,
          nextCycle,
        };
      });

    const serialized = this.serializeSummary(cycleSummary);
    const payoutAmountNum = Number(payout.amount.toString());

    this.logger.log(
      `[MOCK] cycle finalized groupId=${groupId} cycle=${cycleNumber} payoutId=${payout.id} recipientId=${payout.recipientId} amount=${payoutAmountNum.toFixed(2)} groupCompleted=${groupCompleted}`,
    );

    await this.notifications.create(
      payout.recipientId,
      "Payout received",
      `You received a payout of ${payoutAmountNum.toFixed(2)} from group (cycle ${cycleNumber}).`,
      "PAYOUT",
      { payoutId: payout.id, groupId },
    );

    const groupRow = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { adminId: true, name: true },
    });
    if (groupRow) {
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

    await this.audit.append({
      actorId: finalizedByUserId,
      action: "MOCK_FINALIZE_CYCLE",
      entityType: "Payout",
      entityId: payout.id,
      metadata: {
        groupId,
        cycleNumber,
        groupCompleted,
        nextCycle,
        mock: true,
      },
    });

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
