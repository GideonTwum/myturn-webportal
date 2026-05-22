import { Body, Controller, Headers, Logger, Param, Post } from "@nestjs/common";
import { WebhooksService } from "./webhooks.service";

@Controller("webhooks")
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private webhooks: WebhooksService) {}

  /**
   * PSP callback skeleton — signature verification + idempotency wired in service.
   * Route: POST /api/webhooks/:provider (mtn | vodafone | airteltigo | mock)
   */
  @Post(":provider")
  async handle(
    @Param("provider") provider: string,
    @Headers("x-signature") signature: string | undefined,
    @Headers("x-idempotency-key") idempotencyKey: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    this.logger.log(
      JSON.stringify({
        domain: "webhook",
        event: "webhook.received",
        provider,
        hasSignature: Boolean(signature),
        idempotencyKey: idempotencyKey ?? null,
      }),
    );
    return this.webhooks.processInbound({
      provider,
      signature,
      idempotencyKey,
      body,
    });
  }
}
