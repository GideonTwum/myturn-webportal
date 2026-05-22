import { Injectable } from "@nestjs/common";
import type {
  PaymentProvider,
  RequestToPayInput,
  RequestToPayResult,
  VerifyTransactionInput,
  VerifyTransactionResult,
  WebhookPayload,
} from "./payment-provider.interface";

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock-momo";

  async requestToPay(input: RequestToPayInput): Promise<RequestToPayResult> {
    return {
      provider: this.name,
      providerRef: `mock-${input.paymentRequestId}`,
      status: "PENDING",
      raw: { staging: true, hint: "POST mock-approve" },
    };
  }

  async verifyTransaction(
    input: VerifyTransactionInput,
  ): Promise<VerifyTransactionResult> {
    return {
      status: input.providerRef.startsWith("mock-") ? "APPROVED" : "PENDING",
      raw: { mock: true },
    };
  }

  async parseWebhook(_payload: WebhookPayload): Promise<VerifyTransactionResult | null> {
    return null;
  }
}
