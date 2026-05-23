import {
  Injectable,
  Logger,
  NotImplementedException,
  UnauthorizedException,
} from "@nestjs/common";
import { getDeploymentTier } from "../common/platform-env";
import { IdempotencyService } from "../common/idempotency/idempotency.service";
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

  constructor(private idempotency: IdempotencyService) {}

  async processInbound(payload: InboundWebhook) {
    if (getDeploymentTier() === "production" && payload.provider === "mock") {
      throw new NotImplementedException("Mock webhooks disabled in production");
    }

    const rawBody = JSON.stringify(payload.body);
    const sig = verifyWebhookSignature({
      provider: payload.provider,
      rawBody,
      signature: payload.signature,
    });

    const correlationId =
      payload.correlationId ??
      String(payload.body?.externalRef ?? payload.body?.referenceId ?? "");

    if (getDeploymentTier() === "production" && !sig.valid) {
      this.logger.warn(
        JSON.stringify({
          domain: "webhook",
          event: "webhook.rejected",
          provider: payload.provider,
          reason: sig.reason,
          correlationId,
        }),
      );
      throw new UnauthorizedException("Invalid webhook signature");
    }

    const idemKey =
      payload.idempotencyKey ??
      `${payload.provider}:${String(payload.body?.externalRef ?? payload.body?.transactionId ?? (correlationId || "unknown"))}`;

    const result = await this.idempotency.runOnce(
      `webhook:${idemKey}`,
      86400,
      async () => {
        this.logger.log(
          JSON.stringify({
            domain: "webhook",
            event: "webhook.processed",
            provider: payload.provider,
            signatureVerified: sig.valid,
            correlationId: correlationId || null,
            replayProtection: "idempotency_key",
            note:
              sig.valid || getDeploymentTier() !== "production"
                ? "accepted"
                : "signature_skipped_staging",
          }),
        );
        return {
          accepted: true,
          provider: payload.provider,
          status: "logged",
          reconciliation: "PENDING",
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
}
