export type DisbursementTransferInput = {
  withdrawalId: string;
  amount: string;
  currency?: string;
  phoneDigits: string;
  externalRef: string;
};

export type DisbursementTransferResult = {
  provider: string;
  providerRef: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  failureReason?: string;
  raw?: unknown;
};

export type DisbursementVerifyResult = {
  status: "PENDING" | "COMPLETED" | "FAILED";
  failureReason?: string;
  raw?: unknown;
};

export type DisbursementWebhookPayload = {
  provider: string;
  providerRef?: string;
  externalRef?: string;
  body: Record<string, unknown>;
};

export interface DisbursementProvider {
  readonly name: string;
  requestTransfer(input: DisbursementTransferInput): Promise<DisbursementTransferResult>;
  verifyTransfer(providerRef: string): Promise<DisbursementVerifyResult>;
  parseWebhook(payload: DisbursementWebhookPayload): Promise<DisbursementVerifyResult | null>;
}
