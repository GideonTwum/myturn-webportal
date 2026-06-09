import { Logger } from "@nestjs/common";
import { formatMtnPartyId } from "../../payments/providers/mtn-momo-sandbox.provider";
import { getPublicApiBaseUrl } from "../../common/platform-env";
import type {
  DisbursementProvider,
  DisbursementTransferInput,
  DisbursementTransferResult,
  DisbursementVerifyResult,
  DisbursementWebhookPayload,
} from "./disbursement-provider.interface";

/**
 * MTN MoMo Disbursement API (separate product from Collection).
 * @see https://momodeveloper.mtn.com/
 *
 * Uses DISBURSEMENT_* env vars — do not reuse Collection credentials in production.
 */
export function resolveMtnDisbursementCallbackUrl(): string {
  const explicit = process.env.MTN_MOMO_DISBURSEMENT_CALLBACK_HOST?.trim();
  const base = explicit
    ? explicit.replace(/\/+$/, "")
    : getPublicApiBaseUrl().replace(/\/api\/?$/, "");
  return `${base}/api/webhooks/mtn-disbursement`;
}

export class MtnMomoDisbursementProvider implements DisbursementProvider {
  readonly name = "mtn-momo-disbursement";
  private readonly logger = new Logger(MtnMomoDisbursementProvider.name);

  private baseUrl(): string {
    const env =
      process.env.MTN_MOMO_DISBURSEMENT_ENVIRONMENT?.trim() ??
      process.env.MTN_MOMO_ENVIRONMENT?.trim() ??
      "sandbox";
    if (env === "production") {
      return "https://proxy.momoapi.mtn.com";
    }
    return "https://sandbox.momodeveloper.mtn.com";
  }

  private configured(): boolean {
    return Boolean(
      process.env.MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY?.trim() &&
        process.env.MTN_MOMO_DISBURSEMENT_API_USER?.trim() &&
        process.env.MTN_MOMO_DISBURSEMENT_API_KEY?.trim(),
    );
  }

  private subscriptionKey(): string {
    return process.env.MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY!.trim();
  }

  private async getAccessToken(): Promise<string> {
    const user = process.env.MTN_MOMO_DISBURSEMENT_API_USER!.trim();
    const apiKey = process.env.MTN_MOMO_DISBURSEMENT_API_KEY!.trim();
    const res = await fetch(`${this.baseUrl()}/disbursement/token/`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": this.subscriptionKey(),
        Authorization: `Basic ${Buffer.from(`${user}:${apiKey}`).toString("base64")}`,
      },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`MTN disbursement token failed ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) throw new Error("MTN disbursement token missing access_token");
    return json.access_token;
  }

  private targetEnv(): string {
    return (
      process.env.MTN_MOMO_DISBURSEMENT_TARGET_ENV?.trim() ??
      process.env.MTN_MOMO_TARGET_ENV?.trim() ??
      "sandbox"
    );
  }

  async requestTransfer(
    input: DisbursementTransferInput,
  ): Promise<DisbursementTransferResult> {
    if (!this.configured()) {
      throw new Error(
        "MTN MoMo disbursement not configured. Set MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY, MTN_MOMO_DISBURSEMENT_API_USER, MTN_MOMO_DISBURSEMENT_API_KEY.",
      );
    }
    const token = await this.getAccessToken();
    const ref = input.externalRef;
    const partyId = formatMtnPartyId(input.phoneDigits);
    if (!/^233\d{9}$/.test(partyId)) {
      throw new Error(
        `Invalid MoMo payee MSISDN ${partyId} — use Ghana mobile 024… or 23324…`,
      );
    }

    const res = await fetch(`${this.baseUrl()}/disbursement/v1_0/transfer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Reference-Id": ref,
        "X-Target-Environment": this.targetEnv(),
        "Ocp-Apim-Subscription-Key": this.subscriptionKey(),
        "X-Callback-Url": resolveMtnDisbursementCallbackUrl(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency ?? "GHS",
        externalId: ref,
        payee: {
          partyIdType: "MSISDN",
          partyId,
        },
        payerMessage: "MyTurn wallet withdrawal",
        payeeNote: input.withdrawalId,
      }),
    });

    if (res.status !== 202 && !res.ok) {
      const t = await res.text();
      throw new Error(`MTN disbursement transfer ${res.status}: ${t.slice(0, 300)}`);
    }

    this.logger.log(
      JSON.stringify({
        domain: "disbursement",
        event: "mtn.transfer.requested",
        externalRef: ref,
        withdrawalId: input.withdrawalId,
        amount: input.amount,
      }),
    );

    return {
      provider: this.name,
      providerRef: ref,
      status: "PENDING",
      raw: { httpStatus: res.status },
    };
  }

  async verifyTransfer(providerRef: string): Promise<DisbursementVerifyResult> {
    if (!this.configured()) {
      return { status: "PENDING", raw: { unconfigured: true } };
    }
    const token = await this.getAccessToken();
    const res = await fetch(
      `${this.baseUrl()}/disbursement/v1_0/transfer/${providerRef}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Target-Environment": this.targetEnv(),
          "Ocp-Apim-Subscription-Key": this.subscriptionKey(),
        },
      },
    );
    if (!res.ok) {
      return { status: "PENDING", raw: { httpStatus: res.status } };
    }
    const body = (await res.json()) as { status?: string; reason?: string };
    const s = body.status?.toUpperCase();
    if (s === "SUCCESSFUL") return { status: "COMPLETED", raw: body };
    if (s === "FAILED") {
      return {
        status: "FAILED",
        failureReason: body.reason ?? "MoMo disbursement failed",
        raw: body,
      };
    }
    return { status: "PENDING", raw: body };
  }

  async parseWebhook(
    payload: DisbursementWebhookPayload,
  ): Promise<DisbursementVerifyResult | null> {
    const body = payload.body;
    const ref = String(
      payload.providerRef ??
        payload.externalRef ??
        body.externalId ??
        body.referenceId ??
        "",
    ).trim();
    const direct = String(body.status ?? "").toUpperCase();
    if (direct === "SUCCESSFUL") {
      return { status: "COMPLETED", raw: body };
    }
    if (direct === "FAILED") {
      return {
        status: "FAILED",
        failureReason: String(body.reason ?? "MoMo disbursement failed"),
        raw: body,
      };
    }
    if (!ref) return null;
    return this.verifyTransfer(ref);
  }
}
