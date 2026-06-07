import { Module } from "@nestjs/common";
import { CycleRiskModule } from "../cycle-risk/cycle-risk.module";
import { LedgerAccountsModule } from "../ledger-accounts/ledger-accounts.module";
import { MemberModule } from "../member/member.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { PaymentIntentService } from "./payment-intent.service";

@Module({
  imports: [
    NotificationsModule,
    CycleRiskModule,
    MemberModule,
    LedgerAccountsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentIntentService],
  exports: [PaymentsService, PaymentIntentService],
})
export class PaymentsModule {}
