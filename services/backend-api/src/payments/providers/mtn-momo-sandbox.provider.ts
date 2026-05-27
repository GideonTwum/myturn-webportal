import { Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { getPublicApiBaseUrl } from "../../common/platform-env";
import type {
  PaymentProvider,
  RequestToPayInput,
  RequestToPayResult,
  VerifyTransactionInput,
  VerifyTransactionResult,
  WebhookPayload,
} from "./payment-provider.interface";

/**
 * MTN MoMo Collection API (sandbox).
 * @see https://momodeveloper.mtn.com/
 */
/** MTN Collection API expects MSISDN as 233XXXXXXXXX. */
export function formatMtnPartyId(phoneDigits: string): string {
  const d = phoneDigits.replace(/\D/g, "");
  if (d.startsWith("233")) return d;
  if (d.startsWith("0")) return `233${d.slice(1)}`;
  if (d.length === 9) return `233${d}`;
  return d;
}

export function resolveMtnCallbackUrl(): string {
  const explicit = process.env.MTN_MOMO_CALLBACK_HOST?.trim();
  const base = explicit
    ? explicit.replace(/\/+$/, "")
    : getPublicApiBaseUrl().replace(/\/api\/?$/, "");
  return `${base}/api/webhooks/mtn`;
}

export class MtnMomoSandboxProvider implements PaymentProvider {
  readonly name = "mtn-momo-sandbox";
  private readonly logger = new Logger(MtnMomoSandboxProvider.name);

  private baseUrl(): string {
    const env = process.env.MTN_MOMO_ENVIRONMENT?.trim() ?? "sandbox";
    if (env === "production") {
      return "https://proxy.momoapi.mtn.com";
    }
    return "https://sandbox.momodeveloper.mtn.com";
  }

  private configured(): boolean {
    return Boolean(
      process.env.MTN_MOMO_SUBSCRIPTION_KEY?.trim() &&
        process.env.MTN_MOMO_API_USER?.trim() &&
        process.env.MTN_MOMO_API_KEY?.trim(),
    );
  }

  private async getAccessToken(): Promise<string> {
    const subKey = process.env.MTN_MOMO_SUBSCRIPTION_KEY!.trim();
    const user = process.env.MTN_MOMO_API_USER!.trim();
    const apiKey = process.env.MTN_MOMO_API_KEY!.trim();
    const res = await fetch(`${this.baseUrl()}/collection/token/`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": subKey,
        Authorization: `Basic ${Buffer.from(`${user}:${apiKey}`).toString("base64")}`,
      },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`MTN token failed ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) throw new Error("MTN token missing access_token");
    return json.access_token;
  }

  async requestToPay(input: RequestToPayInput): Promise<RequestToPayResult> {
    if (!this.configured()) {
      throw new Error(
        "MTN MoMo sandbox not configured. Set MTN_MOMO_SUBSCRIPTION_KEY, MTN_MOMO_API_USER, MTN_MOMO_API_KEY.",
      );
    }
    const token = await this.getAccessToken();
    const ref = input.externalRef || randomUUID();
    const correlationId = ref;
    const target = resolveMtnCallbackUrl();
    const partyId = formatMtnPartyId(input.phoneDigits);
    if (!/^233\d{9}$/.test(partyId)) {
      throw new Error(
        `Invalid MoMo payer MSISDN ${partyId} — use Ghana mobile 024… or 23324…`,
      );
    }

    const res = await fetch(`${this.baseUrl()}/collection/v1_0/requesttopay`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Reference-Id": ref,
        "X-Target-Environment": process.env.MTN_MOMO_TARGET_ENV ?? "sandbox",
        "Ocp-Apim-Subscription-Key": process.env.MTN_MOMO_SUBSCRIPTION_KEY!.trim(),
        "X-Callback-Url": target,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency || "GHS",
        externalId: ref,
        payer: {
          partyIdType: "MSISDN",
          partyId,
        },
        payerMessage: "MyTurn contribution",
        payeeNote: input.paymentRequestId,
      }),
    });

    if (res.status !== 202 && !res.ok) {
      const t = await res.text();
      throw new Error(`MTN requestToPay ${res.status}: ${t.slice(0, 300)}`);
    }

    this.logger.log(
      JSON.stringify({
        domain: "payment",
        event: "mtn.requesttopay",
        externalRef: ref,
        correlationId,
        amount: input.amount,
      }),
    );

    return {
      provider: this.name,
      providerRef: ref,
      status: "PENDING",
      raw: { correlationId, httpStatus: res.status },
    };
  }

  async verifyTransaction(
    input: VerifyTransactionInput,
  ): Promise<VerifyTransactionResult> {
    if (!this.configured()) {
      return { status: "PENDING", raw: { unconfigured: true } };
    }
    const token = await this.getAccessToken();
    const ref = input.providerRef || input.externalRef;
    const res = await fetch(
      `${this.baseUrl()}/collection/v1_0/requesttopay/${ref}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Target-Environment": process.env.MTN_MOMO_TARGET_ENV ?? "sandbox",
          "Ocp-Apim-Subscription-Key": process.env.MTN_MOMO_SUBSCRIPTION_KEY!.trim(),
        },
      },
    );
    if (!res.ok) {
      return { status: "PENDING", raw: { httpStatus: res.status } };
    }
    const body = (await res.json()) as { status?: string };
    const s = body.status?.toUpperCase();
    if (s === "SUCCESSFUL") return { status: "APPROVED", raw: body };
    if (s === "FAILED") return { status: "FAILED", raw: body };
    return { status: "PENDING", raw: body };
  }

  async parseWebhook(payload: WebhookPayload): Promise<VerifyTransactionResult | null> {
    const body = payload.body as Record<string, unknown>;
    const ref = String(
      body.externalId ??
        body.referenceId ??
        body.X_Reference_Id ??
        body.financialTransactionId ??
        "",
    );
    const direct = String(body.status ?? "").toUpperCase();
    if (direct === "SUCCESSFUL") {
      return { status: "APPROVED", raw: body };
    }
    if (direct === "FAILED") {
      return { status: "FAILED", raw: body };
    }
    if (!ref) return null;
    return this.verifyTransaction({ providerRef: ref, externalRef: ref });
  }
}
