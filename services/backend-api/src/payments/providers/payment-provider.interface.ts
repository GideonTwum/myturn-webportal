import type { PaymentIntentSnapshot } from "../payment-intent.types";

export type RequestToPayInput = {
  paymentRequestId: string;
  amount: string;
  currency: string;
  phoneDigits: string;
  externalRef: string;
};

export type RequestToPayResult = {
  provider: string;
  providerRef: string;
  status: "PENDING" | "FAILED";
  raw?: unknown;
};

export type VerifyTransactionInput = {
  providerRef: string;
  externalRef: string;
};

export type VerifyTransactionResult = {
  status: "APPROVED" | "PENDING" | "FAILED";
  amount?: string;
  raw?: unknown;
};

export type WebhookPayload = {
  provider: string;
  eventType: string;
  providerRef: string;
  externalRef: string;
  signature?: string;
  body: unknown;
};

export interface PaymentProvider {
  readonly name: string;
  requestToPay(input: RequestToPayInput): Promise<RequestToPayResult>;
  verifyTransaction(input: VerifyTransactionInput): Promise<VerifyTransactionResult>;
  parseWebhook(payload: WebhookPayload): Promise<VerifyTransactionResult | null>;
}

export type ReconciliationRecord = {
  paymentRequestId: string;
  pspStatus: string;
  ledgerSettled: boolean;
  contributionPaid: boolean;
  matched: boolean;
};

export interface PaymentReconciliationPort {
  reconcile(intent: PaymentIntentSnapshot): Promise<ReconciliationRecord>;
}
