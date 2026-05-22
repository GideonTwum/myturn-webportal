import { Injectable, Logger, NotImplementedException } from "@nestjs/common";
import { getDeploymentTier } from "../common/platform-env";
import { IdempotencyService } from "../common/idempotency/idempotency.service";

export type InboundWebhook = {
  provider: string;
  signature?: string;
  idempotencyKey?: string;
  body: Record<string, unknown>;
};

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private idempotency: IdempotencyService) {}

  async processInbound(payload: InboundWebhook) {
    if (getDeploymentTier() === "production" && payload.provider === "mock") {
      throw new NotImplementedException("Mock webhooks disabled in production");
    }

    const idemKey =
      payload.idempotencyKey ??
      `${payload.provider}:${String(payload.body?.externalRef ?? payload.body?.transactionId ?? "unknown")}`;

    const result = await this.idempotency.runOnce(
      `webhook:${idemKey}`,
      86400,
      async () => {
        this.logger.log(
          JSON.stringify({
            domain: "webhook",
            event: "webhook.processed",
            provider: payload.provider,
            signatureVerified: false,
            note: "PSP integration pending — event logged only",
          }),
        );
        return {
          accepted: true,
          provider: payload.provider,
          status: "logged",
          reconciliation: "PENDING",
        };
      },
    );

    if (result.duplicate) {
      this.logger.warn(`Duplicate webhook ignored: ${idemKey}`);
    }

    return result.value;
  }
}
