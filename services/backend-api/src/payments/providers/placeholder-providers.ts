import type {
  PaymentProvider,
  RequestToPayResult,
  VerifyTransactionResult,
} from "./payment-provider.interface";
import { MockPaymentProvider } from "./mock-payment.provider";

function notConfigured(name: string): PaymentProvider {
  return {
    name,
    async requestToPay(): Promise<RequestToPayResult> {
      throw new Error(`${name} MoMo provider not configured`);
    },
    async verifyTransaction(): Promise<VerifyTransactionResult> {
      throw new Error(`${name} MoMo provider not configured`);
    },
    async parseWebhook() {
      return null;
    },
  };
}

export const MtnPaymentProvider = notConfigured("mtn");
export const VodafonePaymentProvider = notConfigured("vodafone");
export const AirtelTigoPaymentProvider = notConfigured("airteltigo");

export function createPaymentProvider(): PaymentProvider {
  const p = process.env.PAYMENT_PROVIDER?.trim().toLowerCase() ?? "mock";
  if (p === "mtn") return MtnPaymentProvider;
  if (p === "vodafone") return VodafonePaymentProvider;
  if (p === "airteltigo") return AirtelTigoPaymentProvider;
  return new MockPaymentProvider();
}
