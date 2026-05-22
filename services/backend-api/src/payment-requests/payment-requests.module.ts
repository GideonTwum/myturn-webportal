import { Module } from "@nestjs/common";
import { MemberModule } from "../member/member.module";
import { PaymentsModule } from "../payments/payments.module";
import { PaymentRequestsController } from "./payment-requests.controller";
import { PaymentRequestsService } from "./payment-requests.service";

@Module({
  imports: [MemberModule, PaymentsModule],
  controllers: [PaymentRequestsController],
  providers: [PaymentRequestsService],
  exports: [PaymentRequestsService],
})
export class PaymentRequestsModule {}
