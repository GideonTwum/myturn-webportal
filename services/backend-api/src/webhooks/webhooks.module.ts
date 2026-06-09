import { Module, forwardRef } from "@nestjs/common";
import { IdempotencyService } from "../common/idempotency/idempotency.service";
import { PaymentRequestsModule } from "../payment-requests/payment-requests.module";
import { WithdrawalsModule } from "../withdrawals/withdrawals.module";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";

@Module({
  imports: [forwardRef(() => PaymentRequestsModule), WithdrawalsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, IdempotencyService],
  exports: [WebhooksService, IdempotencyService],
})
export class WebhooksModule {}
