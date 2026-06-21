import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotImplementedException,
  UnauthorizedException,
} from "@nestjs/common";
import { getDeploymentTier } from "../common/platform-env";
import { IdempotencyService } from "../common/idempotency/idempotency.service";
import { createPaymentProvider } from "../payments/providers/placeholder-providers";
import { PaymentRequestsService } from "../payment-requests/payment-requests.service";
import { WithdrawalsService } from "../withdrawals/withdrawals.service";
import {
  getWebhookAuthMode,
  shouldRejectWebhook,
} from "./webhook-auth";
import { verifyWebhookSignature } from "./webhook-signature";

export type InboundWebhook = {
  provider: string;
  signature?: string;
  idempotencyKey?: string;
  body: Record<string, unknown>;
  correlationId?: string;
};

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private idempotency: IdempotencyService,
    @Inject(forwardRef(() => PaymentRequestsService))
    private paymentRequests: PaymentRequestsService,
    private withdrawals: WithdrawalsService,
  ) {}

  async processInbound(payload: InboundWebhook) {
    if (getDeploymentTier() === "production" && payload.provider === "mock") {
      throw new NotImplementedException("Mock webhooks disabled in production");
    }

    const tier = getDeploymentTier();
    const authMode = getWebhookAuthMode(payload.provider);
    const rawBody = JSON.stringify(payload.body);
    const sig = verifyWebhookSignature({
      provider: payload.provider,
      rawBody,
      signature: payload.signature,
    });

    const correlationId =
      payload.correlationId ??
      String(
        payload.body?.externalId ??
          payload.body?.referenceId ??
          payload.body?.externalRef ??
          "",
      );

    if (shouldRejectWebhook({ tier, authMode, signature: sig })) {
      this.logger.warn(
        JSON.stringify({
          domain: "webhook",
          event: "webhook.rejected",
          provider: payload.provider,
          authMode,
          reason: sig.reason,
          correlationId,
        }),
      );
      throw new UnauthorizedException("Invalid webhook signature");
    }

    if (!sig.valid && authMode === "mtn_api_verify") {
      this.logger.log(
        JSON.stringify({
          domain: "webhook",
          event: "webhook.mtn_no_hmac",
          provider: payload.provider,
          note: "MTN callback accepted without x-signature; settlement requires API verify + known reference",
          correlationId: correlationId || null,
        }),
      );
    }

    const idemKey =
      payload.idempotencyKey ??
      `${payload.provider}:${String(payload.body?.externalRef ?? payload.body?.transactionId ?? (correlationId || "unknown"))}`;

    const result = await this.idempotency.runOnce(
      `webhook:${idemKey}`,
      86400,
      async () => {
        let settlement: { settled: boolean; status?: string } | null = null;
        const providerNorm = payload.provider.trim().toLowerCase();
        if (
          providerNorm === "mtn-disbursement" ||
          providerNorm === "mtn-disburse"
        ) {
          settlement = await this.applyMtnDisbursementWebhook(
            payload.body,
            correlationId,
          );
        } else if (providerNorm === "mtn" || providerNorm.startsWith("mtn-")) {
          settlement = await this.applyMtnWebhook(payload.body, correlationId);
        }

        this.logger.log(
          JSON.stringify({
            domain: "webhook",
            event: "webhook.processed",
            provider: payload.provider,
            signatureVerified: sig.valid,
            correlationId: correlationId || null,
            settlement,
            replayProtection: "idempotency_key",
          }),
        );
        return {
          accepted: true,
          provider: payload.provider,
          status: settlement?.settled ? settlement.status ?? "settled" : "logged",
          reconciliation: settlement?.settled ? "APPLIED" : "PENDING",
          correlationId: correlationId || null,
        };
      },
    );

    if (result.duplicate) {
      this.logger.warn(
        JSON.stringify({
          domain: "webhook",
          event: "webhook.duplicate",
          idempotencyKey: idemKey,
          correlationId: correlationId || null,
        }),
      );
    }

    return result.value;
  }

  private async applyMtnDisbursementWebhook(
    body: Record<string, unknown>,
    correlationId: string,
  ) {
    const ref = String(
      correlationId ||
        body.externalId ||
        body.referenceId ||
        body.externalRef ||
        "",
    ).trim();
    const result = await this.withdrawals.applyDisbursementWebhook(
      body,
      "mtn-disbursement",
    );
    if (!ref || !result.settled) {
      return { settled: false };
    }
    return {
      settled: true,
      status:
        "status" in result && result.status
          ? String(result.status)
          : "settled",
    };
  }

  private async applyMtnWebhook(
    body: Record<string, unknown>,
    correlationId: string,
  ) {
    const psp = createPaymentProvider();
    const ref = String(
      correlationId ||
        body.externalId ||
        body.referenceId ||
        body.externalRef ||
        "",
    ).trim();
    const parsed = await psp.parseWebhook({
      provider: "mtn",
      eventType: String(body.status ?? "callback"),
      providerRef: ref,
      externalRef: ref,
      body,
    });
    if (!ref || !parsed) {
      return { settled: false };
    }
    if (parsed.status === "APPROVED") {
      return this.paymentRequests.settleByExternalRef(ref, "APPROVED");
    }
    if (parsed.status === "FAILED") {
      return this.paymentRequests.settleByExternalRef(
        ref,
        "FAILED",
        "MoMo reported payment failed",
      );
    }
    return { settled: false };
  }
}
