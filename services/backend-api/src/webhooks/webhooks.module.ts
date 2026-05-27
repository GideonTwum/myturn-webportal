import { Module, forwardRef } from "@nestjs/common";
import { IdempotencyService } from "../common/idempotency/idempotency.service";
import { PaymentRequestsModule } from "../payment-requests/payment-requests.module";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";

@Module({
  imports: [forwardRef(() => PaymentRequestsModule)],
  controllers: [WebhooksController],
  providers: [WebhooksService, IdempotencyService],
  exports: [WebhooksService, IdempotencyService],
})
export class WebhooksModule {}
