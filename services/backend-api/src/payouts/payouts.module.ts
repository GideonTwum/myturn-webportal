import { Module } from "@nestjs/common";
import { CycleRiskModule } from "../cycle-risk/cycle-risk.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PayoutsController } from "./payouts.controller";
import { PayoutsService } from "./payouts.service";

@Module({
  imports: [NotificationsModule, CycleRiskModule],
  controllers: [PayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
