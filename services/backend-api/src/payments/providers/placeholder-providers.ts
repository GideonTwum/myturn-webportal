import { getMtnCollectionReadiness } from "../../common/provider-readiness";
import type { PaymentProvider } from "./payment-provider.interface";
import { MockPaymentProvider } from "./mock-payment.provider";
import { MtnMomoSandboxProvider } from "./mtn-momo-sandbox.provider";

function notConfigured(name: string): PaymentProvider {
  return {
    name,
    async requestToPay() {
      throw new Error(`${name} MoMo provider not configured`);
    },
    async verifyTransaction() {
      throw new Error(`${name} MoMo provider not configured`);
    },
    async parseWebhook() {
      return null;
    },
  };
}

export const VodafonePaymentProvider = notConfigured("vodafone");
export const AirtelTigoPaymentProvider = notConfigured("airteltigo");

export function createPaymentProvider(): PaymentProvider {
  const p = process.env.PAYMENT_PROVIDER?.trim().toLowerCase() ?? "mock";
  if (p === "mtn" || p === "mtn-momo" || p === "mtn-sandbox") {
    return new MtnMomoSandboxProvider();
  }
  if (p === "vodafone") return VodafonePaymentProvider;
  if (p === "airteltigo") return AirtelTigoPaymentProvider;
  return new MockPaymentProvider();
}

export async function pingPaymentProvider(): Promise<
  "ok" | "unconfigured" | "error"
> {
  return getMtnCollectionReadiness().health;
}
