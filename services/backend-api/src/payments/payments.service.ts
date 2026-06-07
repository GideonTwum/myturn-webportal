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
  PaymentStatus,
  PaymentType,
  Prisma,
  UserRole,
} from "@prisma/client";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { CycleComplianceService } from "../cycle-risk/cycle-compliance.service";
import { FinancialAllocationService } from "../ledger-accounts/financial-allocation.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { MemberParticipationService } from "../member/member-participation.service";

export type ContributionSettlementOptions = {
  provider?: string;
  externalRef?: string;
  paymentRequestId?: string;
  mock?: boolean;
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private allocation: FinancialAllocationService,
    private notifications: NotificationsService,
    private audit: AuditLogsService,
    private cycleCompliance: CycleComplianceService,
    private participation: MemberParticipationService,
  ) {}

  private async assertUserCanPay(userId: string, role: UserRole) {
    if (role === UserRole.USER) {
      await this.participation.assertCanParticipateFinancially(userId);
    }
  }

  /**
   * Records one per-day contribution payment with wallet ledger allocation.
   */
  async recordContributionPayment(
    contributionId: string,
    recordedByUserId: string,
    recordedByRole: UserRole,
    options: ContributionSettlementOptions = {},
  ) {
    const contribution = await this.prisma.contribution.findUnique({
      where: { id: contributionId },
      include: { group: true, user: true },
    });
    if (!contribution) {
      throw new NotFoundException("Contribution not found");
    }
    await this.assertUserCanPay(recordedByUserId, recordedByRole);
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
      throw new BadRequestException(
        "All required payments for this cycle are already recorded",
      );
    }

    const dailyAmount = new Prisma.Decimal(
      contribution.group.contributionAmount.toString(),
    );
    const nextPaid = contribution.paidDayCount + 1;
    const complete = nextPaid >= contribution.expectedDayCount;

    const result = await this.allocation.recordContributionSettlement({
      contributionId,
      recordedByUserId,
      recordedByRole,
      amount: dailyAmount,
      paidDayIndex: nextPaid,
      expectedDayCount: contribution.expectedDayCount,
      provider: options.provider,
      externalRef: options.externalRef,
      paymentRequestId: options.paymentRequestId,
      mock: options.mock,
    });

    const pay = result.payment;
    const tag = options.mock ? "MOCK" : options.provider ?? "SETTLED";

    this.logger.log(
      `[${tag}] contribution payment recorded paymentId=${pay.id} contributionId=${contributionId} groupId=${contribution.groupId} cycle=${contribution.cycleNumber} day=${nextPaid}/${contribution.expectedDayCount}`,
    );

    if (!result.duplicate) {
      await this.notifications.create(
        contribution.userId,
        complete ? "Contribution complete" : "Contribution recorded",
        complete
          ? `Your cycle ${contribution.cycleNumber} contributions for ${contribution.group.name} are complete.`
          : `Payment ${nextPaid}/${contribution.expectedDayCount} recorded for ${contribution.group.name} (cycle ${contribution.cycleNumber}).`,
        options.mock ? "PAYMENT_MOCK_CONTRIBUTION" : "PAYMENT_CONTRIBUTION",
        { contributionId, groupId: contribution.groupId, paymentId: pay.id },
      );

      await this.audit.append({
        actorId: recordedByUserId,
        action: options.mock ? "MOCK_CONTRIBUTION_PAYMENT" : "CONTRIBUTION_PAYMENT",
        entityType: "Payment",
        entityId: pay.id,
        metadata: {
          contributionId,
          groupId: contribution.groupId,
          paidDayIndex: nextPaid,
          provider: options.provider ?? null,
          mock: options.mock ?? false,
        },
      });

      await this.cycleCompliance.syncGroupCompliance(contribution.groupId);
    }

    return { payment: pay, duplicate: result.duplicate };
  }

  /** Staging/mock path — preserves existing endpoint behavior. */
  async mockRecordContributionPayment(
    contributionId: string,
    recordedByUserId: string,
    recordedByRole: UserRole,
  ) {
    return this.recordContributionPayment(
      contributionId,
      recordedByUserId,
      recordedByRole,
      { mock: true, provider: "mock" },
    );
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
