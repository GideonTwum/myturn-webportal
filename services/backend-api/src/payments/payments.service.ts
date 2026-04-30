import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  ContributionStatus,
  GroupStatus,
  LedgerEntryType,
  PaymentStatus,
  PaymentType,
  Prisma,
  UserRole,
} from "@prisma/client";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { CycleComplianceService } from "../cycle-risk/cycle-compliance.service";
import { LedgerService } from "../ledger/ledger.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
    private notifications: NotificationsService,
    private audit: AuditLogsService,
    private cycleCompliance: CycleComplianceService,
  ) {}

  /**
   * Records one per-day contribution payment (mock / staging).
   * Completes the contribution row only after paidDayCount reaches expectedDayCount.
   */
  async mockRecordContributionPayment(
    contributionId: string,
    recordedByUserId: string,
    recordedByRole: UserRole,
  ) {
    const contribution = await this.prisma.contribution.findUnique({
      where: { id: contributionId },
      include: { group: true, user: true },
    });
    if (!contribution) {
      throw new NotFoundException("Contribution not found");
    }
    if (recordedByRole === UserRole.USER) {
      if (contribution.userId !== recordedByUserId) {
        throw new ForbiddenException();
      }
    } else if (
      recordedByRole === UserRole.ADMIN &&
      contribution.group.adminId !== recordedByUserId
    ) {
      throw new ForbiddenException();
    }
    if (contribution.group.status !== GroupStatus.ACTIVE) {
      throw new BadRequestException(
        "Contributions can only be recorded for active groups",
      );
    }
    if (contribution.cycleNumber !== contribution.group.currentCycle) {
      throw new BadRequestException(
        `Payments apply to the current cycle only (cycle ${contribution.group.currentCycle})`,
      );
    }
    if (contribution.status === ContributionStatus.PAID) {
      throw new BadRequestException("This contribution is already fully paid");
    }
    if (contribution.paidDayCount >= contribution.expectedDayCount) {
      throw new BadRequestException("All required payments for this cycle are already recorded");
    }

    const dailyAmount = new Prisma.Decimal(
      contribution.group.contributionAmount.toString(),
    );
    const nextPaid = contribution.paidDayCount + 1;
    const complete = nextPaid >= contribution.expectedDayCount;

    const pay = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.contribution.updateMany({
        where: {
          id: contributionId,
          status: { not: ContributionStatus.PAID },
          paidDayCount: contribution.paidDayCount,
        },
        data: {
          paidDayCount: nextPaid,
          status: complete ? ContributionStatus.PAID : ContributionStatus.PENDING,
          paidAt: complete ? new Date() : null,
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException(
          "Could not record payment (already updated or completed)",
        );
      }
      const fresh = await tx.contribution.findUniqueOrThrow({
        where: { id: contributionId },
      });
      const payment = await tx.payment.create({
        data: {
          userId: contribution.userId,
          groupId: contribution.groupId,
          contributionId: contribution.id,
          amount: dailyAmount,
          type: PaymentType.CONTRIBUTION,
          status: PaymentStatus.COMPLETED,
          externalRef: `mock_${Date.now()}`,
          completedAt: new Date(),
          metadata: {
            mockContributionPayment: true,
            paidDayIndex: nextPaid,
            expectedDayCount: contribution.expectedDayCount,
          },
        },
      });
      await this.ledger.record(
        {
          type: LedgerEntryType.CREDIT,
          amount: dailyAmount,
          userId: contribution.userId,
          groupId: contribution.groupId,
          referenceType: "Payment",
          referenceId: payment.id,
          description:
            "Mock per-day contribution payment (MoMo not integrated)",
        },
        tx,
      );
      return { updated: fresh, payment };
    });

    this.logger.log(
      `[MOCK] contribution payment recorded paymentId=${pay.payment.id} contributionId=${contributionId} groupId=${contribution.groupId} cycle=${contribution.cycleNumber} day=${nextPaid}/${contribution.expectedDayCount} userId=${contribution.userId}`,
    );

    await this.notifications.create(
      contribution.userId,
      complete ? "Contribution complete" : "Contribution recorded",
      complete
        ? `Your cycle ${contribution.cycleNumber} contributions for ${contribution.group.name} are complete.`
        : `Payment ${nextPaid}/${contribution.expectedDayCount} recorded for ${contribution.group.name} (cycle ${contribution.cycleNumber}).`,
      "PAYMENT_MOCK_CONTRIBUTION",
      { contributionId, groupId: contribution.groupId },
    );

    await this.audit.append({
      actorId: recordedByUserId,
      action: "MOCK_CONTRIBUTION_PAYMENT",
      entityType: "Payment",
      entityId: pay.payment.id,
      metadata: {
        contributionId,
        groupId: contribution.groupId,
        paidDayIndex: nextPaid,
        expectedDayCount: contribution.expectedDayCount,
        mock: true,
      },
    });

    await this.cycleCompliance.syncGroupCompliance(contribution.groupId);

    return pay;
  }

  listForGroup(groupId: string, viewer?: { id: string; role: UserRole }) {
    if (viewer?.role === UserRole.ADMIN) {
      return this.prisma.group
        .findFirst({
          where: { id: groupId, adminId: viewer.id },
        })
        .then((g) => {
          if (!g) throw new ForbiddenException();
          return this.listForGroupQuery(groupId);
        });
    }
    return this.listForGroupQuery(groupId);
  }

  private listForGroupQuery(groupId: string) {
    return this.prisma.payment.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
}
