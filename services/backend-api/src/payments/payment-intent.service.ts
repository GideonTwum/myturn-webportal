import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PaymentRequestStatus, Prisma } from "@prisma/client";
import {
  PaymentIntentStatus,
  fromPaymentRequestStatus,
} from "./payment-intent.types";

const ALLOWED: Record<PaymentIntentStatus, PaymentIntentStatus[]> = {
  [PaymentIntentStatus.CREATED]: [
    PaymentIntentStatus.PENDING,
    PaymentIntentStatus.FAILED,
    PaymentIntentStatus.EXPIRED,
  ],
  [PaymentIntentStatus.PENDING]: [
    PaymentIntentStatus.APPROVED,
    PaymentIntentStatus.FAILED,
    PaymentIntentStatus.EXPIRED,
  ],
  [PaymentIntentStatus.APPROVED]: [PaymentIntentStatus.RECONCILED],
  [PaymentIntentStatus.FAILED]: [],
  [PaymentIntentStatus.EXPIRED]: [],
  [PaymentIntentStatus.RECONCILED]: [],
};

@Injectable()
export class PaymentIntentService {
  private readonly logger = new Logger(PaymentIntentService.name);

  assertTransition(from: PaymentIntentStatus, to: PaymentIntentStatus): void {
    const allowed = ALLOWED[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Invalid payment intent transition: ${from} → ${to}`,
      );
    }
  }

  /** Intent-layer transition (metadata `intentStatus`), independent of Prisma row status. */
  transitionIntent(
    current: PaymentIntentStatus,
    target: PaymentIntentStatus,
    meta: { requestId: string; correlationId?: string },
  ): PaymentIntentStatus {
    this.assertTransition(current, target);
    this.logger.log(
      JSON.stringify({
        domain: "payment",
        event: "intent.transition",
        requestId: meta.requestId,
        from: current,
        to: target,
        correlationId: meta.correlationId ?? null,
      }),
    );
    return target;
  }

  transition(
    prismaStatus: PaymentRequestStatus,
    target: PaymentIntentStatus,
    meta: { requestId: string; correlationId?: string },
  ): PaymentIntentStatus {
    const current = fromPaymentRequestStatus(prismaStatus);
    this.assertTransition(current, target);
    this.logger.log(
      JSON.stringify({
        domain: "payment",
        event: "intent.transition",
        requestId: meta.requestId,
        from: current,
        to: target,
        correlationId: meta.correlationId ?? null,
      }),
    );
    return target;
  }

  metadataPatch(
    existing: unknown,
    patch: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    const base =
      typeof existing === "object" && existing !== null
        ? (existing as Record<string, unknown>)
        : {};
    return { ...base, ...patch, updatedAt: new Date().toISOString() };
  }
}
