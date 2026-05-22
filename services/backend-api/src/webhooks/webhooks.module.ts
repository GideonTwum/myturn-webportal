import { Module } from "@nestjs/common";
import { IdempotencyService } from "../common/idempotency/idempotency.service";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";

@Module({
  controllers: [WebhooksController],
  providers: [WebhooksService, IdempotencyService],
  exports: [WebhooksService, IdempotencyService],
})
export class WebhooksModule {}
