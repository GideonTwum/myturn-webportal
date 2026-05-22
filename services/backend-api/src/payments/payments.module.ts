import { Module } from "@nestjs/common";
import { CycleRiskModule } from "../cycle-risk/cycle-risk.module";
import { MemberModule } from "../member/member.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [NotificationsModule, CycleRiskModule, MemberModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
