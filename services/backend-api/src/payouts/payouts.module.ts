import { Module } from "@nestjs/common";
import { CycleRiskModule } from "../cycle-risk/cycle-risk.module";
import { LedgerAccountsModule } from "../ledger-accounts/ledger-accounts.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PayoutsController } from "./payouts.controller";
import { PayoutsService } from "./payouts.service";

@Module({
  imports: [NotificationsModule, CycleRiskModule, LedgerAccountsModule],
  controllers: [PayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
