import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PaymentRequestStatus, Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MemberParticipationService } from "../member/member-participation.service";
import { IdempotencyService } from "../common/idempotency/idempotency.service";
import { getPlatformFeatureFlags } from "../common/platform-env";
import { createPaymentProvider } from "../payments/providers/placeholder-providers";
import { PaymentIntentService } from "../payments/payment-intent.service";
import { PaymentIntentStatus } from "../payments/payment-intent.types";
import { PaymentsService } from "../payments/payments.service";

const REQUEST_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class PaymentRequestsService {
  private readonly logger = new Logger(PaymentRequestsService.name);
  private readonly paymentProvider = createPaymentProvider();

  constructor(
    private prisma: PrismaService,
    private participation: MemberParticipationService,
    private payments: PaymentsService,
    private idempotency: IdempotencyService,
    private intents: PaymentIntentService,
  ) {}

  private isLiveMomoProvider(): boolean {
    return this.paymentProvider.name.startsWith("mtn");
  }

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
      return this.buildInitiateResponse(existing);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    const phoneDigits = user?.phone?.replace(/\D/g, "") ?? "";
    if (this.isLiveMomoProvider() && !phoneDigits) {
      throw new BadRequestException(
        "Add a valid Ghana phone number to your profile before paying with MoMo.",
      );
    }

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
    } catch (e) {
      if (this.isLiveMomoProvider()) {
        const reason =
          e instanceof Error ? e.message : "MoMo request failed";
        await this.prisma.paymentRequest.update({
          where: { id: req.id },
          data: {
            status: PaymentRequestStatus.FAILED,
            failureReason: reason.slice(0, 500),
            metadata: this.intents.metadataPatch(req.metadata, {
              intentStatus: PaymentIntentStatus.FAILED,
            }),
          },
        });
        throw new BadRequestException(reason);
      }
      this.logger.warn(
        `PSP requestToPay skipped for ${this.paymentProvider.name}: ${e instanceof Error ? e.message : e}`,
      );
    }

    const fresh = await this.prisma.paymentRequest.findUniqueOrThrow({
      where: { id: req.id },
    });
    return this.buildInitiateResponse(fresh);
  }

  private buildInitiateResponse(req: {
    id: string;
    contributionId: string;
    groupId: string;
    amount: Prisma.Decimal;
    status: PaymentRequestStatus;
    externalRef: string;
    expiresAt: Date;
    approvedAt: Date | null;
    failureReason: string | null;
    createdAt: Date;
  }) {
    const flags = getPlatformFeatureFlags();
    const liveMomo = this.isLiveMomoProvider();
    return {
      ...this.toDto(req),
      message: liveMomo
        ? "Approve the MoMo prompt on your phone."
        : "Approve the MoMo prompt on your phone. (Staging: use mock-approve endpoint.)",
      ...(flags.mockPayments && !liveMomo
        ? {
            mockApproveHint: `/api/member/payment-requests/${req.id}/mock-approve`,
          }
        : {}),
    };
  }

  async getRequest(userId: string, requestId: string) {
    let req = await this.prisma.paymentRequest.findFirst({
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

    if (req.status === PaymentRequestStatus.PENDING && this.isLiveMomoProvider()) {
      await this.pollPspAndSettle(req.externalRef);
      req =
        (await this.prisma.paymentRequest.findFirst({
          where: { id: requestId, userId },
        })) ?? req;
    }

    return this.toDto(req);
  }

  /** Webhook / reconciliation: settle by MoMo reference (PaymentRequest.externalRef). */
  async settleByExternalRef(
    externalRef: string,
    outcome: "APPROVED" | "FAILED",
    failureReason?: string,
  ): Promise<{ settled: boolean; status?: PaymentRequestStatus }> {
    const ref = externalRef.trim();
    if (!ref) return { settled: false };

    const result = await this.idempotency.runOnce(
      `settle:${ref}:${outcome}`,
      86400,
      async () => {
        const req = await this.prisma.paymentRequest.findUnique({
          where: { externalRef: ref },
        });
        if (!req) {
          return { settled: false as const };
        }
        if (req.status !== PaymentRequestStatus.PENDING) {
          return { settled: false as const, status: req.status };
        }
        if (req.expiresAt < new Date()) {
          await this.markExpired(req);
          return { settled: true as const, status: PaymentRequestStatus.EXPIRED };
        }
        if (outcome === "FAILED") {
          await this.markFailed(req, failureReason ?? "MoMo payment failed");
          return { settled: true as const, status: PaymentRequestStatus.FAILED };
        }
        await this.approvePendingRequest(req);
        return { settled: true as const, status: PaymentRequestStatus.APPROVED };
      },
    );
    return result.value;
  }

  private async pollPspAndSettle(externalRef: string) {
    try {
      const verify = await this.paymentProvider.verifyTransaction({
        providerRef: externalRef,
        externalRef,
      });
      if (verify.status === "APPROVED") {
        await this.settleByExternalRef(externalRef, "APPROVED");
      } else if (verify.status === "FAILED") {
        await this.settleByExternalRef(externalRef, "FAILED");
      }
    } catch (e) {
      this.logger.warn(
        `MoMo poll failed for ${externalRef}: ${e instanceof Error ? e.message : e}`,
      );
    }
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
      await this.markExpired(req);
      throw new BadRequestException("Payment request expired");
    }

    await this.approvePendingRequest(req);
    const updated = await this.prisma.paymentRequest.findUniqueOrThrow({
      where: { id: req.id },
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

  private async approvePendingRequest(req: {
    id: string;
    userId: string;
    contributionId: string;
    externalRef: string;
    metadata: Prisma.JsonValue;
    amount: Prisma.Decimal;
    providerRef: string | null;
  }) {
    this.intents.transitionIntent(
      PaymentIntentStatus.PENDING,
      PaymentIntentStatus.APPROVED,
      { requestId: req.id, correlationId: req.externalRef },
    );

    await this.payments.mockRecordContributionPayment(
      req.contributionId,
      req.userId,
      UserRole.USER,
    );

    await this.prisma.paymentRequest.update({
      where: { id: req.id },
      data: {
        status: PaymentRequestStatus.APPROVED,
        approvedAt: new Date(),
        providerRef: req.providerRef ?? req.externalRef,
        metadata: {
          ...(typeof req.metadata === "object" && req.metadata ? req.metadata : {}),
          intentStatus: PaymentIntentStatus.APPROVED,
          reconciliationStatus: "PENDING",
        },
      },
    });
  }

  private async markExpired(req: { id: string; externalRef: string; metadata: Prisma.JsonValue }) {
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
  }

  private async markFailed(
    req: { id: string; externalRef: string; metadata: Prisma.JsonValue },
    failureReason: string,
  ) {
    this.intents.transitionIntent(
      PaymentIntentStatus.PENDING,
      PaymentIntentStatus.FAILED,
      { requestId: req.id, correlationId: req.externalRef },
    );
    await this.prisma.paymentRequest.update({
      where: { id: req.id },
      data: {
        status: PaymentRequestStatus.FAILED,
        failureReason: failureReason.slice(0, 500),
        metadata: this.intents.metadataPatch(req.metadata, {
          intentStatus: PaymentIntentStatus.FAILED,
        }),
      },
    });
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
