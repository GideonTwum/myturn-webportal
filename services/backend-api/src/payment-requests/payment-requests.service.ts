import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PaymentRequestStatus, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MemberParticipationService } from "../member/member-participation.service";
import { IdempotencyService } from "../common/idempotency/idempotency.service";
import { createPaymentProvider } from "../payments/providers/placeholder-providers";
import { PaymentIntentService } from "../payments/payment-intent.service";
import { PaymentIntentStatus } from "../payments/payment-intent.types";
import { PaymentsService } from "../payments/payments.service";

const REQUEST_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class PaymentRequestsService {
  private readonly paymentProvider = createPaymentProvider();

  constructor(
    private prisma: PrismaService,
    private participation: MemberParticipationService,
    private payments: PaymentsService,
    private idempotency: IdempotencyService,
    private intents: PaymentIntentService,
  ) {}

  async initiateContributionPayment(userId: string, contributionId: string) {
    await this.participation.assertCanParticipateFinancially(userId);

    const contribution = await this.prisma.contribution.findUnique({
      where: { id: contributionId },
      include: { group: true },
    });
    if (!contribution || contribution.userId !== userId) {
      throw new NotFoundException("Contribution not found");
    }

    const amount = contribution.group.contributionAmount;
    const expiresAt = new Date(Date.now() + REQUEST_TTL_MS);

    const existing = await this.prisma.paymentRequest.findFirst({
      where: {
        contributionId,
        userId,
        status: PaymentRequestStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });
    if (existing) {
      return this.toDto(existing);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    const phoneDigits = user?.phone?.replace(/\D/g, "") ?? "";

    const req = await this.prisma.paymentRequest.create({
      data: {
        userId,
        groupId: contribution.groupId,
        contributionId,
        amount,
        expiresAt,
        metadata: this.intents.metadataPatch(null, {
          channel: "momo",
          intentStatus: PaymentIntentStatus.CREATED,
          provider: this.paymentProvider.name,
        }),
      },
    });

    const intentStatus = this.intents.transitionIntent(
      PaymentIntentStatus.CREATED,
      PaymentIntentStatus.PENDING,
      { requestId: req.id, correlationId: req.externalRef },
    );

    try {
      const psp = await this.paymentProvider.requestToPay({
        paymentRequestId: req.id,
        amount: amount.toString(),
        currency: "GHS",
        phoneDigits,
        externalRef: req.externalRef,
      });
      await this.prisma.paymentRequest.update({
        where: { id: req.id },
        data: {
          providerRef: psp.providerRef,
          metadata: this.intents.metadataPatch(req.metadata, {
            intentStatus,
            correlationId: req.externalRef,
            pspStatus: psp.status,
          }),
        },
      });
    } catch {
      /* mock/staging may not call live PSP */
    }

    return {
      ...this.toDto(req),
      message:
        "Approve the MoMo prompt on your phone. (Staging: use mock-approve endpoint.)",
      mockApproveHint: `/api/member/payment-requests/${req.id}/mock-approve`,
    };
  }

  async getRequest(userId: string, requestId: string) {
    const req = await this.prisma.paymentRequest.findFirst({
      where: { id: requestId, userId },
    });
    if (!req) throw new NotFoundException("Payment request not found");
    if (
      req.status === PaymentRequestStatus.PENDING &&
      req.expiresAt < new Date()
    ) {
      this.intents.transitionIntent(
        PaymentIntentStatus.PENDING,
        PaymentIntentStatus.EXPIRED,
        { requestId: req.id, correlationId: req.externalRef },
      );
      await this.prisma.paymentRequest.update({
        where: { id: req.id },
        data: {
          status: PaymentRequestStatus.EXPIRED,
          metadata: this.intents.metadataPatch(req.metadata, {
            intentStatus: PaymentIntentStatus.EXPIRED,
          }),
        },
      });
      return this.toDto({ ...req, status: PaymentRequestStatus.EXPIRED });
    }
    return this.toDto(req);
  }

  /** Staging: simulates MoMo approval → records contribution payment. */
  async mockApprove(userId: string, requestId: string) {
    const result = await this.idempotency.runOnce(
      `mock-approve:${requestId}:${userId}`,
      86400,
      () => this.executeMockApprove(userId, requestId),
    );
    if (result.duplicate) {
      return result.value;
    }
    return result.value;
  }

  private async executeMockApprove(userId: string, requestId: string) {
    const req = await this.prisma.paymentRequest.findFirst({
      where: { id: requestId, userId },
    });
    if (!req) throw new NotFoundException("Payment request not found");
    if (req.status !== PaymentRequestStatus.PENDING) {
      throw new BadRequestException(`Request is ${req.status}`);
    }
    if (req.expiresAt < new Date()) {
      this.intents.transitionIntent(
        PaymentIntentStatus.PENDING,
        PaymentIntentStatus.EXPIRED,
        { requestId: req.id, correlationId: req.externalRef },
      );
      await this.prisma.paymentRequest.update({
        where: { id: req.id },
        data: {
          status: PaymentRequestStatus.EXPIRED,
          metadata: this.intents.metadataPatch(req.metadata, {
            intentStatus: PaymentIntentStatus.EXPIRED,
          }),
        },
      });
      throw new BadRequestException("Payment request expired");
    }

    this.intents.transitionIntent(
      PaymentIntentStatus.PENDING,
      PaymentIntentStatus.APPROVED,
      { requestId: req.id, correlationId: req.externalRef },
    );

    await this.payments.mockRecordContributionPayment(
      req.contributionId,
      userId,
      UserRole.USER,
    );

    const providerRef = `mock-momo-${Date.now()}`;
    const updated = await this.prisma.paymentRequest.update({
      where: { id: req.id },
      data: {
        status: PaymentRequestStatus.APPROVED,
        approvedAt: new Date(),
        providerRef,
        metadata: {
          ...(typeof req.metadata === "object" && req.metadata ? req.metadata : {}),
          intentStatus: PaymentIntentStatus.APPROVED,
          reconciliationStatus: "PENDING",
        },
      },
    });

    return {
      ...this.toDto(updated),
      receipt: {
        title: "Contribution received",
        amount: updated.amount.toString(),
        reference: updated.externalRef,
      },
    };
  }

  private toDto(req: {
    id: string;
    contributionId: string;
    groupId: string;
    amount: { toString(): string };
    status: PaymentRequestStatus;
    externalRef: string;
    expiresAt: Date;
    approvedAt: Date | null;
    failureReason: string | null;
    createdAt: Date;
  }) {
    return {
      id: req.id,
      contributionId: req.contributionId,
      groupId: req.groupId,
      amount: req.amount.toString(),
      status: req.status,
      externalRef: req.externalRef,
      expiresAt: req.expiresAt.toISOString(),
      approvedAt: req.approvedAt?.toISOString() ?? null,
      failureReason: req.failureReason,
      createdAt: req.createdAt.toISOString(),
    };
  }
}
