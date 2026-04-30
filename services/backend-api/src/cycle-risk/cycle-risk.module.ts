import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CycleComplianceJob } from "./cycle-compliance.job";
import { CycleComplianceService } from "./cycle-compliance.service";
import { CycleDepositsModule } from "./cycle-deposits.module";

@Module({
  imports: [
    ScheduleModule,
    PrismaModule,
    NotificationsModule,
    CycleDepositsModule,
  ],
  providers: [CycleComplianceService, CycleComplianceJob],
  exports: [CycleComplianceService, CycleDepositsModule],
})
export class CycleRiskModule {}
