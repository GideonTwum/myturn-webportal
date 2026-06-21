import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CycleComplianceJob } from "./cycle-compliance.job";
import { CycleComplianceService } from "./cycle-compliance.service";
import { CycleDepositsModule } from "./cycle-deposits.module";
import { DefaultProtectionService } from "./default-protection.service";
import { HqDefaultProtectionController } from "./hq-default-protection.controller";

@Module({
  imports: [ScheduleModule, PrismaModule, NotificationsModule, CycleDepositsModule],
  controllers: [HqDefaultProtectionController],
  providers: [CycleComplianceService, CycleComplianceJob, DefaultProtectionService],
  exports: [CycleComplianceService, CycleDepositsModule, DefaultProtectionService],
})
export class CycleRiskModule {}
