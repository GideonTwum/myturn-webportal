/**
 * Domain lifecycle for MoMo payment intents (maps to PaymentRequest in DB).
 * Backend remains financial authority — PSP adapters call into these states.
 */
export enum PaymentIntentStatus {
  CREATED = "CREATED",
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
  RECONCILED = "RECONCILED",
}

/** Maps Prisma PaymentRequestStatus → PaymentIntentStatus */
export function fromPaymentRequestStatus(
  status: string,
): PaymentIntentStatus {
  switch (status) {
    case "PENDING":
      return PaymentIntentStatus.PENDING;
    case "APPROVED":
      return PaymentIntentStatus.APPROVED;
    case "FAILED":
      return PaymentIntentStatus.FAILED;
    case "EXPIRED":
      return PaymentIntentStatus.EXPIRED;
    default:
      return PaymentIntentStatus.CREATED;
  }
}

export type PaymentIntentSnapshot = {
  id: string;
  status: PaymentIntentStatus;
  amount: string;
  contributionId: string;
  externalRef: string;
  providerRef?: string | null;
  expiresAt: string;
  reconciliationStatus: "NONE" | "PENDING" | "MATCHED" | "MISMATCH";
};
